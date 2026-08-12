import { useId, useState } from "react";
import {
  CLAIM_TYPE_LABELS,
  bpsToPercent,
  formatTimestamp,
  shortenAddress,
} from "../types/proofmesh";
import type { CredentialRecord, IdentityClaim, IdentityProfile } from "../types/proofmesh";
import { StatusBadge } from "./ui";

/**
 * Flagship visual: the wallet/profile at the centre, each claimed public
 * identity as a connected proof node. Every edge encodes verification
 * status, and node styling encodes dispute/continuity state.
 *
 * All data is real contract state — nothing is seeded or simulated. A
 * table view is always available as an accessible equivalent, and the SVG
 * itself is marked up with role="img" plus a full text description.
 */

interface MeshProps {
  profile: IdentityProfile;
  claims: IdentityClaim[];
  credentials: CredentialRecord[];
}

/** Edge/node colour by claim verification progress. */
function claimTone(claim: IdentityClaim): { color: string; label: string } {
  switch (claim.status) {
    case "FROZEN":
      return { color: "var(--st-verified)", label: "Evidence frozen" };
    case "PROOF_SUBMITTED":
      return { color: "var(--st-recheck)", label: "Proof submitted" };
    case "CHALLENGE_ISSUED":
      return { color: "var(--st-pending)", label: "Challenge issued" };
    case "CHALLENGE_EXPIRED":
      return { color: "var(--st-challenged)", label: "Challenge expired" };
    default:
      return { color: "var(--st-stale)", label: "Pending" };
  }
}

const VIEWBOX = { w: 640, h: 420 };
const CENTER = { x: 320, y: 210 };
const RADIUS_X = 232;
const RADIUS_Y = 148;

