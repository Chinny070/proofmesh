import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { writes } from "../lib/genlayer";
import {
  useCredentialChallengeIds,
  useProfile,
  useProfileCredentials,
} from "../features/contract/useProofMeshRead";
import { useProofMeshWrite } from "../features/contract/useProofMeshWrite";
import { WalletGate } from "../components/WalletPanel";
import { TransactionStatus } from "../components/TransactionStatus";
import {
  Breadcrumb,
  ChipList,
  ConfidenceMeter,
  EmptyState,
  ErrorNote,
  Loading,
  PageHead,
  RecordNotFound,
  StatusBadge,
} from "../components/ui";
import {
  CHALLENGE_REASONS,
  CHALLENGE_REASON_LABELS,
  CREDENTIAL_STATUS_DESCRIPTIONS,
  REASONS_REQUIRING_COMPETING_PROFILE,
  formatTimestamp,
} from "../types/proofmesh";
import type { ChallengeReason, CredentialRecord } from "../types/proofmesh";

export default function IdentityCredentialsPage() {
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
          { label: "Credentials" },
        ]}
      />

      <PageHead eyebrow="Credentials" title={`Credentials for ${p.id}`}>
        <p>
          Purpose-specific trust outcomes issued by GenLayer adjudication. Historical
          credentials are never deleted — a transferred or revoked credential stays queryable.
        </p>
      </PageHead>

      {credentials.isLoading && <Loading label="Loading credentials…" />}
      {credentials.error && <ErrorNote error={credentials.error} />}

      {!credentials.isLoading && creds.length === 0 && (
        <EmptyState
          title="No credentials issued yet"
          action={
            <Link className="btn btn-primary" to={`/identity/${encodeURIComponent(p.id)}/claims`}>
              Go to Claim Wizard
            </Link>
          }
        >
          <p>
            Add identity claims, submit proofs, freeze the evidence, then run an evaluation to
            have validators issue a credential.
          </p>
        </EmptyState>
      )}

      {creds.map((credential) => (
        <CredentialCard key={credential.id} credential={credential} profileId={p.id} />
      ))}
    </div>
  );
}

function CredentialCard({
  credential,
  profileId,
}: {
  credential: CredentialRecord;
  profileId: string;
}) {
  const challengeIds = useCredentialChallengeIds(credential.id);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const historical = credential.status === "TRANSFERRED";

  return (
    <section
      className="card card-lift"
      aria-labelledby={`cred-${credential.id}`}
      style={historical ? { borderColor: "var(--st-transferred)" } : undefined}
    >
      <div className="row row-between">
        <h2 id={`cred-${credential.id}`} style={{ margin: 0 }}>
          {credential.credential_type.replace(/_/g, " ")}
        </h2>
        <StatusBadge
          status={credential.status}
          title={CREDENTIAL_STATUS_DESCRIPTIONS[credential.status]}
        />
      </div>

      <p className="dim small" style={{ marginTop: "0.35rem" }}>
        {CREDENTIAL_STATUS_DESCRIPTIONS[credential.status]}
      </p>

      {historical && (
        <p className="note" style={{ borderLeftColor: "var(--st-transferred)" }}>
          <strong>Historical record.</strong> Control of this identity moved to another profile
          through dispute adjudication. This record is preserved unchanged.
        </p>
      )}

      <div style={{ margin: "1rem 0" }}>
        <ConfidenceMeter bps={credential.confidence_bps} />
      </div>

      <dl className="kv">
        <div>
          <dt>Credential ID</dt>
          <dd>
            <code>{credential.id}</code>
          </dd>
        </div>
        <div>
          <dt>Independent signals</dt>
          <dd>{credential.independent_signal_count}</dd>
        </div>
        <div>
          <dt>Policy label</dt>
          <dd>
            <code>{credential.policy_id}</code>
          </dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>{formatTimestamp(credential.issued_at)}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{formatTimestamp(credential.expires_at)}</dd>
        </div>
        <div>
          <dt>Last continuity check</dt>
          <dd>
            {credential.last_continuity_check
              ? formatTimestamp(credential.last_continuity_check)
              : "Never checked"}
          </dd>
        </div>
        <div>
          <dt>Unresolved disputes</dt>
          <dd>
            {credential.unresolved_challenges > 0 ? (
              <span className="badge st-CHALLENGED">{credential.unresolved_challenges} open</span>
            ) : (
              "None"
            )}
          </dd>
        </div>
        <div>
          <dt>Reason codes</dt>
          <dd>
            <ChipList items={credential.reason_codes} />
          </dd>
        </div>
        <div>
          <dt>Evidence references</dt>
          <dd>
            <ChipList items={credential.evidence_refs} empty="No evidence cited" />
          </dd>
        </div>
      </dl>

      {credential.summary && (
        <p className="note" style={{ marginTop: "1rem" }}>
          <strong>Validator summary</strong>
          <br />
          {credential.summary}
        </p>
      )}

      <div className="row" style={{ marginTop: "1rem" }}>
        <Link className="btn btn-sm" to={`/identity/${encodeURIComponent(profileId)}/continuity`}>
          Continuity
        </Link>
        {(challengeIds.data?.length ?? 0) > 0 && (
          <Link className="btn btn-sm" to="/challenges">
            {challengeIds.data!.length} dispute{challengeIds.data!.length === 1 ? "" : "s"}
          </Link>
        )}
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => setDisputeOpen((v) => !v)}
          aria-expanded={disputeOpen}
        >
          {disputeOpen ? "Cancel dispute" : "Dispute this credential"}
        </button>
      </div>

      {disputeOpen && <OpenDisputeForm credentialId={credential.id} />}
    </section>
  );
}

