# ProofMesh

**Prove control. Preserve continuity. Resolve conflicts.**

ProofMesh is a reusable digital identity and trust-attestation protocol built on GenLayer. A wallet proves it controls several public identities — a GitHub profile, an X account, a personal site, a project team page — and receives an on-chain credential that other applications can query.

| | |
|---|---|
| **Live app** | https://proofmesh.vercel.app |
| **Source** | https://github.com/Chinny070/proofmesh |
| **Contract** | `0x7e8EC29C1b6607bb6B078b6C684Cf29f4774Ccf2` |
| **Network** | GenLayer StudioNet |
| **Chain ID** | `61999` |
| **RPC** | `https://studio.genlayer.com/api` |
| **Architecture** | Frontend + Intelligent Contract only. No backend, no database, no indexer. |

---

## The problem

Suppose a grants program gets an application from `0xabc…`. The wallet says it belongs to a developer who maintains a well-known repository. How does the program check that?

Today the usual answer is: ask them to post a code on X, and look at the post. That check is weak in specific ways:

- **One post proves one moment.** It says nothing a week later.
- **One account can be sold, borrowed, or compromised.** Control today isn't control tomorrow.
- **A single source has no corroboration.** Nothing cross-checks it.
- **Two wallets can claim the same identity**, and nothing decides between them.
- **Every project rebuilds this from scratch**, incompatibly.

ProofMesh treats identity as something with *multiple sources*, a *lifetime*, and the possibility of *dispute* — because that's how identity actually behaves.

## Why this needs GenLayer

A normal smart contract can compare two strings. It cannot fetch a web page, and it cannot form a judgement about one. The questions ProofMesh has to answer are not string comparisons:

- Is the challenge actually published at that GitHub URL right now?
- Do these three sources corroborate each other, or are they copies of one another?
- Has this account's controller apparently changed since we last checked?
- Between two wallets claiming the same identity, whose evidence is stronger?

Answering those requires live web retrieval and judgement over unstructured text — and, crucially, **agreement between independent validators** so the result is trustworthy rather than one server's opinion. That is what GenLayer's Intelligent Contracts provide, and it's why ProofMesh could not be built as an ordinary contract plus a backend: a backend would just be a trusted third party, which is the thing being eliminated.

---

## How it works

### Multi-source verification

1. **Create a profile.** An on-chain record owned by your wallet.
2. **Add claims.** Each names one public identity you say you control, from eight supported source types (GitHub, X, personal site, project site, team page, developer profile, community profile, org page).
3. **Get a challenge.** ProofMesh issues a unique message bound to your wallet address, that specific claim, a random nonce, and a 24-hour expiry:
   ```
   PROOFMESH|PROFILE:alex-dev|CLAIM:github-main|WALLET:0x…|NONCE:7F92A…|EXP:2026-…
   ```
4. **Publish it yourself.** You post it at the claimed source. **ProofMesh cannot post on your behalf and never asks for platform credentials.** A copied or pre-existing post won't pass — proofs that predate the challenge are rejected.
5. **Submit the proof.** Record the source URL and a SHA-256 hash of what you observed, so the evidence can't be swapped later.
6. **Freeze the evidence.** Claims and proofs lock into an immutable set, so validators all judge the same record and you can't add favourable evidence mid-evaluation.
7. **Evaluate.** GenLayer validators independently fetch each claimed source, check the challenge is there, assess whether the sources genuinely corroborate each other, and reach consensus on a verdict.

The result is a **purpose-specific credential** — `VERIFIED_DEVELOPER`, `VERIFIED_ORG_REPRESENTATIVE`, and so on, not a single generic "verified" badge — carrying a confidence score in basis points, a count of independent signals, machine-readable reason codes, and citations to the exact evidence used.

### Continuity

A credential is not permanent. After a recheck interval, **anyone** can trigger a continuity check — it re-fetches the same sources and asks whether the credential still holds. No scheduler, no cron worker, no backend.

Outcomes are deliberately graded. Still valid, or risk has risen (`RECHECK_DUE`), or evidence has gone uncertain (`STALE`), or ownership looks like it changed — in which case the credential moves to `CHALLENGED` for dispute resolution **rather than being silently revoked**. Revocation from a continuity check alone is reserved for strong evidence of fabrication or manipulation.

Credentials also expire on their own. A credential past `expires_at` is never reported as satisfying a policy, even if nothing has written to it since.

### Conflicting claims

If a second wallet claims an identity someone already holds a credential for, it opens a dispute. The credential locks immediately — but locking is not revoking; it freezes the question until it's answered.

Both sides attach evidence, the evidence is frozen, and validators fetch both sides' sources live before deciding:

| Outcome | Meaning |
|---|---|
| `UPHOLD` | The original controller keeps it. |
| `TRANSFER` | The challenger now controls the identity. |
| `REVOKE` | Neither side has a credible claim. |
| `REQUIRE_REVERIFICATION` | Genuinely ambiguous — the original controller must redo verification. |

On a `TRANSFER`, the original credential is **not deleted**. It is marked `TRANSFERRED` and stays permanently queryable, while a *new* credential is issued to the new controller. The record of who held what, and when, survives.

### How another app integrates

An integrating application deploys nothing and learns none of ProofMesh's internals. It asks one deterministic question:

