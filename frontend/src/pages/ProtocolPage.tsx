import { useProtocolStatus } from "../features/contract/useProofMeshRead";
import { ErrorNote, PageHead, Stat } from "../components/ui";
import { PROOFMESH_CONTRACT_ADDRESS, studioNetChain } from "../lib/genlayer";
import {
  CHALLENGE_REASONS,
  CHALLENGE_REASON_LABELS,
  CLAIM_TYPES,
  CLAIM_TYPE_LABELS,
  CREDENTIAL_STATUS_DESCRIPTIONS,
  CREDENTIAL_TYPES,
  PROOF_TYPES,
  PROOF_TYPE_LABELS,
} from "../types/proofmesh";
import type { CredentialStatus } from "../types/proofmesh";

const LIFECYCLE = [
  ["Create identity profile", "An on-chain record owned by your wallet."],
  ["Add identity claims", "Each claim names one public source you say you control."],
  ["Issue verification challenges", "A unique nonce bound to your wallet, claim, and an expiry."],
  ["Publish proofs externally", "You post the challenge text at the claimed source yourself."],
  ["Submit proof references", "Record the exact proof URL and the issued challenge's SHA-256 digest."],
  ["Freeze the evidence set", "Locks claims and proofs so adjudication runs on a fixed record."],
  ["GenLayer identity evaluation", "Validators retrieve submitted proof URLs, require the exact challenge, and reach consensus."],
  ["Credential issued", "Purpose-specific, with confidence, signals, and cited evidence."],
  ["Continuity window", "Rechecks over time — trust decays rather than lasting forever."],
  ["Recheck, challenge, or expire", "Disputes are adjudicated; history is never erased."],
];

export default function ProtocolPage() {
  const status = useProtocolStatus();

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      <PageHead eyebrow="Protocol" title="How ProofMesh works">
        <p>
          ProofMesh is a reusable digital identity and trust-attestation primitive. This page
          documents the protocol's vocabulary and lifecycle — the same terms used throughout the
          contract and this interface.
        </p>
      </PageHead>

      <section aria-labelledby="live-h">
        <h2 id="live-h">Live protocol state</h2>
        {status.error && <ErrorNote error={status.error} />}
        <div className="grid grid-3">
          <Stat value={status.data?.profile_count ?? "…"} label="Profiles" />
          <Stat value={status.data?.claim_count ?? "…"} label="Claims" />
          <Stat value={status.data?.proof_count ?? "…"} label="Proofs" />
          <Stat value={status.data?.credential_count ?? "…"} label="Credentials" />
          <Stat value={status.data?.continuity_count ?? "…"} label="Continuity checks" />
          <Stat value={status.data?.identity_challenge_count ?? "…"} label="Disputes" />
        </div>
      </section>

      <section className="card" aria-labelledby="deploy-h">
        <h2 id="deploy-h">Deployment</h2>
        <dl className="kv">
          <div>
            <dt>Contract</dt>
            <dd>
              <code>{PROOFMESH_CONTRACT_ADDRESS}</code>
            </dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>
              {studioNetChain.name} (chain {studioNetChain.id})
            </dd>
          </div>
          <div>
            <dt>RPC</dt>
            <dd>
              <code>{studioNetChain.rpcUrls.default.http[0]}</code>
            </dd>
          </div>
          <div>
            <dt>Architecture</dt>
            <dd>Frontend + Intelligent Contract only — no backend, no database, no indexer.</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="lifecycle-h">
        <h2 id="lifecycle-h">Verification lifecycle</h2>
        <ol className="timeline">
          {LIFECYCLE.map(([title, detail]) => (
            <li key={title}>
              <div className="timeline-title">{title}</div>
              <div className="timeline-meta">{detail}</div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cred-status-h">
        <h2 id="cred-status-h">Credential states</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">State</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(CREDENTIAL_STATUS_DESCRIPTIONS) as CredentialStatus[]).map(
                (statusKey) => (
                  <tr key={statusKey}>
                    <td>
                      <span className={`badge st-${statusKey}`}>
                        {statusKey.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="small dim">{CREDENTIAL_STATUS_DESCRIPTIONS[statusKey]}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <p className="note note-info" style={{ marginTop: "1rem" }}>
          <strong>Revocation is deliberately conservative.</strong> A merely suspected ownership
          transfer, policy mismatch, or source conflict routes a credential to{" "}
          <em>CHALLENGED</em> — where the dispute system decides — rather than being revoked by a
          continuity check alone.
        </p>
      </section>

      <section aria-labelledby="vocab-h">
        <h2 id="vocab-h">Protocol vocabulary</h2>
        <div className="grid grid-2">
          <article className="card">
            <h3>Identity claim types</h3>
            <ul className="small dim" style={{ paddingLeft: "1.1rem", margin: 0 }}>
              {CLAIM_TYPES.map((type) => (
                <li key={type}>
                  <code>{type}</code> — {CLAIM_TYPE_LABELS[type]}
                </li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h3>Proof types</h3>
            <ul className="small dim" style={{ paddingLeft: "1.1rem", margin: 0 }}>
              {PROOF_TYPES.map((type) => (
                <li key={type}>
                  <code>{type}</code> — {PROOF_TYPE_LABELS[type]}
                </li>
              ))}
            </ul>
          </article>

          <article className="card">
            <h3>Credential types</h3>
            <ul className="small dim" style={{ paddingLeft: "1.1rem", margin: 0 }}>
              {CREDENTIAL_TYPES.map((type) => (
                <li key={type}>
                  <code>{type}</code>
                </li>
              ))}
            </ul>
            <p className="small faint" style={{ marginTop: "0.6rem" }}>
              Purpose-specific by design — there is no single generic "verified" badge.
            </p>
          </article>

          <article className="card">
            <h3>Challenge reasons</h3>
            <ul className="small dim" style={{ paddingLeft: "1.1rem", margin: 0 }}>
              {CHALLENGE_REASONS.map((reason) => (
                <li key={reason}>
                  <code>{reason}</code> — {CHALLENGE_REASON_LABELS[reason]}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="card" aria-labelledby="bounds-h">
        <h2 id="bounds-h">Boundaries</h2>
        <ul className="dim" style={{ paddingLeft: "1.1rem" }}>
          <li>ProofMesh does not perform legal KYC or assert government identity.</li>
          <li>
            It attests <em>demonstrated control</em> of public digital identities — nothing about
            legal personhood.
          </li>
          <li>
            It cannot publish on your behalf. You publish challenge text at your own sources;
            validators only read what is publicly there.
          </li>
          <li>
            Independence assessments are bounded — ProofMesh will say claims show low
            independence confidence, never that two wallets are definitely the same person.
          </li>
          <li>Historical credentials, transfers, disputes, and policy versions are never deleted.</li>
        </ul>
      </section>
    </div>
  );
}
