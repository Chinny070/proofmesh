import { Link } from "react-router-dom";
import type { TxProgress, TxState } from "../lib/genlayer";

const LABELS: Record<TxState, string> = {
  idle: "Idle",
  wallet_required: "Wallet required",
  wrong_network: "Wrong network",
  awaiting_signature: "Awaiting signature in your wallet",
  submitted: "Submitted to the network",
  pending: "Pending consensus",
  accepted: "Accepted by validators",
  awaiting_finality: "Awaiting finality",
  finalized_success: "Finalized — execution succeeded",
  finalized_execution_failed: "Finalized — contract execution failed",
  rejected: "Rejected",
  timeout: "Timed out",
};

const TONE: Record<TxState, string> = {
  idle: "idle",
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

/** The happy-path progression, rendered as a step trail. */
const TRAIL: TxState[] = [
  "awaiting_signature",
  "submitted",
  "pending",
  "accepted",
  "awaiting_finality",
  "finalized_success",
];

const BUSY_STATES: TxState[] = [
  "awaiting_signature",
  "submitted",
  "pending",
  "accepted",
  "awaiting_finality",
];

/**
 * Renders the full transaction lifecycle. Deliberately presents
 * "Accepted" and any transaction hash as *intermediate* — only
 * `finalized_success` is styled and worded as a successful outcome.
 */
export function TransactionStatus({ progress }: { progress: TxProgress }) {
  if (progress.state === "idle") return null;

  const tone = TONE[progress.state];
  const trailIndex = TRAIL.indexOf(progress.state);
  const isBusy = BUSY_STATES.includes(progress.state);

  return (
    <div className={`tx-status st-${tone}`} role="status" aria-live="polite">
      <div className="tx-head">
        {isBusy && <span className="spinner" aria-hidden="true" />}
        <strong>{LABELS[progress.state]}</strong>
        {progress.statusName && (
          <span className="badge badge-plain st-busy">{progress.statusName}</span>
        )}
        {progress.hash && (
          <code className="tx-hash" title={progress.hash}>
            {progress.hash.slice(0, 10)}…{progress.hash.slice(-8)}
          </code>
        )}
      </div>

      {trailIndex >= 0 && (
        <ol className="tx-steps">
          {TRAIL.map((step, i) => (
            <li
              key={step}
              data-state={i < trailIndex ? "done" : i === trailIndex ? "current" : "todo"}
            >
              {step.replace(/_/g, " ")}
            </li>
          ))}
        </ol>
      )}

      {progress.state === "accepted" && (
        <p>Accepted by consensus — not final yet. Waiting for finality before reporting success.</p>
      )}
      {progress.state === "awaiting_signature" && (
        <p>Confirm the transaction in your wallet to continue.</p>
      )}
      {progress.state === "wallet_required" && (
        <p>
          Connect a wallet on the <Link to="/account">Account</Link> page to send this
          transaction.
        </p>
      )}
      {progress.state === "wrong_network" && (
        <p>
          Switch your wallet to GenLayer StudioNet (chain 61999) — see{" "}
          <Link to="/account">Account</Link>.
        </p>
      )}
      {progress.state === "finalized_execution_failed" && (
        <p>
          The transaction reached finality but the contract rejected it. Nothing was written to
          chain state.
        </p>
      )}
      {progress.error && <p>{progress.error.message}</p>}
    </div>
  );
}
