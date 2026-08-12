/**
 * Transaction receipt polling and finality classification.
 *
 * Uses `client.waitForTransactionReceipt` (verified real API on
 * GenLayerClient, see node_modules/genlayer-js/dist/index-C3Ul1Rte.d.ts)
 * plus the real runtime `TransactionStatus` / `ExecutionResult` enums
 * exported from `genlayer-js/types` (verified via
 * node_modules/genlayer-js/dist/types/index.js) -- no string literal in
 * this file is guessed.
 *
 * A transaction hash is never treated as success. `finalized_success` is
 * only reached once the FINALIZED receipt's execution result confirms
 * successful contract execution.
 */
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import type {
  GenLayerClient,
  GenLayerTransaction,
  TransactionHash,
} from "genlayer-js/types";
import { normalizeError } from "./errors";
import type { studioNetChain } from "./chain";
import type { TxProgress } from "./types";

type Client = GenLayerClient<typeof studioNetChain>;

const ACCEPT_INTERVAL_MS = 2000;
const ACCEPT_RETRIES = 30; // ~1 minute
const FINALITY_INTERVAL_MS = 3000;
const FINALITY_RETRIES = 60; // ~3 minutes

/**
 * Drives a submitted transaction through ACCEPTED -> FINALIZED, invoking
 * `onProgress` at each meaningful lifecycle step. Never resolves with a
 * "success" TxProgress unless the finalized receipt's execution result is
 * FINISHED_WITH_RETURN.
 */
export async function trackTransaction(
  client: Client,
  hash: `0x${string}`,
  onProgress: (progress: TxProgress) => void,
): Promise<TxProgress> {
  onProgress({ state: "submitted", hash });

  let acceptedReceipt: GenLayerTransaction;
  try {
    onProgress({ state: "pending", hash });
    acceptedReceipt = await client.waitForTransactionReceipt({
      hash: hash as TransactionHash,
      status: TransactionStatus.ACCEPTED,
      interval: ACCEPT_INTERVAL_MS,
      retries: ACCEPT_RETRIES,
    });
  } catch (err) {
    const error = normalizeError(err);
    const state = error.category === "timeout" ? "timeout" : "rejected";
    const progress: TxProgress = { state, hash, error };
    onProgress(progress);
    return progress;
  }

  onProgress({ state: "accepted", hash, statusName: acceptedReceipt.statusName });

  if (acceptedReceipt.statusName === TransactionStatus.FINALIZED) {
    return finalize(acceptedReceipt, hash, onProgress);
  }

  let finalReceipt: GenLayerTransaction;
  try {
    onProgress({ state: "awaiting_finality", hash });
    finalReceipt = await client.waitForTransactionReceipt({
      hash: hash as TransactionHash,
      status: TransactionStatus.FINALIZED,
      interval: FINALITY_INTERVAL_MS,
      retries: FINALITY_RETRIES,
    });
  } catch (err) {
    const error = normalizeError(err);
    const state = error.category === "timeout" ? "timeout" : "rejected";
    const progress: TxProgress = { state, hash, error };
    onProgress(progress);
    return progress;
  }

  return finalize(finalReceipt, hash, onProgress);
}

function finalize(
  receipt: GenLayerTransaction,
  hash: `0x${string}`,
  onProgress: (progress: TxProgress) => void,
): TxProgress {
  const executedOk = receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN;

  const progress: TxProgress = executedOk
    ? { state: "finalized_success", hash, statusName: receipt.statusName, result: receipt.data }
    : {
        state: "finalized_execution_failed",
        hash,
        statusName: receipt.statusName,
        error: {
          category: "contract_revert",
          message:
            "Transaction finalized but contract execution did not succeed " +
            `(execution result: ${receipt.txExecutionResultName ?? "unknown"}).`,
        },
      };

  onProgress(progress);
  return progress;
}
