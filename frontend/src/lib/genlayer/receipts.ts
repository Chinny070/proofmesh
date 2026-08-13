/**
 * Transaction receipt polling and outcome classification.
 *
 * A transaction hash is never treated as success. Nor is a leader's
 * receipt: on GenLayer the leader proposes and validators vote, so a
 * write only lands when BOTH the leader executed successfully AND
 * consensus agreed. Reading only the leader reports state changes that
 * never happened.
 *
 * Every field read here was verified against real finalized transactions
 * on the deployed contract rather than assumed from the SDK's types.
 */
import {
  ExecutionResult,
  TransactionStatus,
  transactionResultNumberToName,
} from "genlayer-js/types";
import type { GenLayerClient, GenLayerTransaction, TransactionHash } from "genlayer-js/types";
import { normalizeError } from "./errors";
import { throttled } from "./throttle";
import type { studioNetChain } from "./chain";
import type { TxProgress } from "./types";

type Client = GenLayerClient<typeof studioNetChain>;

/**
 * Polling cadence. Deliberately unhurried: StudioNet allows 30 requests
 * per minute per client, and the SDK's default of one poll every two
 * seconds would spend that entire budget on a single transaction.
 */
const POLL_INTERVAL_MS = 5_000;

/** Consensus on an ordinary write settles quickly. */
const ACCEPT_TIMEOUT_MS = 150_000;

/**
 * Finality for the nondeterministic methods (identity evaluation,
 * continuity, challenge adjudication) involves live web retrieval plus
 * LLM adjudication across every validator, so it needs a long ceiling.
 */
const FINALITY_TIMEOUT_MS = 900_000;

/**
 * A single failed poll means nothing — the transaction is already on
 * chain. Only sustained failure is treated as losing track of it.
 */
const MAX_CONSECUTIVE_POLL_ERRORS = 8;

/** Consensus outcomes in which validators agreed and state was applied. */
const CONSENSUS_AGREED = new Set(["AGREE", "MAJORITY_AGREE"]);

/** Statuses meaning consensus has concluded, one way or the other. */
const DECIDED = new Set<string>([
  TransactionStatus.ACCEPTED,
  TransactionStatus.FINALIZED,
  TransactionStatus.UNDETERMINED,
  TransactionStatus.CANCELED,
  TransactionStatus.LEADER_TIMEOUT,
  TransactionStatus.VALIDATORS_TIMEOUT,
]);