```ts
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const client = createClient({ chain: studionet });

const raw = await client.readContract({
  address: "0x7e8EC29C1b6607bb6B078b6C684Cf29f4774Ccf2",
  functionName: "evaluate_policy_view",
  args: [profileId, policyId, credentialId],
});

const result = JSON.parse(raw);
if (result.satisfied) grantAccess();
else showReasons(result.failure_reasons);
```

A **trust policy** is a versioned bundle of requirements — minimum confidence, minimum independent signals, whether continuity must be current, whether open disputes disqualify, and which identity sources count. Evaluation is **fully deterministic**: every field compared is already-finalized on-chain state, so no model runs at query time and the same inputs always give the same answer.

Policies are versioned and never deleted. An app pinned to a specific `policy_id` keeps behaving identically after the policy is superseded — evaluation reports `POLICY_INACTIVE` rather than silently switching to different rules.

See [docs/integration.md](docs/integration.md) and the in-app **Integration Hub** at `/integration` for worked examples: a grants program, a community platform, and a marketplace.

---

## Repository layout

```text
proofmesh/
├─ contracts/proofmesh.py              # the Intelligent Contract (33 methods)
├─ tests/direct/test_proofmesh.py      # 127 direct tests
├─ tests/integration/                  # integration test scaffold
├─ frontend/                           # React + TypeScript + Vite
└─ docs/                               # protocol, integration, security, deployment
```

## Contract

33 public methods — 13 writes, 20 views. Three of the writes (`evaluate_identity`, `evaluate_continuity`, `evaluate_identity_challenge`) are the nondeterministic adjudication points; everything else is ordinary deterministic contract logic.

```bash
genvm-lint check contracts/proofmesh.py --json   # passes clean
pytest tests/direct/ -v                          # 127 passed
```

Full method inventory, storage schemas, verdict schemas, and status transitions: [docs/credential-schema.md](docs/credential-schema.md).

## Local frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The `.env.example` already points at the live deployed contract, so reads work immediately with no configuration:

```
VITE_GENLAYER_RPC_URL=https://studio.genlayer.com/api
VITE_GENLAYER_CHAIN_ID=61999
VITE_PROOFMESH_CONTRACT_ADDRESS=0x7e8EC29C1b6607bb6B078b6C684Cf29f4774Ccf2
```

Other commands:

```bash
npm run typecheck      # tsc
npm run lint           # oxlint
npm run build          # production build
npm run verify:reads   # live read check against the deployed contract
```

Reads need no wallet. Writes need an injected browser wallet on StudioNet.

### Deployment

The frontend is deployed to Vercel production at
[proofmesh.vercel.app](https://proofmesh.vercel.app), built from `frontend/`
with the three `VITE_*` variables above set in the Vercel project. SPA
routing is handled by the rewrite rule in
[`frontend/vercel.json`](frontend/vercel.json), so every route works on
direct navigation and hard refresh. Contract deployment is documented
separately in [docs/deployment.md](docs/deployment.md).

### Routes

`/` · `/identity` · `/identity/new` · `/identity/:profileId` · `/identity/:profileId/{claims,credentials,continuity}` · `/challenges` · `/challenges/:challengeId` · `/policies` · `/policies/:policyId` · `/integration` · `/demo` · `/account` · `/protocol`

Start at `/demo` for a guided walkthrough of the full lifecycle.

---

## Limitations

These are real constraints, not disclaimers:

- **This is not KYC.** ProofMesh attests demonstrated control of *public digital identities*. It makes no claim about legal identity, government identity, or personhood, and should not be used where those are legally required.
- **It proves control, not ownership or authorship.** A credential says this wallet could publish at these sources at a point in time.
- **External sources can disappear or change.** A site goes down, an account is deleted, a platform changes its markup. ProofMesh classifies unreachable sources as `SOURCE_INACCESSIBLE` and declines to treat that as evidence either way — it does not guess.
- **Adjudication is nondeterministic and consensus-based.** Validators judge live web content. Results are agreed under GenLayer's comparative equivalence principle, not byte-identical, and re-running an evaluation later may legitimately reach a different conclusion because the web changed.
- **Platform access varies.** Rate limits, login walls, geographic differences, and bot protection can all affect what validators can retrieve.
- **Credentials go stale and can be contested.** A credential is a point-in-time judgement with an expiry. Consumers should check status and expiry, not just existence.
- **Independence assessment is bounded.** ProofMesh will report that claims show low independence confidence. It will never assert that two wallets are the same person.
- **Write paths have not been exercised end-to-end.** All 13 write methods are implemented, type-checked, and covered by 127 direct contract tests, but no write transaction has been sent to the deployed contract from a real browser wallet — the development environment has no injected wallet. See [docs/deployment.md](docs/deployment.md#browser-wallet-verification-checklist) for the manual checklist.

## Documentation

- [docs/integration.md](docs/integration.md) — integrating ProofMesh into another application
- [docs/trust-policies.md](docs/trust-policies.md) — policy schema, versioning, evaluation
- [docs/credential-schema.md](docs/credential-schema.md) — full method inventory and record schemas
- [docs/security.md](docs/security.md) — evidence handling, prompt injection, adjudication safety
- [docs/deployment.md](docs/deployment.md) — deployment record and verification checklists
