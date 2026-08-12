import { Link } from "react-router-dom";
import { useProfiles } from "../features/contract/useProofMeshRead";
import { useWallet } from "../features/wallet/useWallet";
import { EmptyState, ErrorNote, PageHead, SkeletonRows, StatusBadge } from "../components/ui";
import { formatTimestamp, shortenAddress } from "../types/proofmesh";

export default function IdentityListPage() {
  const profiles = useProfiles();
  const wallet = useWallet();

  const mine = wallet.address?.toLowerCase();

  return (
    <div>
      <PageHead
        eyebrow="Identity"
        title="Identity profiles"
        actions={
          <Link className="btn btn-primary" to="/identity/new">
            New profile
          </Link>
        }
      >
        <p>
          Every identity profile registered on this ProofMesh deployment. Profiles are public —
          anyone can inspect claims, credentials, and dispute history.
        </p>
      </PageHead>

      {profiles.isLoading && <SkeletonRows rows={3} />}
      {profiles.error && <ErrorNote error={profiles.error} />}

      {profiles.data?.length === 0 && (
        <EmptyState
          title="No identity profiles yet"
          action={
            <Link className="btn btn-primary" to="/identity/new">
              Create the first profile
            </Link>
          }
        >
          <p>
            This is a fresh deployment. Create a profile to claim your public identities and
            start the verification lifecycle.
          </p>
        </EmptyState>
      )}

      {profiles.data && profiles.data.length > 0 && (
        <div className="grid grid-2">
          {profiles.data.map((profile) => (
            <Link
              key={profile.id}
              to={`/identity/${encodeURIComponent(profile.id)}`}
              className="card card-link"
            >
              <div className="row row-between">
                <h3 style={{ margin: 0 }}>{profile.id}</h3>
                <StatusBadge status={profile.status} />
              </div>
              <p className="small faint mono" style={{ margin: "0.35rem 0 0.75rem" }}>
                {shortenAddress(profile.owner)}
                {mine && profile.owner.toLowerCase() === mine && (
                  <span className="badge st-ACTIVE" style={{ marginLeft: "0.5rem" }}>
                    You
                  </span>
                )}
              </p>
              <dl className="kv small">
                <div>
                  <dt>Claims</dt>
                  <dd>{profile.claim_count}</dd>
                </div>
                <div>
                  <dt>Credentials</dt>
                  <dd>{profile.credential_count}</dd>
                </div>
                <div>
                  <dt>Continuity</dt>
                  <dd>{profile.continuity_status}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatTimestamp(profile.updated_at)}</dd>
                </div>
              </dl>
              {profile.active_challenge_id && (
                <p className="small" style={{ color: "var(--conflict-coral)", marginTop: "0.6rem" }}>
                  Active dispute open
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