function OpenDisputeForm({ credentialId }: { credentialId: string }) {
  const [reason, setReason] = useState<ChallengeReason>("CONFLICTING_WALLET_CLAIM");
  const [competingProfileId, setCompetingProfileId] = useState("");
  const [statement, setStatement] = useState("");
  const [touched, setTouched] = useState(false);
  const write = useProofMeshWrite();

  const requiresCompeting = REASONS_REQUIRING_COMPETING_PROFILE.includes(reason);
  const trimmedStatement = statement.trim();

  const error = !trimmedStatement
    ? "Explain the basis for this dispute."
    : trimmedStatement.length > 1000
      ? "Statement must be 1000 characters or fewer."
      : requiresCompeting && !competingProfileId.trim()
        ? `${CHALLENGE_REASON_LABELS[reason]} requires a competing profile ID.`
        : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (error) return;
    await write.execute((account) =>
      writes.openIdentityChallenge(
        account,
        credentialId,
        competingProfileId.trim(),
        reason,
        trimmedStatement,
      ),
    );
  }

  return (
    <div style={{ marginTop: "1rem", borderTop: "1px solid var(--hairline)", paddingTop: "1rem" }}>
      <h3>Open an identity challenge</h3>
      <p className="dim small">
        Anyone can dispute a credential. Opening a challenge locks the credential until
        adjudication resolves it — it does not automatically revoke anything.
      </p>
      <WalletGate>
        <form onSubmit={handleSubmit} noValidate style={{ maxWidth: "36rem" }}>
          <div className="field">
            <label htmlFor={`reason-${credentialId}`}>Reason</label>
            <select
              id={`reason-${credentialId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value as ChallengeReason)}
              disabled={write.isPending}
            >
              {CHALLENGE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {CHALLENGE_REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor={`competing-${credentialId}`}>
              Competing profile ID {requiresCompeting ? "(required)" : "(optional)"}
            </label>
            <input
              id={`competing-${credentialId}`}
              type="text"
              value={competingProfileId}
              onChange={(e) => setCompetingProfileId(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="the-other-profile"
              disabled={write.isPending}
            />
            <p className="field-hint">
              The profile claiming to be the rightful controller, if this is an ownership
              conflict.
            </p>
          </div>

          <div className="field">
            <label htmlFor={`statement-${credentialId}`}>Statement</label>
            <textarea
              id={`statement-${credentialId}`}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              onBlur={() => setTouched(true)}
              maxLength={1200}
              placeholder="Describe the evidence and why this credential should be re-examined…"
              disabled={write.isPending}
            />
          </div>

          {touched && error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-danger"
            disabled={write.isPending || Boolean(error)}
          >
            {write.isPending ? "Opening dispute…" : "Open dispute"}
          </button>
        </form>
        <TransactionStatus progress={write.progress} />
      </WalletGate>
    </div>
  );
}
