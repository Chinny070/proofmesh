import { useState } from "react";
import { Link } from "react-router-dom";
import { PROOFMESH_CONTRACT_ADDRESS, studioNetChain } from "../lib/genlayer";
import {
  useCredentials,
  useProtocolStatus,
  useTrustPolicies,
} from "../features/contract/useProofMeshRead";
import { ErrorNote, PageHead, StatusBadge } from "../components/ui";

/** Small copy-to-clipboard code block. */
function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="codeblock">
      <div className="row row-between codeblock-head">
        {label && <span className="section-label" style={{ margin: 0 }}>{label}</span>}
        <button type="button" className="btn btn-sm" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

const READ_CATEGORIES = [
  {
    title: "Identity",
    methods: [
      ["get_identity_profile(profile_id)", "Full profile record"],
      ["get_identity_status(profile_id)", "Aggregate summary incl. claim/credential IDs"],
      ["list_profiles()", "Every profile on the deployment"],
      ["get_identity_claim(claim_id)", "One claimed identity source"],
      ["get_profile_claim_ids(profile_id)", "Claim IDs for a profile"],
      ["get_identity_proof(proof_id)", "One submitted proof record"],
      ["get_claim_proof_ids(claim_id)", "Proof IDs for a claim"],
    ],
  },
  {
    title: "Credentials",
    methods: [
      ["get_credential(credential_id)", "Full credential record"],
      ["list_credentials()", "Every credential, all statuses"],
      ["get_profile_credential_ids(profile_id)", "Credential IDs for a profile"],
    ],
  },
  {
    title: "Continuity",
    methods: [
      ["get_continuity_status(profile_id)", "Current continuity state string"],
      ["get_continuity_record(continuity_id)", "One continuity check result"],
      ["get_credential_continuity_ids(credential_id)", "Full check history"],
    ],
  },
  {
    title: "Disputes",
    methods: [
      ["get_identity_challenge(challenge_id)", "Full dispute record incl. resolution"],
      ["get_credential_challenge_ids(credential_id)", "Dispute history for a credential"],
    ],
  },
  {
    title: "Trust policies",
    methods: [
      ["get_trust_policy(policy_id)", "Full policy record"],
      ["get_trust_policy_versions(name)", "Every version ID under a policy name"],
      ["list_trust_policies()", "Every policy, all versions"],
      ["evaluate_policy_view(profile_id, policy_id, credential_id)", "Deterministic policy check"],
    ],
  },
  {
    title: "Protocol",
    methods: [["get_protocol_status()", "Counters across every record type"]],
  },
];

const WRITE_CATEGORIES = [
  ["Identity setup", ["create_identity_profile", "add_identity_claim", "issue_verification_challenge"]],
  ["Evidence", ["submit_identity_proof", "freeze_identity_evaluation"]],
  ["Adjudication", ["evaluate_identity"]],
  ["Continuity", ["request_continuity_check", "evaluate_continuity"]],
  ["Disputes", ["open_identity_challenge", "submit_challenge_evidence", "freeze_identity_challenge", "evaluate_identity_challenge"]],
  ["Policies", ["create_trust_policy"]],
] as const;

