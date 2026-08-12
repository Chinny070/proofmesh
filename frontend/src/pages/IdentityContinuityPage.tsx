import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { writes } from "../lib/genlayer";
import {
  useContinuityRecords,
  useProfile,
  useProfileCredentials,
} from "../features/contract/useProofMeshRead";
import { useProofMeshWrite } from "../features/contract/useProofMeshWrite";
import { WalletGate } from "../components/WalletPanel";
import { TransactionStatus } from "../components/TransactionStatus";
import {
  Breadcrumb,
  ChipList,
  EmptyState,
  ErrorNote,
  Loading,
  PageHead,
  RecordNotFound,
  StatusBadge,
} from "../components/ui";
import { bpsToPercent, formatTimestamp } from "../types/proofmesh";
import type { CredentialRecord } from "../types/proofmesh";

export default function IdentityContinuityPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const profile = useProfile(profileId);
  const credentials = useProfileCredentials(profileId);

  if (profile.isLoading) return <Loading label="Loading profile…" />;
  if (profile.error || !profile.data) {
    return (
      <RecordNotFound
        kind="Profile"
        id={profileId}
        error={profile.error}
        backTo="/identity"
        backLabel="Back to identities"
      />
    );
  }

  const p = profile.data;
  const creds = credentials.data ?? [];

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <Breadcrumb
        items={[
          { label: "Identity", to: "/identity" },
          { label: p.id, to: `/identity/${encodeURIComponent(p.id)}` },
          { label: "Continuity" },
        ]}
      />

      <PageHead eyebrow="Continuity" title={`Continuity for ${p.id}`}>
        <p>
          Verification decays. Continuity checks re-fetch the same claimed sources and ask
          whether the credential is still trustworthy — anyone can trigger one after the recheck
          interval, with no backend scheduler involved.
        </p>
      </PageHead>

      <p className="row" style={{ gap: "0.5rem" }}>
        <span className="faint small">Profile continuity state:</span>
        <StatusBadge status={p.continuity_status} />
      </p>

      {credentials.isLoading && <Loading label="Loading credentials…" />}
      {credentials.error && <ErrorNote error={credentials.error} />}

      {!credentials.isLoading && creds.length === 0 && (
        <EmptyState
          title="Nothing to check yet"
          action={
            <Link className="btn btn-primary" to={`/identity/${encodeURIComponent(p.id)}/claims`}>
              Go to Claim Wizard
            </Link>
          }
        >
          <p>Continuity applies to issued credentials. This profile doesn't have one yet.</p>
        </EmptyState>
      )}

      {creds.map((credential) => (
        <ContinuityCard key={credential.id} credential={credential} profileId={p.id} />
      ))}
    </div>
  );
}

function ContinuityCard({
  credential,
  profileId,
}: {
  credential: CredentialRecord;
  profileId: string;
}) {
  const records = useContinuityRecords(credential.id);
  const requestWrite = useProofMeshWrite();
  const evaluateWrite = useProofMeshWrite();
  const [pendingContinuityId, setPendingContinuityId] = useState<string | null>(null);

  const checkable = credential.status === "ACTIVE" || credential.status === "RECHECK_DUE";

  const pendingRecord = (records.data ?? []).find((r) => r.status === "PENDING");
  const targetId = pendingContinuityId ?? pendingRecord?.id ?? null;

  async function handleRequest() {
    const result = await requestWrite.execute((account) =>
      writes.requestContinuityCheck(account, profileId, credential.id),
    );
    if (result.state === "finalized_success" && typeof result.result === "string") {
      setPendingContinuityId(result.result);
    }
  }

  async function handleEvaluate() {
    if (!targetId) return;
    await evaluateWrite.execute((account) => writes.evaluateContinuity(account, targetId));
  }

  return (
    <section className="card" aria-labelledby={`cont-${credential.id}`}>
      <div className="row row-between">
        <h2 id={`cont-${credential.id}`} style={{ margin: 0 }}>
          {credential.credential_type.replace(/_/g, " ")}
        </h2>
        <StatusBadge status={credential.status} />
      </div>

      <dl className="kv small" style={{ marginTop: "0.75rem" }}>
        <div>
          <dt>Last check</dt>
          <dd>
            {credential.last_continuity_check
              ? formatTimestamp(credential.last_continuity_check)
              : "Never checked"}
          </dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{formatTimestamp(credential.expires_at)}</dd>
        </div>
      </dl>

      {!checkable && (
        <p className="note note-warn">
          Only <strong>ACTIVE</strong> or <strong>RECHECK_DUE</strong> credentials can be
          continuity-checked. This one is <StatusBadge status={credential.status} /> — it needs a
          fresh evaluation or dispute resolution instead.
        </p>
      )}

      {checkable && (
        <WalletGate>
          <div className="row" style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className="btn"
              onClick={() => void handleRequest()}
              disabled={requestWrite.isPending || Boolean(targetId)}
            >
              {requestWrite.isPending ? "Requesting…" : "Request continuity check"}
            </button>
            {targetId && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleEvaluate()}
                disabled={evaluateWrite.isPending}
              >
                {evaluateWrite.isPending ? "Evaluating…" : "Run continuity evaluation"}
              </button>
            )}
          </div>
          <p className="field-hint">
            A check can only be requested once the recheck interval has elapsed since issuance or
            the last check.
          </p>
          <TransactionStatus progress={requestWrite.progress} />
          <TransactionStatus progress={evaluateWrite.progress} />
        </WalletGate>
      )}

      <h3 style={{ marginTop: "1.25rem" }}>Continuity history</h3>
      {records.isLoading && <Loading />}
      {records.data?.length === 0 && (
        <p className="dim small">No continuity checks have been run for this credential.</p>
      )}
      {records.data && records.data.length > 0 && (
        <ol className="timeline">
          {records.data.map((record) => (
            <li key={record.id} data-tone={record.status === "PENDING" ? "active" : "done"}>
              <div className="row row-between">
                <span className="timeline-title">
                  <StatusBadge status={record.status} />
                </span>
                <span className="timeline-meta">
                  {record.evaluated_at
                    ? formatTimestamp(record.evaluated_at)
                    : `Requested ${formatTimestamp(record.requested_at)}`}
                </span>
              </div>
              {record.status !== "PENDING" && (
                <p className="small dim" style={{ margin: "0.35rem 0" }}>
                  Continuity risk {bpsToPercent(record.continuity_risk_bps)}
                </p>
              )}
              {record.reason_codes.length > 0 && <ChipList items={record.reason_codes} />}
              {record.summary && (
                <p className="small dim" style={{ marginTop: "0.35rem" }}>
                  {record.summary}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
