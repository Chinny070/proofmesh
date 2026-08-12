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

/**
 * Execution-outcome tokens. Two chain families report this differently:
 * the typed SDK path (non-Studio chains) sets `txExecutionResultName` to an
 * `ExecutionResult` value, while StudioNet leaves that field undefined and
 * reports `SUCCESS`/`ERROR` inside `consensus_data.leader_receipt[]`.
 * Verified against real finalized transactions on the deployed contract.
 */
const SUCCESS_TOKENS = new Set(["SUCCESS", "FINISHED_WITH_RETURN"]);
const ERROR_TOKENS = new Set(["ERROR", "FINISHED_WITH_ERROR", "FAILURE"]);

/**
 * A leader receipt's decoded `result` carries the contract outcome, and its
 * `payload` shape depends on `status`:
 *   status "return"   -> payload is { readable: <JSON-encoded return value> }
 *   status "rollback" -> payload is the plain revert message string
 */
interface LeaderReceiptLike {
  mode?: string;
  execution_result?: string;
  result?: {
    status?: string;
    payload?: { readable?: string } | string;
  };
}

function leaderReceiptOf(receipt: GenLayerTransaction): LeaderReceiptLike | undefined {
  const raw = receipt.consensus_data?.leader_receipt as unknown;
  const list = (Array.isArray(raw) ? raw : raw ? [raw] : []) as LeaderReceiptLike[];
  return list.find((entry) => entry?.mode === "leader") ?? list[0];
}

/**
 * Whether contract execution actually succeeded. Returns `undefined` when
 * neither shape yields a determinable answer — that case is deliberately
 * never treated as success.
 */
function readExecutionOutcome(receipt: GenLayerTransaction): boolean | undefined {
  if (receipt.txExecutionResultName !== undefined) {
    return receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN;
  }
  const raw = leaderReceiptOf(receipt)?.execution_result;
  if (raw === undefined || raw === null) return undefined;

  const token = String(raw).toUpperCase();
  if (SUCCESS_TOKENS.has(token)) return true;
  if (ERROR_TOKENS.has(token)) return false;
  return undefined;
}

/**
 * The contract's decoded return value. This lives in the leader receipt's
 * decoded payload -- NOT in `receipt.data`, which carries the *input*
 * calldata (method name + arguments) and would be useless to callers.
 * `readable` is a JSON-encoded scalar, so it is parsed once to recover the
 * plain string the contract returned.
 */
function readReturnValue(receipt: GenLayerTransaction): unknown {
  const payload = leaderReceiptOf(receipt)?.result?.payload;
  const readable =
    payload && typeof payload === "object" ? payload.readable : undefined;
  if (typeof readable !== "string") return undefined;
  try {
    return JSON.parse(readable) as unknown;
  } catch {
    return readable;
  }
}

/**
 * The contract's own revert message (e.g. "Profile ID already exists").
 *
 * On a rolled-back execution it sits in the leader receipt's decoded
 * payload. The top-level `result` field only carries it on the *raw* RPC
 * shape — once decoded it becomes a numeric result code — so the leader
 * receipt is checked first and the raw field is a fallback.
 */
function readContractError(receipt: GenLayerTransaction): string | undefined {
  const payload = leaderReceiptOf(receipt)?.result?.payload;
  if (typeof payload === "string" && payload.trim()) return payload.trim();

  const result = (receipt as { result?: unknown }).result;
  if (typeof result === "string" && result.trim()) return result.trim();
  return undefined;
}

function finalize(
  receipt: GenLayerTransaction,
  hash: `0x${string}`,
  onProgress: (progress: TxProgress) => void,
): TxProgress {
  const executedOk = readExecutionOutcome(receipt);

  let progress: TxProgress;

  if (executedOk === true) {
    progress = {
      state: "finalized_success",
      hash,
      statusName: receipt.statusName,
      result: readReturnValue(receipt),
    };
  } else {
    const contractMessage = readContractError(receipt);
    progress = {
      state: "finalized_execution_failed",
      hash,
      statusName: receipt.statusName,
      error: {
        category: "contract_revert",
        message:
          executedOk === false
            ? (contractMessage ??
              "The contract rejected this transaction. Nothing was written to chain state.")
            : "The transaction finalized, but its execution result could not be determined " +
              "from the receipt. Check the current on-chain state before retrying — " +
              "retrying may fail if the first attempt actually succeeded.",
      },
    };
  }

  onProgress(progress);
  return progress;
}
