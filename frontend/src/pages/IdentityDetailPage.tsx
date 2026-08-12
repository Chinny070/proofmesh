import { Link, useParams } from "react-router-dom";
import {
  useProfile,
  useProfileClaims,
  useProfileCredentials,
} from "../features/contract/useProofMeshRead";
import { useWallet } from "../features/wallet/useWallet";
import { IdentityMesh } from "../components/IdentityMesh";
import {
  Breadcrumb,
  ConfidenceMeter,
  ErrorNote,
  Loading,
  PageHead,
  RecordNotFound,
  Stat,
  StatusBadge,
} from "../components/ui";
import {
  CLAIM_TYPE_LABELS,
  formatTimestamp,
  shortenAddress,
} from "../types/proofmesh";

export default function IdentityDetailPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const profile = useProfile(profileId);
  const claims = useProfileClaims(profileId);
  const credentials = useProfileCredentials(profileId);
  const wallet = useWallet();

  const isOwner =
    wallet.address && profile.data
      ? wallet.address.toLowerCase() === profile.data.owner.toLowerCase()
      : false;

  if (profile.isLoading) return <Loading label="Loading profile…" />;
  if (profile.error || !profile.data) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Identity", to: "/identity" }, { label: profileId ?? "" }]} />
        <RecordNotFound
          kind="Profile"
          id={profileId}
          error={profile.error}
          backTo="/identity"
          backLabel="Back to identities"
        />
      </div>
    );
  }

  const p = profile.data;
  const creds = credentials.data ?? [];
  const primary =
    creds.find((c) => c.status === "ACTIVE") ??
    creds.find((c) => c.status === "RECHECK_DUE") ??
    creds[0];
  const unresolved = creds.reduce((sum, c) => sum + c.unresolved_challenges, 0);

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      <Breadcrumb items={[{ label: "Identity", to: "/identity" }, { label: p.id }]} />

      <PageHead
        eyebrow="Identity dashboard"
        title={p.id}
        actions={
          <>
            <Link className="btn" to={`/identity/${encodeURIComponent(p.id)}/claims`}>
              Claims
            </Link>
            <Link className="btn" to={`/identity/${encodeURIComponent(p.id)}/credentials`}>
              Credentials
            </Link>
            <Link className="btn" to={`/identity/${encodeURIComponent(p.id)}/continuity`}>
              Continuity
            </Link>
          </>
        }
      >
        <p className="row" style={{ gap: "0.5rem" }}>
          <StatusBadge status={p.status} />
          <span className="mono small faint">{shortenAddress(p.owner)}</span>
          {isOwner && <span className="badge st-ACTIVE">You own this</span>}
        </p>
      </PageHead>

      {unresolved > 0 && (
        <p className="note note-bad">
          <strong>
            {unresolved} unresolved {unresolved === 1 ? "dispute" : "disputes"} against this
            profile.
          </strong>{" "}
          Affected credentials are locked until adjudication resolves them.{" "}
          <Link to="/challenges">Open the Conflict Court</Link>
        </p>
      )}

      <div className="grid grid-3">
        <Stat value={p.claim_count} label="Identity claims" />
        <Stat value={p.credential_count} label="Credentials" />
        <Stat value={p.continuity_status} label="Continuity state" />
        <Stat value={unresolved} label="Unresolved disputes" />
        <Stat
          value={primary ? primary.credential_type.replace(/_/g, " ") : "—"}
          label="Primary credential"
        />
        <Stat
          value={primary ? formatTimestamp(primary.expires_at).split(",")[0] : "—"}
          label="Credential expiry"
        />
      </div>

      {claims.error && <ErrorNote error={claims.error} context="Could not load claims" />}
      {claims.isLoading && <Loading label="Loading identity mesh…" />}
      {claims.data && (
        <div className="card">
          <IdentityMesh profile={p} claims={claims.data} credentials={creds} />
        </div>
      )}

      <div className="grid grid-2">
        <section className="card" aria-labelledby="claims-h">
          <div className="row row-between">
            <h2 id="claims-h" style={{ margin: 0 }}>
              Claims
            </h2>
            <Link className="btn btn-sm" to={`/identity/${encodeURIComponent(p.id)}/claims`}>
              Manage
            </Link>
          </div>
          {claims.data?.length === 0 && (
            <p className="dim small" style={{ marginTop: "0.75rem" }}>
              No claims yet.
            </p>
          )}
          {claims.data && claims.data.length > 0 && (
            <ul className="stack" style={{ listStyle: "none", padding: 0, marginTop: "0.75rem", gap: "0.6rem" }}>
              {claims.data.map((claim) => (
                <li key={claim.claim_id} className="row row-between" style={{ gap: "0.5rem" }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="small">{CLAIM_TYPE_LABELS[claim.claim_type]}</div>
                    <div className="mono small faint" style={{ overflowWrap: "anywhere" }}>
                      {claim.claim_value}
                    </div>
                  </div>
                  <StatusBadge status={claim.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-labelledby="cred-h">
          <div className="row row-between">
            <h2 id="cred-h" style={{ margin: 0 }}>
              Credentials
            </h2>
            <Link className="btn btn-sm" to={`/identity/${encodeURIComponent(p.id)}/credentials`}>
              View all
            </Link>
          </div>
          {credentials.isLoading && <Loading />}
          {creds.length === 0 && !credentials.isLoading && (
            <p className="dim small" style={{ marginTop: "0.75rem" }}>
              No credential issued yet. Freeze evidence and run an evaluation from the Claims
              page.
            </p>
          )}
          {primary && (
            <div style={{ marginTop: "0.75rem" }}>
              <div className="row row-between">
                <strong>{primary.credential_type.replace(/_/g, " ")}</strong>
                <StatusBadge status={primary.status} />
              </div>
              <div style={{ margin: "0.75rem 0" }}>
                <ConfidenceMeter bps={primary.confidence_bps} />
              </div>
              <dl className="kv small">
                <div>
                  <dt>Signals</dt>
                  <dd>{primary.independent_signal_count} independent</dd>
                </div>
                <div>
                  <dt>Issued</dt>
                  <dd>{formatTimestamp(primary.issued_at)}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{formatTimestamp(primary.expires_at)}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
