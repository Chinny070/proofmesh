import type { TxProgress, TxState } from "../lib/genlayer";

const LABELS: Record<TxState, string> = {
  idle: "Idle",
  wallet_required: "Wallet required",
  wrong_network: "Wrong network",
  awaiting_signature: "Awaiting signature",
  submitted: "Submitted",
  pending: "Pending consensus",
  accepted: "Accepted",
  awaiting_finality: "Awaiting finality",
  finalized_success: "Finalized — success",
  finalized_execution_failed: "Finalized — execution failed",
  rejected: "Rejected",
  timeout: "Timed out",
};

const TONE: Record<TxState, string> = {
  idle: "neutral",
  wallet_required: "warn",
  wrong_network: "warn",
  awaiting_signature: "busy",
  submitted: "busy",
  pending: "busy",
  accepted: "busy",
  awaiting_finality: "busy",
  finalized_success: "ok",
  finalized_execution_failed: "bad",
  rejected: "bad",
  timeout: "bad",
};

/**
 * Renders the full transaction lifecycle. Deliberately shows "Accepted"
 * and any transaction hash as *intermediate*, never as success — only
 * `finalized_success` is styled as a successful outcome.
 */
export function TransactionStatus({ progress }: { progress: TxProgress }) {
  if (progress.state === "idle") return null;

  return (
    <div className={`tx-status tx-${TONE[progress.state]}`}>
      <strong>{LABELS[progress.state]}</strong>
      {progress.statusName && <span className="tx-chain-status">({progress.statusName})</span>}
      {progress.hash && (
        <code className="tx-hash" title={progress.hash}>
          {progress.hash.slice(0, 10)}…{progress.hash.slice(-8)}
        </code>
      )}
      {progress.error && <p className="tx-error">{progress.error.message}</p>}
      {progress.state === "accepted" && (
        <p className="tx-note">Accepted by consensus — not final yet.</p>
      )}
    </div>
  );
}