export function IdentityMesh({ profile, claims, credentials }: MeshProps) {
  const [view, setView] = useState<"graph" | "table">("graph");
  const titleId = useId();
  const descId = useId();

  const activeCredential =
    credentials.find((c) => c.status === "ACTIVE") ??
    credentials.find((c) => c.status === "RECHECK_DUE") ??
    credentials[0];

  const disputed = credentials.some((c) => c.unresolved_challenges > 0);
  const confidence = activeCredential?.confidence_bps ?? 0;

  const nodes = claims.map((claim, i) => {
    // Distribute nodes evenly around the centre, starting at the top.
    const angle = (i / Math.max(1, claims.length)) * Math.PI * 2 - Math.PI / 2;
    return {
      claim,
      x: CENTER.x + Math.cos(angle) * RADIUS_X,
      y: CENTER.y + Math.sin(angle) * RADIUS_Y,
      tone: claimTone(claim),
    };
  });

  const description =
    `Identity mesh for profile ${profile.id}, owned by ${profile.owner}. ` +
    `${claims.length} identity claim${claims.length === 1 ? "" : "s"}: ` +
    nodes
      .map((n) => `${CLAIM_TYPE_LABELS[n.claim.claim_type]} (${n.tone.label})`)
      .join(", ") +
    (activeCredential
      ? `. Credential ${activeCredential.credential_type} is ${activeCredential.status} at ${bpsToPercent(confidence)} confidence.`
      : ". No credential issued yet.") +
    (disputed ? " There is at least one unresolved dispute." : "");

  return (
    <section className="stack" aria-labelledby="mesh-h">
      <div className="row row-between">
        <h2 id="mesh-h" style={{ margin: 0 }}>
          Identity Mesh
        </h2>
        <div className="view-toggle" role="group" aria-label="Identity mesh view">
          <button type="button" aria-pressed={view === "graph"} onClick={() => setView("graph")}>
            Graph
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            Table
          </button>
        </div>
      </div>

      {claims.length === 0 ? (
        <p className="note">
          No identity claims yet. Add a claim to start building this profile’s mesh.
        </p>
      ) : view === "graph" ? (
        <div className="mesh-wrap">
          <svg
            className="mesh-svg"
            viewBox={`0 0 ${VIEWBOX.w} ${VIEWBOX.h}`}
            role="img"
            aria-labelledby={`${titleId} ${descId}`}
          >
            <title id={titleId}>Identity mesh for profile {profile.id}</title>
            <desc id={descId}>{description}</desc>

            {/* Edges: wallet → each claimed identity source. */}
            {nodes.map((node) => (
              <g key={`edge-${node.claim.claim_id}`}>
                <line
                  x1={CENTER.x}
                  y1={CENTER.y}
                  x2={node.x}
                  y2={node.y}
                  stroke={node.tone.color}
                  strokeWidth={node.claim.status === "FROZEN" ? 2 : 1.25}
                  strokeDasharray={
                    node.claim.status === "FROZEN" || node.claim.status === "PROOF_SUBMITTED"
                      ? undefined
                      : "5 5"
                  }
                  opacity={0.75}
                />
              </g>
            ))}

            {/* Centre node: the wallet / profile. */}
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={46}
              fill="var(--deep-cyan)"
              stroke={disputed ? "var(--st-challenged)" : "var(--synapse-lime)"}
              strokeWidth={2.5}
            />
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={54}
              fill="none"
              stroke={disputed ? "var(--st-challenged)" : "var(--synapse-lime)"}
              strokeWidth={1}
              opacity={0.35}
            />
            <text
              className="mesh-center-label"
              x={CENTER.x}
              y={CENTER.y - 4}
              textAnchor="middle"
            >
              {profile.id.length > 14 ? `${profile.id.slice(0, 13)}…` : profile.id}
            </text>
            <text
              className="mesh-node-label"
              x={CENTER.x}
              y={CENTER.y + 12}
              textAnchor="middle"
            >
              {shortenAddress(profile.owner)}
            </text>

            {/* Claim nodes. */}
            {nodes.map((node) => {
              const anchor =
                node.x > CENTER.x + 20 ? "start" : node.x < CENTER.x - 20 ? "end" : "middle";
              const labelOffset = anchor === "start" ? 22 : anchor === "end" ? -22 : 0;
              return (
                <g key={node.claim.claim_id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={15}
                    fill="var(--surface-2)"
                    stroke={node.tone.color}
                    strokeWidth={2}
                  />
                  <circle cx={node.x} cy={node.y} r={5} fill={node.tone.color} />
                  <text
                    className="mesh-node-label"
                    x={node.x + labelOffset}
                    y={node.y - 22}
                    textAnchor={anchor}
                  >
                    {CLAIM_TYPE_LABELS[node.claim.claim_type]}
                  </text>
                  <text
                    className="mesh-node-label"
                    x={node.x + labelOffset}
                    y={node.y + 30}
                    textAnchor={anchor}
                    opacity={0.75}
                  >
                    {node.tone.label}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mesh-legend">
            <span>
              <i style={{ background: "var(--st-verified)" }} /> Evidence frozen
            </span>
            <span>
              <i style={{ background: "var(--st-recheck)" }} /> Proof submitted
            </span>
            <span>
              <i style={{ background: "var(--st-pending)" }} /> Challenge issued
            </span>
            <span>
              <i style={{ background: "var(--st-challenged)" }} /> Challenge expired
            </span>
            <span>
              <i style={{ background: "var(--st-stale)" }} /> Pending
            </span>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">
              Identity claims connected to profile {profile.id}
            </caption>
            <thead>
              <tr>
                <th scope="col">Identity source</th>
                <th scope="col">Claim</th>
                <th scope="col">Verification</th>
                <th scope="col">Last verified</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.claim.claim_id}>
                  <td>{CLAIM_TYPE_LABELS[node.claim.claim_type]}</td>
                  <td className="mono">{node.claim.claim_value}</td>
                  <td>
                    <StatusBadge status={node.claim.status} />
                  </td>
                  <td className="small dim">
                    {node.claim.last_verified_at
                      ? formatTimestamp(node.claim.last_verified_at)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeCredential && (
        <p className="small dim">
          Credential <strong>{activeCredential.credential_type}</strong> —{" "}
          <StatusBadge status={activeCredential.status} /> at{" "}
          <span className="mono">{bpsToPercent(confidence)}</span> confidence across{" "}
          {activeCredential.independent_signal_count} independent signal
          {activeCredential.independent_signal_count === 1 ? "" : "s"}.
          {disputed && " An unresolved dispute is open against this profile."}
        </p>
      )}
    </section>
  );
}
