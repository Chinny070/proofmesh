import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { writes } from "../lib/genlayer";
import {
  useCredential,
  useIdentityChallenge,
  useProfileCredentials,
} from "../features/contract/useProofMeshRead";
import { useProofMeshWrite } from "../features/contract/useProofMeshWrite";
import { WalletGate } from "../components/WalletPanel";
import { TransactionStatus } from "../components/TransactionStatus";
import {
  Breadcrumb,
  ChipList,
  Loading,
  PageHead,
  RecordNotFound,
  StatusBadge,
} from "../components/ui";
import {
  CHALLENGE_REASON_LABELS,
  bpsToPercent,
  formatTimestamp,
  shortenAddress,
} from "../types/proofmesh";
import type { ChallengeDecision, IdentityChallengeRecord } from "../types/proofmesh";

const DECISION_MEANING: Record<ChallengeDecision, string> = {
  UPHOLD: "The historical controller keeps the credential. The competing claim was not strong enough.",
  TRANSFER:
    "The competing profile now controls the identity. A new credential was issued to them; the original is preserved as TRANSFERRED.",
  REVOKE: "Neither side holds a credible claim. The credential is revoked and stays revoked.",
  REQUIRE_REVERIFICATION:
    "The evidence was genuinely ambiguous. The historical controller must redo verification.",
};

