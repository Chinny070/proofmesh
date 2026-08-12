import { Link } from "react-router-dom";
import { useAllChallenges } from "../features/contract/useProofMeshRead";
import { EmptyState, ErrorNote, PageHead, SkeletonRows, StatusBadge } from "../components/ui";
import {
  CHALLENGE_REASON_LABELS,
  formatTimestamp,
  shortenAddress,
} from "../types/proofmesh";

export default function ChallengesPage() {
  const challenges = useAllChallenges();

  const open = (challenges.data ?? []).filter((c) => c.status !== "RESOLVED");
  const resolved = (challenges.data ?? []).filter((c) => c.status === "RESOLVED");

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <PageHead eyebrow="Conflict Court" title="Identity disputes">
        <p>
          When two wallets claim the same identity — or a credential's evidence goes stale —
          ProofMesh adjudicates on-chain. Outcomes are upheld, transferred, revoked, or sent back
          for re-verification. History is never erased.
        </p>
      </PageHead>

      {challenges.isLoading && <SkeletonRows rows={2} />}
      {challenges.error && <ErrorNote error={challenges.error} />}

      {!challenges.isLoading && (challenges.data?.length ?? 0) === 0 && (
        <EmptyState title="No disputes have been opened">
          <p>
            Disputes appear here when someone challenges a credential. You can open one from any
            credential page.
          </p>
          <Link className="btn" to="/identity">
            Browse identities
          </Link>
        </EmptyState>
      )}

      {open.length > 0 && (
        <section aria-labelledby="open-h">
          <h2 id="open-h">Open disputes</h2>
          <div className="grid grid-2">
            {open.map((challenge) => (
              <Link
                key={challenge.id}
                to={`/challenges/${encodeURIComponent(challenge.id)}`}
                className="card card-link"
                style={{ borderColor: "rgba(255,83,104,0.4)" }}
              >
                <div className="row row-between">
                  <h3 style={{ margin: 0 }}>
                    {CHALLENGE_REASON_LABELS[challenge.reason_code] ?? challenge.reason_code}
                  </h3>
                  <StatusBadge status={challenge.status} />
                </div>
                <p className="small dim" style={{ marginTop: "0.5rem" }}>
                  {challenge.statement.slice(0, 140)}
                  {challenge.statement.length > 140 ? "…" : ""}
                </p>
                <dl className="kv small">
                  <div>
                    <dt>Challenger</dt>
                    <dd className="mono">{shortenAddress(challenge.challenger)}</dd>
                  </div>
                  {challenge.competing_profile_id && (
                    <div>
                      <dt>Competing</dt>
                      <dd>{challenge.competing_profile_id}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Opened</dt>
                    <dd>{formatTimestamp(challenge.opened_at)}</dd>
                  </div>
                  <div>
                    <dt>Evidence</dt>
                    <dd>{challenge.evidence_refs.length} item(s)</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section aria-labelledby="resolved-h">
          <h2 id="resolved-h">Resolved disputes</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Reason</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Competing profile</th>
                  <th scope="col">Resolved</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((challenge) => (
                  <tr key={challenge.id}>
                    <td>
                      {CHALLENGE_REASON_LABELS[challenge.reason_code] ?? challenge.reason_code}
                    </td>
                    <td>
                      {challenge.resolution ? (
                        <StatusBadge status={challenge.resolution} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{challenge.competing_profile_id || "—"}</td>
                    <td className="small dim">{formatTimestamp(challenge.resolved_at)}</td>
                    <td>
                      <Link
                        className="btn btn-sm"
                        to={`/challenges/${encodeURIComponent(challenge.id)}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