export default function IntegrationPage() {
  const status = useProtocolStatus();
  const policies = useTrustPolicies();
  const credentials = useCredentials();

  const samplePolicy = policies.data?.find((p) => p.status === "ACTIVE");
  const sampleCredential = credentials.data?.[0];

  const policyIdSample = samplePolicy?.id ?? "<policy_id>";
  const profileIdSample = sampleCredential?.profile_id ?? "<profile_id>";
  const credentialIdSample = sampleCredential?.id ?? "<credential_id>";

  return (
    <div className="stack" style={{ gap: "2rem" }}>
      <PageHead eyebrow="Integration Hub" title="Build on ProofMesh">
        <p>
          ProofMesh is infrastructure, not an app you have to adopt. Any GenLayer project can
          read credentials and evaluate trust policies directly against the deployed contract —
          no ProofMesh frontend, no SDK of ours, no backend in between.
        </p>
      </PageHead>

      {/* -- Deployment -- */}
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
            <dd>{studioNetChain.name}</dd>
          </div>
          <div>
            <dt>Chain ID</dt>
            <dd>
              <code>{studioNetChain.id}</code>
            </dd>
          </div>
          <div>
            <dt>RPC</dt>
            <dd>
              <code>{studioNetChain.rpcUrls.default.http[0]}</code>
            </dd>
          </div>
          <div>
            <dt>Schema</dt>
            <dd>
              33 methods — 13 write, 20 view. The full deployed schema, fetched from the contract
              itself, is committed at <code>docs/deployed-schema.json</code>.
            </dd>
          </div>
          <div>
            <dt>Live state</dt>
            <dd>
              {status.data
                ? `${status.data.profile_count} profiles · ${status.data.credential_count} credentials · ${status.data.trust_policy_count} policies`
                : "loading…"}
            </dd>
          </div>
        </dl>
        {status.error && <ErrorNote error={status.error} />}
      </section>

      {/* -- The core question -- */}
      <section className="card card-lift" aria-labelledby="core-h">
        <p className="eyebrow">The question ProofMesh answers</p>
        <h2 id="core-h">Does wallet/profile X satisfy policy Y?</h2>
        <p className="dim">
          One deterministic read. No LLM runs at query time — every field compared is
          already-finalized on-chain state, so the same inputs always produce the same answer.
        </p>

        <CodeBlock
          label="Any GenLayer app — genlayer-js"
          code={`import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const client = createClient({ chain: studionet });

const raw = await client.readContract({
  address: "${PROOFMESH_CONTRACT_ADDRESS}",
  functionName: "evaluate_policy_view",
  args: ["${profileIdSample}", "${policyIdSample}", "${credentialIdSample}"],
});

const result = JSON.parse(raw);
// {
//   satisfied: boolean,
//   policy_id, profile_id, credential_id, credential_type,
//   confidence_bps, independent_signal_count,
//   continuity_current, active_challenge,
//   failure_reasons: string[]
// }

if (result.satisfied) grantAccess();
else showReasons(result.failure_reasons);`}
        />

        <p className="note note-info">
          <strong>failure_reasons is never short-circuited.</strong> Every applicable check runs,
          so one call tells you everything that failed — not just the first thing.
        </p>
      </section>

      {/* -- Query examples by category -- */}
      <section aria-labelledby="queries-h">
        <h2 id="queries-h">Query examples</h2>

        <div className="stack">
          <article className="card">
            <h3>Credential queries</h3>
            <p className="dim small">
              Read a wallet's credential state directly — type, confidence, signals, status,
              expiry, and any unresolved dispute count.
            </p>
            <CodeBlock
              code={`// All credentials held by a profile
const ids = JSON.parse(await read("get_profile_credential_ids", ["${profileIdSample}"]));

// One credential in full
const cred = JSON.parse(await read("get_credential", [ids[0]]));

const usable =
  cred.status === "ACTIVE" &&
  cred.confidence_bps >= 8000 &&
  cred.unresolved_challenges === 0 &&
  new Date(cred.expires_at) > new Date();`}
            />
          </article>

          <article className="card">
            <h3>Trust-policy queries</h3>
            <p className="dim small">
              Policies are versioned. Pin a specific <code>policy_id</code> and your gate keeps
              behaving identically even after the policy is superseded.
            </p>
            <CodeBlock
              code={`// Discover policies
const policies = JSON.parse(await read("list_trust_policies", []));
const active = policies.filter(p => p.status === "ACTIVE");

// Every version ever published under a name
const versions = JSON.parse(
  await read("get_trust_policy_versions", ["VERIFIED_DEVELOPER_V2"])
);

// A superseded version still evaluates — it reports POLICY_INACTIVE
// rather than silently redirecting to a newer version.`}
            />
          </article>

          <article className="card">
            <h3>Continuity queries</h3>
            <p className="dim small">
              Verification decays. Check whether a credential has been rechecked recently, and
              what the last check concluded.
            </p>
            <CodeBlock
              code={`const cred = JSON.parse(await read("get_credential", ["${credentialIdSample}"]));

// Never checked, or checked long ago?
const lastCheck = cred.last_continuity_check || null;

// Full check history for this credential
const historyIds = JSON.parse(
  await read("get_credential_continuity_ids", ["${credentialIdSample}"])
);
const checks = await Promise.all(
  historyIds.map(async id =>
    JSON.parse(await read("get_continuity_record", [id]))
  )
);
// each: { status, continuity_risk_bps, reason_codes, summary, evaluated_at }`}
            />
          </article>

          <article className="card">
            <h3>Challenge / dispute queries</h3>
            <p className="dim small">
              Ownership conflicts are public and adjudicated on-chain. History is never erased —
              after a transfer, both the old and new controller records remain queryable.
            </p>
            <CodeBlock
              code={`const disputeIds = JSON.parse(
  await read("get_credential_challenge_ids", ["${credentialIdSample}"])
);

for (const id of disputeIds) {
  const d = JSON.parse(await read("get_identity_challenge", [id]));
  // d.status: OPEN | FROZEN | RESOLVED
  // d.resolution: UPHOLD | TRANSFER | REVOKE | REQUIRE_REVERIFICATION
  // d.competing_profile_id, d.evidence_refs, d.summary
}

// Gate on unresolved disputes without reading each one:
const cred = JSON.parse(await read("get_credential", ["${credentialIdSample}"]));
const contested = cred.unresolved_challenges > 0;`}
            />
          </article>
        </div>
      </section>

      {/* -- Method inventory -- */}
      <section aria-labelledby="methods-h">
        <h2 id="methods-h">Method inventory</h2>
        <p className="dim">
          20 read methods and 13 write methods. Reads need no wallet; writes go through GenLayer
          consensus.
        </p>

        <div className="grid grid-2">
          {READ_CATEGORIES.map((category) => (
            <article className="card" key={category.title}>
              <h3>{category.title}</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">View</th>
                      <th scope="col">Returns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.methods.map(([name, desc]) => (
                      <tr key={name}>
                        <td className="mono small">{name}</td>
                        <td className="small dim">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>

        <article className="card" style={{ marginTop: "1rem" }}>
          <h3>Write methods</h3>
          <div className="grid grid-3">
            {WRITE_CATEGORIES.map(([title, methods]) => (
              <div key={title}>
                <p className="section-label">{title}</p>
                <ul className="chips" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                  {methods.map((m) => (
                    <li className="chip" key={m}>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* -- Use cases -- */}
      <section aria-labelledby="usecases-h">
        <h2 id="usecases-h">Integration patterns</h2>
        <p className="dim" style={{ maxWidth: "62ch" }}>
          Three realistic external systems, each using only the generic contract methods. None of
          these use cases are hard-coded into ProofMesh — they are policy configurations plus a
          read, nothing more.
        </p>

        <div className="stack">
          <article className="card">
            <p className="section-label">Use case 1 · Grant platform</p>
            <h3>Only fund verified developers</h3>
            <p className="dim small">
              A grants program requires a <code>VERIFIED_DEVELOPER</code> credential at ≥80%
              confidence, backed by at least two independent sources, with current continuity and
              no open dispute.
            </p>
            <CodeBlock
              label="Set the policy up once"
              code={`// One-time: publish the policy (any wallet can)
await write("create_trust_policy", [
  "GRANTS_VERIFIED_DEVELOPER_V1",
  "VERIFIED_DEVELOPER",
  8000,                 // minimum_confidence_bps
  2,                    // minimum_independent_signals
  true,                 // require_no_active_challenge
  true,                 // require_current_continuity
  ["GITHUB_PROFILE", "PERSONAL_WEBSITE", "X_PROFILE"],
]);`}
            />
            <CodeBlock
              label="Gate each applicant"
              code={`async function isEligibleForGrant(profileId, credentialId) {
  const r = JSON.parse(await read("evaluate_policy_view", [
    profileId, GRANTS_POLICY_ID, credentialId,
  ]));
  return { eligible: r.satisfied, reasons: r.failure_reasons };
}`}
            />
          </article>

          <article className="card">
            <p className="section-label">Use case 2 · Hackathon / community system</p>
            <h3>Require a current, uncontested identity</h3>
            <p className="dim small">
              A community platform cares less about developer credentials and more that the
              identity is <em>current</em> — not stale, not under dispute. Lower confidence bar,
              broader accepted sources.
            </p>
            <CodeBlock
              code={`await write("create_trust_policy", [
  "COMMUNITY_CURRENT_IDENTITY_V1",
  "BASIC_COMMUNITY_MEMBER",
  6000,   // lower bar than a grants program
  1,      // a single corroborated source is enough here
  true,   // still refuse contested identities
  true,   // must be currently valid, not RECHECK_DUE
  ["X_PROFILE", "COMMUNITY_PROFILE", "PERSONAL_WEBSITE"],
]);

// At registration:
const r = JSON.parse(await read("evaluate_policy_view", [
  profileId, COMMUNITY_POLICY_ID, credentialId,
]));

if (!r.satisfied && r.failure_reasons.includes("CONTINUITY_NOT_CURRENT")) {
  promptUser("Your verification needs a refresh before you can register.");
}`}
            />
          </article>

          <article className="card">
            <p className="section-label">Use case 3 · Agent / developer marketplace</p>
            <h3>High confidence, zero open disputes</h3>
            <p className="dim small">
              A marketplace listing agents or contractors needs a strong signal and must react
              immediately when an identity becomes contested — a listing should drop the moment a
              dispute opens, without waiting for adjudication.
            </p>
            <CodeBlock
              code={`await write("create_trust_policy", [
  "MARKETPLACE_HIGH_TRUST_V1",
  "VERIFIED_DEVELOPER",
  9000,   // high confidence bar
  3,      // three independent sources
  true,
  true,
  ["GITHUB_PROFILE", "PERSONAL_WEBSITE", "PROJECT_WEBSITE", "ORG_PAGE"],
]);

async function refreshListing(listing) {
  const r = JSON.parse(await read("evaluate_policy_view", [
    listing.profileId, MARKETPLACE_POLICY_ID, listing.credentialId,
  ]));

  // Suspend on any open dispute, before adjudication concludes.
  if (r.active_challenge) return suspend(listing, "identity under dispute");
  if (!r.satisfied) return suspend(listing, r.failure_reasons.join(", "));
  return publish(listing);
}`}
            />
            <p className="note note-info">
              Because ownership can legitimately <strong>transfer</strong>, a marketplace should
              re-read the profile's credential IDs periodically rather than caching one
              <code>credential_id</code> forever — after a TRANSFER outcome the new controller
              holds a <em>new</em> credential, and the old one is preserved as{" "}
              <StatusBadge status="TRANSFERRED" />.
            </p>
          </article>
        </div>
      </section>

      {/* -- Finality -- */}
      <section className="card" aria-labelledby="finality-h">
        <h2 id="finality-h">Transaction and finality guidance</h2>
        <p className="note note-warn">
          <strong>A transaction hash is not success.</strong> Receiving a hash means the
          transaction was submitted — nothing more. It may still fail, be rejected by consensus,
          or finalize with a failed contract execution.
        </p>
        <p className="dim">
          Success requires two conditions together: the transaction reaches{" "}
          <code>FINALIZED</code>, <em>and</em> its execution result is{" "}
          <code>FINISHED_WITH_RETURN</code>. ProofMesh's own UI models this as an explicit
          12-state machine and never reports success early.
        </p>
        <CodeBlock
          label="Correct write + finality handling"
          code={`import { TransactionStatus, ExecutionResult } from "genlayer-js/types";

const hash = await client.writeContract({
  address: "${PROOFMESH_CONTRACT_ADDRESS}",
  functionName: "create_identity_profile",
  args: ["my-profile"],
  value: 0n,
});
// hash alone proves nothing yet.

const receipt = await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.FINALIZED,
  interval: 3000,
  retries: 60,
});

const succeeded =
  receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_RETURN;

if (!succeeded) {
  // Finalized, but the contract rejected it. Nothing was written.
  throw new Error("Contract execution failed");
}`}
        />
        <p className="dim small">
          Nondeterministic methods — <code>evaluate_identity</code>,{" "}
          <code>evaluate_continuity</code>, <code>evaluate_identity_challenge</code> — retrieve
          live web sources and run validator consensus, so they take meaningfully longer than a
          plain state write. Budget for that in your polling.
        </p>
      </section>

      {/* -- Adapter pattern -- */}
      <section className="card" aria-labelledby="adapter-h">
        <h2 id="adapter-h">The adapter pattern this app uses</h2>
        <p className="dim">
          ProofMesh's own frontend isolates every raw genlayer-js call behind a typed adapter, so
          page code never touches the SDK. The same shape works in any consuming app.
        </p>
        <CodeBlock
          code={`// lib/genlayer/contract.ts — single read/write funnel
const CONTRACT = "${PROOFMESH_CONTRACT_ADDRESS}";

async function read(functionName: string, args: CalldataEncodable[] = []) {
  const client = getReadClient();               // no wallet needed
  return (await client.readContract({
    address: CONTRACT, functionName, args,
  })) as string;                                 // every view returns JSON
}

export const reads = {
  getCredential:      (id: string) => read("get_credential", [id]),
  listTrustPolicies:  ()           => read("list_trust_policies"),
  evaluatePolicyView: (p: string, pol: string, c: string) =>
    read("evaluate_policy_view", [p, pol, c]),
  // …20 views total
};`}
        />
        <p className="small faint">
          Every deployed view returns a JSON-encoded <code>string</code> — parse it, don't expect
          a decoded object.
        </p>
      </section>

      <section className="card" aria-labelledby="next-h">
        <h2 id="next-h">Next steps</h2>
        <div className="row">
          <Link className="btn btn-primary" to="/demo">
            Walk through the full demo
          </Link>
          <Link className="btn" to="/policies">
            Browse trust policies
          </Link>
          <Link className="btn" to="/protocol">
            Read the protocol reference
          </Link>
        </div>
      </section>
    </div>
  );
}