export default function ChallengeDetailPage() {
  const { challengeId } = useParams<{ challengeId: string }>();
  const challenge = useIdentityChallenge(challengeId);
  const credential = useCredential(challenge.data?.credential_id);

  if (challenge.isLoading) return <Loading label="Loading dispute…" />;
  if (challenge.error || !challenge.data) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Conflict Court", to: "/challenges" }, { label: "Not found" }]} />
        <RecordNotFound
          kind="Dispute"
          id={challengeId}
          error={challenge.error}
          backTo="/challenges"
          backLabel="Back to Conflict Court"
        />
      </div>
    );
  }

  const c = challenge.data;
  const historicalProfileId = credential.data?.profile_id;
  const transferred = c.resolution === "TRANSFER";

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <Breadcrumb
        items={[{ label: "Conflict Court", to: "/challenges" }, { label: "Dispute" }]}
      />

      <PageHead
        eyebrow="Conflict Court"
        title={CHALLENGE_REASON_LABELS[c.reason_code] ?? c.reason_code}
      >
        <p className="row" style={{ gap: "0.5rem" }}>
          <StatusBadge status={c.status} />
          {c.resolution && <StatusBadge status={c.resolution} />}
          <span className="small faint mono">{c.id}</span>
        </p>
      </PageHead>

      {/* Sides of the dispute */}
      <section className="card" aria-labelledby="parties-h">
        <h2 id="parties-h">Parties</h2>
        <div className="versus">
          <div
            className={`side side-historical ${
              c.resolution === "UPHOLD" ? "side-winner" : ""
            }`}
          >
            <p className="side-role">Historical controller</p>
            <h3 style={{ margin: "0.25rem 0" }}>
              {historicalProfileId ? (
                <Link to={`/identity/${encodeURIComponent(historicalProfileId)}`}>
                  {historicalProfileId}
                </Link>
              ) : (
                "—"
              )}
            </h3>
            {credential.data && (
              <p className="small dim">
                Holds {credential.data.credential_type.replace(/_/g, " ")} at{" "}
                {bpsToPercent(credential.data.confidence_bps)} confidence
              </p>
            )}
            {transferred && (
              <p className="badge st-TRANSFERRED" style={{ marginTop: "0.5rem" }}>
                Control moved away
              </p>
            )}
          </div>

          <div className="versus-mid" aria-hidden="true">
            vs
          </div>

          <div
            className={`side side-competing ${
              c.resolution === "TRANSFER" ? "side-winner" : ""
            }`}
          >
            <p className="side-role">Competing claimant</p>
            <h3 style={{ margin: "0.25rem 0" }}>
              {c.competing_profile_id ? (
                <Link to={`/identity/${encodeURIComponent(c.competing_profile_id)}`}>
                  {c.competing_profile_id}
                </Link>
              ) : (
                <span className="dim">No competing profile named</span>
              )}
            </h3>
            <p className="small dim">Challenger wallet {shortenAddress(c.challenger)}</p>
            {transferred && (
              <p className="badge st-ACTIVE" style={{ marginTop: "0.5rem" }}>
                Now current controller
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Disputed credential */}
      {credential.data && (
        <section className="card" aria-labelledby="disputed-h">
          <div className="row row-between">
            <h2 id="disputed-h" style={{ margin: 0 }}>
              Disputed credential
            </h2>
            <StatusBadge status={credential.data.status} />
          </div>
          <dl className="kv small" style={{ marginTop: "0.75rem" }}>
            <div>
              <dt>Type</dt>
              <dd>{credential.data.credential_type.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{bpsToPercent(credential.data.confidence_bps)}</dd>
            </div>
            <div>
              <dt>Signals</dt>
              <dd>{credential.data.independent_signal_count}</dd>
            </div>
            <div>
              <dt>Issued</dt>
              <dd>{formatTimestamp(credential.data.issued_at)}</dd>
            </div>
          </dl>
          <Link
            className="btn btn-sm"
            to={`/identity/${encodeURIComponent(credential.data.profile_id)}/credentials`}
            style={{ marginTop: "0.75rem" }}
          >
            View credential
          </Link>
        </section>
      )}

      {/* Statement + evidence */}
      <section className="card" aria-labelledby="case-h">
        <h2 id="case-h">The case</h2>
        <p className="section-label">Challenger statement</p>
        <p className="dim">{c.statement}</p>

        <p className="section-label" style={{ marginTop: "1rem" }}>
          Submitted evidence
        </p>
        <ChipList items={c.evidence_refs} empty="No evidence submitted yet" />
      </section>

      {/* Timeline */}
      <section className="card" aria-labelledby="timeline-h">
        <h2 id="timeline-h">Timeline</h2>
        <ol className="timeline">
          <li data-tone="done">
            <div className="timeline-title">Dispute opened</div>
            <div className="timeline-meta">{formatTimestamp(c.opened_at)}</div>
          </li>
          <li data-tone={c.frozen_at ? "done" : c.status === "OPEN" ? "active" : undefined}>
            <div className="timeline-title">Evidence frozen</div>
            <div className="timeline-meta">
              {c.frozen_at ? formatTimestamp(c.frozen_at) : "Awaiting freeze"}
            </div>
          </li>
          <li data-tone={c.resolved_at ? "done" : c.status === "FROZEN" ? "active" : undefined}>
            <div className="timeline-title">Adjudicated</div>
            <div className="timeline-meta">
              {c.resolved_at ? formatTimestamp(c.resolved_at) : "Awaiting adjudication"}
            </div>
          </li>
        </ol>
      </section>

      {/* Outcome */}
      {c.status === "RESOLVED" && c.resolution && (
        <section className="card card-lift" aria-labelledby="outcome-h">
          <div className="row row-between">
            <h2 id="outcome-h" style={{ margin: 0 }}>
              Adjudication outcome
            </h2>
            <StatusBadge status={c.resolution} />
          </div>
          <p className="dim" style={{ marginTop: "0.75rem" }}>
            {DECISION_MEANING[c.resolution as ChallengeDecision]}
          </p>
          {c.summary && (
            <p className="note" style={{ marginTop: "0.75rem" }}>
              <strong>Validator summary</strong>
              <br />
              {c.summary}
            </p>
          )}
          {transferred && historicalProfileId && (
            <TransferredHistory
              historicalProfileId={historicalProfileId}
              competingProfileId={c.competing_profile_id}
            />
          )}
        </section>
      )}

      {/* Actions */}
      {c.status !== "RESOLVED" && <DisputeActions challenge={c} />}
    </div>
  );
}

