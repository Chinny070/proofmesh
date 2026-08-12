import { Link } from "react-router-dom";
import { useProtocolStatus } from "../features/contract/useProofMeshRead";
import { ErrorNote, Stat } from "../components/ui";
import { PROOFMESH_CONTRACT_ADDRESS } from "../lib/genlayer";

export default function HomePage() {
  const status = useProtocolStatus();

  return (
    <div className="stack" style={{ gap: "2rem" }}>
      <section>
        <p className="eyebrow">Reusable digital trust infrastructure for GenLayer</p>
        <h1 style={{ maxWidth: "18ch" }}>
          Prove control. Preserve continuity. Resolve conflicts.
        </h1>
        <p className="dim" style={{ maxWidth: "62ch", fontSize: "1.05rem" }}>
          ProofMesh lets a wallet prove control over multiple public identity signals, evaluates
          whether those signals are coherent and current, and issues purpose-specific on-chain
          credentials that any GenLayer application can query.
        </p>
        <div className="row" style={{ marginTop: "1rem" }}>
          <Link className="btn btn-primary" to="/identity/new">
            Create identity profile
          </Link>
          <Link className="btn" to="/identity">
            Browse identities
          </Link>
          <Link className="btn" to="/policies">
            Trust Policy Explorer
          </Link>
        </div>
        <p className="small faint" style={{ marginTop: "0.75rem" }}>
          Not legal KYC. ProofMesh attests demonstrated control of public digital identities —
          it makes no claim about legal personhood or government identity.
        </p>
      </section>

      <section aria-labelledby="protocol-h">
        <h2 id="protocol-h">Live protocol state</h2>
        {status.error && <ErrorNote error={status.error} />}
        <div className="grid grid-3">
          <Stat
            value={status.isLoading ? "…" : (status.data?.profile_count ?? 0)}
            label="Identity profiles"
          />
          <Stat
            value={status.isLoading ? "…" : (status.data?.claim_count ?? 0)}
            label="Identity claims"
          />
          <Stat
            value={status.isLoading ? "…" : (status.data?.proof_count ?? 0)}
            label="Proofs submitted"
          />
          <Stat
            value={status.isLoading ? "…" : (status.data?.credential_count ?? 0)}
            label="Credentials issued"
          />
          <Stat
            value={status.isLoading ? "…" : (status.data?.identity_challenge_count ?? 0)}
            label="Identity challenges"
          />
          <Stat
            value={status.isLoading ? "…" : (status.data?.trust_policy_count ?? 0)}
            label="Trust policies"
          />
        </div>
        <p className="small faint" style={{ marginTop: "0.75rem" }}>
          Read live from <code>{PROOFMESH_CONTRACT_ADDRESS}</code> on GenLayer StudioNet.
        </p>
      </section>

      <section aria-labelledby="how-h">
        <h2 id="how-h">How verification works</h2>
        <div className="grid grid-2">
          <article className="card">
            <p className="section-label">1 · Multi-source claims</p>
            <h3>One post is not identity</h3>
            <p className="dim">
              Claim a GitHub profile, an X account, a personal site, a project page — as many
              public signals as you control. ProofMesh weighs them together, not in isolation.
            </p>
          </article>
          <article className="card">
            <p className="section-label">2 · Challenge-based proof</p>
            <h3>Fresh, wallet-bound challenges</h3>
            <p className="dim">
              Each claim gets a unique challenge tied to your wallet, a nonce, and an expiry. You
              publish it at the claimed source; proofs that predate the challenge are rejected.
            </p>
          </article>
          <article className="card">
            <p className="section-label">3 · GenLayer adjudication</p>
            <h3>Validators judge the evidence</h3>
            <p className="dim">
              Evidence is frozen, then evaluated by GenLayer's leader/validator consensus over
              live retrieved sources — producing a purpose-specific credential with a confidence
              score and cited evidence.
            </p>
          </article>
          <article className="card">
            <p className="section-label">4 · Continuity &amp; disputes</p>
            <h3>Trust decays and can be contested</h3>
            <p className="dim">
              Credentials are rechecked over time, and a competing wallet can open a dispute.
              Outcomes — upheld, transferred, revoked, or re-verify — are adjudicated on-chain
              and never erase history.
            </p>
          </article>
        </div>
      </section>

      <section aria-labelledby="reuse-h" className="card card-lift">
        <h2 id="reuse-h">Built to be reused</h2>
        <p className="dim" style={{ maxWidth: "60ch" }}>
          Other GenLayer applications don't integrate with ProofMesh's internals — they ask a
          single deterministic question against a versioned trust policy:{" "}
          <em>does this wallet's credential satisfy these requirements?</em>
        </p>
        <Link className="btn" to="/policies">
          See trust policies
        </Link>
      </section>
    </div>
  );
}
