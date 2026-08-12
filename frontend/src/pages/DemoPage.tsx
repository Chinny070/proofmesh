import { Link } from "react-router-dom";
import { useWallet } from "../features/wallet/useWallet";
import {
  useCredentials,
  useProfiles,
  useProtocolStatus,
  useTrustPolicies,
} from "../features/contract/useProofMeshRead";
import { PageHead, StatusBadge } from "../components/ui";
import { PROOFMESH_CONTRACT_ADDRESS } from "../lib/genlayer";

/**
 * Guided walkthrough of the real ProofMesh sequence.
 *
 * Every step's "state" is derived from actual contract reads — a step is
 * only marked done when chain state proves it. Nothing here fabricates a
 * credential, verdict, or dispute. Where there is no real data yet, the
 * step explains what the user must do instead of showing invented results.
 */

interface Step {
  n: number;
  title: string;
  body: React.ReactNode;
  /** Where the user actually performs this step. */
  to?: string;
  toLabel?: string;
  /** Derived from real contract state, or undefined if not trackable. */
  done?: boolean;
}

export default function DemoPage() {
  const wallet = useWallet();
  const status = useProtocolStatus();
  const profiles = useProfiles();
  const credentials = useCredentials();
  const policies = useTrustPolicies();

  const myProfiles = wallet.address
    ? (profiles.data ?? []).filter(
        (p) => p.owner.toLowerCase() === wallet.address!.toLowerCase(),
      )
    : [];
  const myProfile = myProfiles[0];
  const profilePath = myProfile ? `/identity/${encodeURIComponent(myProfile.id)}` : "/identity/new";

  const myCredentials = myProfile
    ? (credentials.data ?? []).filter((c) => c.profile_id === myProfile.id)
    : [];
  const issuedCredential = myCredentials[0];

  const s = status.data;

  const steps: Step[] = [
    {
      n: 1,
      title: "Connect your wallet",
      done: Boolean(wallet.address) && !wallet.isWrongNetwork,
      to: "/account",
      toLabel: "Go to Account",
      body: (
        <>
          <p>
            ProofMesh has no accounts of its own — your wallet <em>is</em> your identity. You'll
            need an injected browser wallet on GenLayer StudioNet (chain 61999).
          </p>
          {wallet.connectionState === "unavailable" && (
            <p className="note note-warn">
              No injected wallet is available in this browser. Every read on this site still
              works, but you can't complete the write steps below without one.
            </p>
          )}
          {wallet.isWrongNetwork && (
            <p className="note note-warn">
              Your wallet is connected but on the wrong network. Switch to StudioNet to continue.
            </p>
          )}
        </>
      ),
    },
    {
      n: 2,
      title: "Create an identity profile",
      done: Boolean(myProfile),
      to: "/identity/new",
      toLabel: "Create profile",
      body: (
        <p>
          A profile is the on-chain record everything else hangs off — claims, proofs,
          credentials, disputes. It's owned by the wallet that creates it, and only that wallet
          can add claims or submit proofs to it.
        </p>
      ),
    },
    {
      n: 3,
      title: "Add a GitHub claim",
      done: Boolean(myProfile && myProfile.claim_count > 0),
      to: myProfile ? `${profilePath}/claims` : undefined,
      toLabel: "Open Claim Wizard",
      body: (
        <p>
          Claim the GitHub profile you control by entering its public URL. This is a{" "}
          <em>claim</em>, not proof — nothing is verified yet.
        </p>
      ),
    },
    {
      n: 4,
      title: "Add a second, independent claim",
      done: Boolean(myProfile && myProfile.claim_count > 1),
      to: myProfile ? `${profilePath}/claims` : undefined,
      toLabel: "Add another claim",
      body: (
        <>
          <p>
            This is the point of ProofMesh. One account can be bought, borrowed, or compromised —
            so add a genuinely independent second source: a personal website, an X profile, a
            project team page.
          </p>
          <p className="small faint">
            Independent sources raise confidence and unlock the higher-tier credential types.
            Two copies of the same site do not.
          </p>
        </>
      ),
    },
    {
      n: 5,
      title: "Issue a verification challenge",
      to: myProfile ? `${profilePath}/claims` : undefined,
      toLabel: "Issue challenge",
      body: (
        <>
          <p>
            ProofMesh generates a unique message bound to your wallet address, that specific
            claim, a random nonce, and a 24-hour expiry:
          </p>
          <code className="challenge-text">
            PROOFMESH|PROFILE:…|CLAIM:…|WALLET:0x…|NONCE:…|EXP:…
          </code>
          <p className="small faint">
            Illustrative shape only — your real challenge text is returned by the transaction
            when you issue it.
          </p>
        </>
      ),
    },
    {
      n: 6,
      title: "Publish the challenge externally",
      to: myProfile ? `${profilePath}/claims` : undefined,
      toLabel: "Back to wizard",
      body: (
        <>
          <p className="note note-warn">
            <strong>You do this part yourself.</strong> ProofMesh cannot post to GitHub, X, or
            your website on your behalf, and does not ask for any platform credentials. Publish
            the challenge text publicly — a gist, a profile bio, a post, a page on your site.
          </p>
          <p>
            Because the challenge is bound to your wallet and carries an expiry, a copied or
            pre-existing post won't pass: proofs that predate the challenge are rejected.
          </p>
        </>
      ),
    },
    {
      n: 7,
      title: "Submit your proof",
      to: myProfile ? `${profilePath}/claims` : undefined,
      toLabel: "Submit proof",
      body: (
        <p>
          Record where the challenge is published and a SHA-256 hash of exactly what you
          observed. The hash commits you to that content, so evidence can't be swapped later. The
          wizard can compute it in your browser — the text never leaves your machine.
        </p>
      ),
    },
    {
      n: 8,
      title: "Freeze the evidence set",
      done: Boolean(myProfile && myProfile.status !== "ACTIVE"),
      to: myProfile ? `${profilePath}/claims` : undefined,
      toLabel: "Freeze evidence",
      body: (
        <p>
          Freezing locks your claims and proofs into an immutable set. Adjudication then runs
          against a fixed record — you can't add favourable evidence mid-evaluation, and
          validators all judge the same thing.
        </p>
      ),
    },
    {
      n: 9,
      title: "Trigger identity evaluation",
      done: Boolean(myProfile && myProfile.credential_count > 0),
      to: myProfile ? `${profilePath}/claims` : undefined,
      toLabel: "Run evaluation",
      body: (
        <>
          <p>
            This is the step a normal smart contract can't do. GenLayer validators independently
            fetch each claimed source, check whether the challenge is actually there, judge
            whether the sources corroborate each other, and reach consensus on a verdict.
          </p>
          <p className="small faint">
            Expect this to take longer than a plain transaction — it involves live web retrieval
            and validator agreement, not just a state write.
          </p>
        </>
      ),
    },
    {
      n: 10,
      title: "Inspect the credential",
      done: Boolean(issuedCredential),
      to: myProfile ? `${profilePath}/credentials` : undefined,
      toLabel: "View credentials",
      body: (
        <>
          <p>
            A successful evaluation issues a purpose-specific credential — not a generic
            "verified" badge — carrying a confidence score in basis points, the number of
            independent signals, machine-readable reason codes, and citations to the exact
            evidence used.
          </p>
          {issuedCredential ? (
            <div className="note note-ok">
              <strong>Your live credential</strong>
              <dl className="kv small" style={{ marginTop: "0.5rem" }}>
                <div>
                  <dt>Type</dt>
                  <dd>{issuedCredential.credential_type.replace(/_/g, " ")}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusBadge status={issuedCredential.status} />
                  </dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{(issuedCredential.confidence_bps / 100).toFixed(2)}%</dd>
                </div>
                <div>
                  <dt>Signals</dt>
                  <dd>{issuedCredential.independent_signal_count}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="note">
              No credential to show yet — this panel fills in with your real credential once an
              evaluation succeeds. It never displays sample data.
            </p>
          )}
        </>
      ),
    },
    {
      n: 11,
      title: "Request a continuity check",
      to: myProfile ? `${profilePath}/continuity` : undefined,
      toLabel: "Open Continuity",
      body: (
        <>
          <p>
            Verification shouldn't last forever. After the recheck interval, <em>anyone</em> can
            trigger a continuity check — it re-fetches the same sources and asks whether the
            credential is still trustworthy. No backend scheduler exists or is needed.
          </p>
          <p className="small faint">
            Outcomes: still valid, recheck due, stale, or — if ownership looks like it changed —
            the credential is moved to <StatusBadge status="CHALLENGED" /> for dispute
            resolution rather than being silently revoked.
          </p>
        </>
      ),
    },
    {
      n: 12,
      title: "Open a competing claim",
      to: "/challenges",
      toLabel: "Open Conflict Court",
      body: (
        <>
          <p>
            Now the hard case: a second wallet claims the same identity. It creates its own
            profile, claims the same source, and opens a dispute with reason{" "}
            <code>CONFLICTING_WALLET_CLAIM</code>. The disputed credential locks immediately.
          </p>
          <p className="small faint">
            Opening a dispute doesn't revoke anything — it freezes the question until
            adjudication answers it.
          </p>
        </>
      ),
    },
    {
      n: 13,
      title: "Submit conflict evidence and adjudicate",
      to: "/challenges",
      toLabel: "Conflict Court",
      body: (
        <>
          <p>
            Both sides attach proof records, the dispute evidence is frozen, and validators fetch
            both sides' sources live before deciding one of four outcomes:
          </p>
          <ul className="chips" style={{ marginTop: "0.5rem" }}>
            <li className="chip st-UPHOLD">UPHOLD</li>
            <li className="chip st-TRANSFER">TRANSFER</li>
            <li className="chip st-REVOKE">REVOKE</li>
            <li className="chip st-REQUIRE_REVERIFICATION">REQUIRE_REVERIFICATION</li>
          </ul>
          <p style={{ marginTop: "0.75rem" }}>
            On a <strong>TRANSFER</strong>, the original credential is not deleted — it's marked{" "}
            <StatusBadge status="TRANSFERRED" /> and stays permanently queryable, while a new
            credential is issued to the new controller. The history of who held what, and when,
            survives.
          </p>
        </>
      ),
    },
    {
      n: 14,
      title: "Create and evaluate a trust policy",
      done: (s?.trust_policy_count ?? 0) > 0,
      to: "/policies",
      toLabel: "Trust Policy Explorer",
      body: (
        <p>
          Define reusable requirements — minimum confidence, minimum independent signals, whether
          continuity must be current, whether disputes are disqualifying, and which identity
          sources count. Then evaluate any credential against it deterministically, with no LLM
          involved at query time.
        </p>
      ),
    },
    {
      n: 15,
      title: "Show third-party integration",
      to: "/integration",
      toLabel: "Open Integration Hub",
      body: (
        <>
          <p>
            The final proof that this is infrastructure rather than an app: another GenLayer
            project reads the contract directly and asks one question —{" "}
            <em>does this wallet satisfy this policy?</em> — with no ProofMesh frontend involved.
          </p>
          <code className="challenge-text" style={{ color: "var(--mesh-lilac)", borderColor: "var(--hairline-strong)" }}>
            {PROOFMESH_CONTRACT_ADDRESS}
            {"\n"}evaluate_policy_view(profile_id, policy_id, credential_id)
          </code>
        </>
      ),
    },
  ];

  const completed = steps.filter((step) => step.done).length;
  const trackable = steps.filter((step) => step.done !== undefined).length;

  return (
    <div className="stack" style={{ gap: "1.75rem" }}>
      <PageHead eyebrow="Guided demo" title="The full ProofMesh lifecycle">
        <p>
          Fifteen steps from an empty wallet to a credential another application can act on. Each
          step links to where you actually perform it — this page guides, it doesn't fake
          anything.
        </p>
      </PageHead>

      <p className="note note-info">
        <strong>Progress below is read from live chain state.</strong> Steps tick off only when
        the contract proves they happened. Where you have no data yet, panels say so rather than
        showing invented credentials or verdicts.
        {trackable > 0 && (
          <>
            {" "}
            Currently <strong>{completed} of {trackable}</strong> automatically-verifiable steps
            complete.
          </>
        )}
      </p>

      {!wallet.address && (
        <p className="note note-warn">
          No wallet connected, so no step can be completed. You can still read every page and
          inspect real protocol state.
        </p>
      )}

      <ol className="demo-steps">
        {steps.map((step) => (
          <li key={step.n} data-done={step.done ? "true" : undefined} className="card">
            <div className="row row-between" style={{ alignItems: "flex-start" }}>
              <div className="row" style={{ gap: "0.6rem", alignItems: "center" }}>
                <span className="demo-num" aria-hidden="true">
                  {step.done ? "✓" : step.n}
                </span>
                <h2 style={{ margin: 0, fontSize: "1.075rem" }}>
                  {step.title}
                  {step.done && <span className="visually-hidden"> (completed)</span>}
                </h2>
              </div>
              {step.to && (
                <Link className="btn btn-sm" to={step.to}>
                  {step.toLabel ?? "Go"}
                </Link>
              )}
            </div>
            <div className="demo-body">{step.body}</div>
          </li>
        ))}
      </ol>

      <section className="card" aria-labelledby="after-h">
        <h2 id="after-h">What this proves</h2>
        <p className="dim" style={{ maxWidth: "62ch" }}>
          By the end of this sequence a wallet has demonstrated control of multiple independent
          public identities, received a credential with a defensible confidence score and cited
          evidence, had that credential rechecked over time, survived (or lost) a contested
          ownership claim with the full history preserved, and exposed the result through a
          reusable policy any other GenLayer application can query.
        </p>
        <p className="dim">
          That is the difference between a social verification toy and reusable trust
          infrastructure.
        </p>
        <div className="row">
          <Link className="btn btn-primary" to="/integration">
            Integration Hub
          </Link>
          <Link className="btn" to="/protocol">
            Protocol reference
          </Link>
        </div>
      </section>

      <p className="small faint">
        Live counters: {policies.data?.length ?? "…"} trust policies ·{" "}
        {credentials.data?.length ?? "…"} credentials · {profiles.data?.length ?? "…"} profiles on
        this deployment.
      </p>
    </div>
  );
}