/** Makes preserved history explicit after a TRANSFER outcome. */
function TransferredHistory({
  historicalProfileId,
  competingProfileId,
}: {
  historicalProfileId: string;
  competingProfileId: string;
}) {
  const historical = useProfileCredentials(historicalProfileId);
  const transferredCred = (historical.data ?? []).find((c) => c.status === "TRANSFERRED");

  return (
    <div className="note note-info" style={{ marginTop: "1rem" }}>
      <strong>History is preserved.</strong>
      <p style={{ marginTop: "0.4rem" }}>
        The original credential held by <code>{historicalProfileId}</code> was not deleted — it
        remains queryable, marked <StatusBadge status="TRANSFERRED" />. A separate new credential
        was issued to <code>{competingProfileId}</code>.
      </p>
      {transferredCred && (
        <p className="small mono">Historical credential: {transferredCred.id}</p>
      )}
      <div className="row">
        <Link className="btn btn-sm" to={`/identity/${encodeURIComponent(historicalProfileId)}/credentials`}>
          Historical controller
        </Link>
        {competingProfileId && (
          <Link className="btn btn-sm" to={`/identity/${encodeURIComponent(competingProfileId)}/credentials`}>
            Current controller
          </Link>
        )}
      </div>
    </div>
  );
}

function DisputeActions({ challenge }: { challenge: IdentityChallengeRecord }) {
  const [proofId, setProofId] = useState("");
  const evidenceWrite = useProofMeshWrite();
  const freezeWrite = useProofMeshWrite();
  const adjudicateWrite = useProofMeshWrite();

  async function submitEvidence(event: React.FormEvent) {
    event.preventDefault();
    if (!proofId.trim()) return;
    const result = await evidenceWrite.execute((account) =>
      writes.submitChallengeEvidence(account, challenge.id, proofId.trim()),
    );
    if (result.state === "finalized_success") setProofId("");
  }

  return (
    <section className="card" aria-labelledby="actions-h">
      <h2 id="actions-h">Move this dispute forward</h2>

      {challenge.status === "OPEN" && (
        <>
          <h3>Submit evidence</h3>
          <p className="dim small">
            Reference an existing proof by its ID. Evidence must belong to either the challenged
            profile or the competing profile.
          </p>
          <WalletGate>
            <form onSubmit={submitEvidence} style={{ maxWidth: "26rem" }}>
              <div className="field">
                <label htmlFor="evidence-proof">Proof ID</label>
                <input
                  id="evidence-proof"
                  type="text"
                  value={proofId}
                  onChange={(e) => setProofId(e.target.value)}
                  placeholder="proof-1"
                  disabled={evidenceWrite.isPending}
                />
              </div>
              <button
                type="submit"
                className="btn"
                disabled={evidenceWrite.isPending || !proofId.trim()}
              >
                {evidenceWrite.isPending ? "Submitting…" : "Submit evidence"}
              </button>
            </form>
            <TransactionStatus progress={evidenceWrite.progress} />

            <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--hairline)", paddingTop: "1rem" }}>
              <h3>Freeze evidence</h3>
              <p className="dim small">
                Locks the evidence set so adjudication runs against a fixed record. Requires at
                least one evidence item.
              </p>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  void freezeWrite.execute((account) =>
                    writes.freezeIdentityChallenge(account, challenge.id),
                  )
                }
                disabled={freezeWrite.isPending || challenge.evidence_refs.length === 0}
              >
                {freezeWrite.isPending ? "Freezing…" : "Freeze dispute evidence"}
              </button>
              {challenge.evidence_refs.length === 0 && (
                <p className="field-hint">Submit at least one piece of evidence first.</p>
              )}
              <TransactionStatus progress={freezeWrite.progress} />
            </div>
          </WalletGate>
        </>
      )}

      {challenge.status === "FROZEN" && (
        <>
          <h3>Trigger adjudication</h3>
          <p className="dim small">
            Validators retrieve both sides' claimed sources live and decide: uphold, transfer,
            revoke, or require re-verification. This is a nondeterministic step and may take
            longer than a normal transaction.
          </p>
          <WalletGate>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                void adjudicateWrite.execute((account) =>
                  writes.evaluateIdentityChallenge(account, challenge.id),
                )
              }
              disabled={adjudicateWrite.isPending}
            >
              {adjudicateWrite.isPending ? "Adjudicating…" : "Run adjudication"}
            </button>
            <TransactionStatus progress={adjudicateWrite.progress} />
          </WalletGate>
        </>
      )}
    </section>
  );
}