class PollTimeout extends Error {
  constructor() {
    super("timed out waiting for transaction");
    this.name = "PollTimeout";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollUntil(
  client: Client,
  hash: `0x${string}`,
  isDone: (tx: GenLayerTransaction) => boolean,
  timeoutMs: number,
): Promise<GenLayerTransaction> {
  const deadline = Date.now() + timeoutMs;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    try {
      const tx = await throttled(() =>
        client.getTransaction({ hash: hash as unknown as TransactionHash }),
      );
      consecutiveErrors = 0;
      if (isDone(tx)) return tx;
    } catch (err) {
      consecutiveErrors += 1;
      if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) throw err;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new PollTimeout();
}

const statusOf = (tx: GenLayerTransaction): string => String(tx.statusName ?? tx.status ?? "");

/**
 * Drives a submitted transaction through consensus to finality, reporting
 * each lifecycle step. Resolves as successful only when the finalized
 * receipt shows both validator agreement and successful execution.
 */
export async function trackTransaction(
  client: Client,
  hash: `0x${string}`,
  onProgress: (progress: TxProgress) => void,
): Promise<TxProgress> {
  onProgress({ state: "submitted", hash });
  onProgress({ state: "pending", hash });

  let decided: GenLayerTransaction;
  try {
    decided = await pollUntil(client, hash, (tx) => DECIDED.has(statusOf(tx)), ACCEPT_TIMEOUT_MS);
  } catch (err) {
    return report(stillPending(hash, err), onProgress);
  }

  onProgress({ state: "accepted", hash, statusName: decided.statusName });

  let finalTx = decided;
  if (statusOf(decided) !== TransactionStatus.FINALIZED) {
    onProgress({ state: "awaiting_finality", hash });
    try {
      finalTx = await pollUntil(
        client,
        hash,
        (tx) => statusOf(tx) === TransactionStatus.FINALIZED,
        FINALITY_TIMEOUT_MS,
      );
    } catch (err) {
      return report(stillPending(hash, err), onProgress);
    }
  }

  return report(finalize(finalTx, hash), onProgress);
}

function report(progress: TxProgress, onProgress: (p: TxProgress) => void): TxProgress {
  onProgress(progress);
  return progress;
}

/**
 * Losing sight of a transaction is not the same as it failing — it is on
 * chain and still progressing. Reporting it as "rejected" would be a
 * false negative, so this is surfaced as a timeout with wording that
 * steers the user to check rather than blindly retry.
 */
function stillPending(hash: `0x${string}`, err: unknown): TxProgress {
  const normalized = normalizeError(err);
  return {
    state: "timeout",
    hash,
    error: {
      category: normalized.category === "timeout" ? "timeout" : normalized.category,
      message:
        "Stopped tracking this transaction before it settled. It was submitted and is " +
        "still progressing on chain — check the explorer or reload before retrying, " +
        "since retrying may duplicate an action that actually succeeded.",
      cause: err,
    },
  };
}

interface LeaderReceiptLike {
  mode?: string;
  execution_result?: string;
  result?: { status?: string; payload?: { readable?: string } | string };
}

function receiptsOf(tx: GenLayerTransaction): LeaderReceiptLike[] {
  const raw = tx.consensus_data?.leader_receipt as unknown;
  return (Array.isArray(raw) ? raw : raw ? [raw] : []) as LeaderReceiptLike[];
}

function leaderReceiptOf(tx: GenLayerTransaction): LeaderReceiptLike | undefined {
  const list = receiptsOf(tx);
  return list.find((entry) => entry?.mode === "leader") ?? list[0];
}

/**
 * Whether validators agreed. `result` is a numeric code decoded via the
 * SDK's own mapping: 6 = MAJORITY_AGREE (state applied), 7 =
 * MAJORITY_DISAGREE (state not applied, shown as "Undetermined" in the
 * Studio explorer). Returns undefined when no code is present.
 */
function readConsensusOutcome(tx: GenLayerTransaction): { agreed?: boolean; name?: string } {
  const raw = (tx as { result?: unknown }).result;
  if (raw === undefined || raw === null || raw === "") return {};

  const name =
    typeof raw === "number"
      ? (transactionResultNumberToName as Record<string, string>)[String(raw)]
      : String(raw);

  if (!name) return {};
  return { agreed: CONSENSUS_AGREED.has(name.toUpperCase()), name };
}

/** Whether the leader's execution itself succeeded. */
function readExecutionOutcome(tx: GenLayerTransaction): boolean | undefined {
  if (tx.txExecutionResultName !== undefined) {
    return tx.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN;
  }
  const raw = leaderReceiptOf(tx)?.execution_result;
  if (raw === undefined || raw === null) return undefined;

  const token = String(raw).toUpperCase();
  if (token === "SUCCESS" || token === "FINISHED_WITH_RETURN") return true;
  if (token === "ERROR" || token === "FINISHED_WITH_ERROR" || token === "FAILURE") return false;
  return undefined;
}

/**
 * The contract's decoded return value, from the leader receipt's payload —
 * not `tx.data`, which holds the *input* calldata.
 */
function readReturnValue(tx: GenLayerTransaction): unknown {
  const payload = leaderReceiptOf(tx)?.result?.payload;
  const readable = payload && typeof payload === "object" ? payload.readable : undefined;
  if (typeof readable !== "string") return undefined;
  try {
    return JSON.parse(readable) as unknown;
  } catch {
    return readable;
  }
}

/** The contract's own revert message, when execution rolled back. */
function readContractError(tx: GenLayerTransaction): string | undefined {
  const payload = leaderReceiptOf(tx)?.result?.payload;
  if (typeof payload === "string" && payload.trim()) return payload.trim();

  const result = (tx as { result?: unknown }).result;
  if (typeof result === "string" && result.trim()) return result.trim();
  return undefined;
}

function finalize(tx: GenLayerTransaction, hash: `0x${string}`): TxProgress {
  const consensus = readConsensusOutcome(tx);
  const executed = readExecutionOutcome(tx);
  const base = { hash, statusName: tx.statusName };

  // Validators disagreed: the leader's verdict was not adopted and no
  // state change was written, however well the leader itself ran.
  if (consensus.agreed === false) {
    const disagreeing = countVotes(tx, "disagree");
    return {
      ...base,
      state: "finalized_execution_failed",
      error: {
        category: "contract_revert",
        message:
          `Validators did not reach agreement (${consensus.name}), so nothing was ` +
          `written to chain state.` +
          (disagreeing > 0 ? ` ${disagreeing} validator(s) disagreed.` : "") +
          " This is consensus working as designed, not a rejection of your evidence —" +
          " running it again may reach agreement.",
      },
    };
  }

  if (executed === true) {
    return { ...base, state: "finalized_success", result: readReturnValue(tx) };
  }

  const contractMessage = readContractError(tx);
  return {
    ...base,
    state: "finalized_execution_failed",
    error: {
      category: "contract_revert",
      message:
        executed === false
          ? (contractMessage ??
            "The contract rejected this transaction. Nothing was written to chain state.")
          : "This transaction finalized, but its outcome could not be determined from the " +
            "receipt. Check the current on-chain state before retrying.",
    },
  };
}

function countVotes(tx: GenLayerTransaction, vote: string): number {
  const votes = tx.consensus_data?.votes as Record<string, string> | undefined;
  if (!votes) return 0;
  return Object.values(votes).filter((v) => String(v).toLowerCase() === vote).length;
}
