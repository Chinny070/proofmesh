# Integrating ProofMesh

ProofMesh is infrastructure. Another GenLayer application uses it by reading the deployed contract directly — no ProofMesh frontend, no ProofMesh SDK, no backend in between.

| | |
|---|---|
| **Contract** | `0x92D7FA9942b3e4F832DEDA07a0F517a330499c4D` |
| **Network** | GenLayer StudioNet |
| **Chain ID** | `61999` |
| **RPC** | `https://studio.genlayer.com/api` |
| **Schema** | [docs/deployed-schema.json](deployed-schema.json) — fetched from the contract itself |

The in-app **Integration Hub** at
[proofmesh.vercel.app/integration](https://proofmesh.vercel.app/integration)
presents this same material with copyable snippets and live values from the
deployment.

---

## The core question

```ts
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const client = createClient({ chain: studionet });

const raw = await client.readContract({
  address: "0x92D7FA9942b3e4F832DEDA07a0F517a330499c4D",
  functionName: "evaluate_policy_view",
  args: [profileId, policyId, credentialId],
});

const result = JSON.parse(raw);
```

Returns:

```jsonc
{
  "satisfied": true,
  "policy_id": "…",
  "profile_id": "…",
  "credential_id": "…",
  "credential_type": "VERIFIED_DEVELOPER",
  "confidence_bps": 9140,
  "independent_signal_count": 3,
  "continuity_current": true,
  "active_challenge": false,
  "failure_reasons": []
}
```

Two properties worth relying on:

- **Fully deterministic.** Every field compared is already-finalized on-chain state. No model runs at query time; the same inputs always produce the same answer.
- **`failure_reasons` is never short-circuited.** Every applicable check runs, so one call tells you everything that failed rather than just the first problem.

### Failure reasons

| Reason | Meaning |
|---|---|
| `POLICY_INACTIVE` | This policy version was superseded by a newer one. |
| `CREDENTIAL_PROFILE_MISMATCH` | The credential doesn't belong to the supplied profile. |
| `CREDENTIAL_STATUS_NOT_ELIGIBLE:<STATUS>` | Only `ACTIVE` and `RECHECK_DUE` pass. `EXPIRED` is re-checked live against `expires_at`. |
| `CREDENTIAL_TYPE_MISMATCH` | Not the credential type the policy requires. |
| `CONFIDENCE_BELOW_MINIMUM` | Below the policy's `minimum_confidence_bps`. |
| `INSUFFICIENT_INDEPENDENT_SIGNALS` | Fewer independent sources than required. |
| `CONTINUITY_NOT_CURRENT` | Policy requires current continuity; credential is `RECHECK_DUE` or time-expired. |
| `ACTIVE_CHALLENGE_PRESENT` | Policy forbids open disputes; this credential has one. |
| `CLAIM_TYPE_NOT_ALLOWED` | Evidence comes from a claim type this policy doesn't accept. |

---

## Everything you can read

All 20 views are read-only, need no wallet, and return a JSON-encoded **string** — parse it, don't expect a decoded object.

### Identity
| View | Returns |
|---|---|
| `get_identity_profile(profile_id)` | Full profile record |
| `get_identity_status(profile_id)` | Aggregate summary incl. claim/credential IDs |
| `list_profiles()` | Every profile |
| `get_identity_claim(claim_id)` | One claimed identity source |
| `get_profile_claim_ids(profile_id)` | Claim IDs for a profile |
| `get_identity_proof(proof_id)` | One proof record |
| `get_claim_proof_ids(claim_id)` | Proof IDs for a claim |

### Credentials
| View | Returns |
|---|---|
| `get_credential(credential_id)` | Full credential record |
| `list_credentials()` | Every credential, all statuses |
| `get_profile_credential_ids(profile_id)` | Credential IDs for a profile |

### Continuity
| View | Returns |
|---|---|
| `get_continuity_status(profile_id)` | Current continuity state |
| `get_continuity_record(continuity_id)` | One continuity check result |
| `get_credential_continuity_ids(credential_id)` | Full check history |

### Disputes
| View | Returns |
|---|---|
| `get_identity_challenge(challenge_id)` | Full dispute record incl. resolution |
| `get_credential_challenge_ids(credential_id)` | Dispute history for a credential |

### Trust policies
| View | Returns |
|---|---|
| `get_trust_policy(policy_id)` | Full policy record |
| `get_trust_policy_versions(name)` | Every version ID under a name |
| `list_trust_policies()` | Every policy, all versions |
| `evaluate_policy_view(profile_id, policy_id, credential_id)` | Deterministic policy check |

### Protocol
| View | Returns |
|---|---|
| `get_protocol_status()` | Counters across every record type |

---

## Worked integration patterns

None of these are hard-coded into ProofMesh. Each is a policy configuration plus a read.

### 1. Grant platform — only fund verified developers

```ts
// One-time setup: publish the policy. Any wallet can.
await write("create_trust_policy", [
  "GRANTS_VERIFIED_DEVELOPER_V1",
  "VERIFIED_DEVELOPER",
  8000,   // minimum_confidence_bps
  2,      // minimum_independent_signals
  true,   // require_no_active_challenge
  true,   // require_current_continuity
  ["GITHUB_PROFILE", "PERSONAL_WEBSITE", "X_PROFILE"],
]);

// Per applicant:
async function isEligibleForGrant(profileId, credentialId) {
  const r = JSON.parse(await read("evaluate_policy_view", [
    profileId, GRANTS_POLICY_ID, credentialId,
  ]));
  return { eligible: r.satisfied, reasons: r.failure_reasons };
}
```

### 2. Hackathon / community system — require a current, uncontested identity

Lower confidence bar, broader accepted sources, but the identity must be *current*.

```ts
await write("create_trust_policy", [
  "COMMUNITY_CURRENT_IDENTITY_V1",
  "BASIC_COMMUNITY_MEMBER",
  6000,
  1,
  true,   // still refuse contested identities
  true,   // must be ACTIVE, not RECHECK_DUE
  ["X_PROFILE", "COMMUNITY_PROFILE", "PERSONAL_WEBSITE"],
]);

const r = JSON.parse(await read("evaluate_policy_view", [
  profileId, COMMUNITY_POLICY_ID, credentialId,
]));

if (!r.satisfied && r.failure_reasons.includes("CONTINUITY_NOT_CURRENT")) {
  promptUser("Your verification needs a refresh before you can register.");
}
```

### 3. Agent / developer marketplace — high confidence, zero open disputes

A listing should drop the moment an identity becomes contested, without waiting for adjudication to conclude.

```ts
await write("create_trust_policy", [
  "MARKETPLACE_HIGH_TRUST_V1",
  "VERIFIED_DEVELOPER",
  9000,
  3,
  true,
  true,
  ["GITHUB_PROFILE", "PERSONAL_WEBSITE", "PROJECT_WEBSITE", "ORG_PAGE"],
]);

async function refreshListing(listing) {
  const r = JSON.parse(await read("evaluate_policy_view", [
    listing.profileId, MARKETPLACE_POLICY_ID, listing.credentialId,
  ]));

  if (r.active_challenge) return suspend(listing, "identity under dispute");
  if (!r.satisfied) return suspend(listing, r.failure_reasons.join(", "));
  return publish(listing);
}
```

> **Re-read credential IDs periodically.** Ownership can legitimately transfer. After a `TRANSFER` outcome the new controller holds a *new* credential and the old one is preserved as `TRANSFERRED` — so caching one `credential_id` forever will silently keep pointing at a historical record. Re-read `get_profile_credential_ids(profile_id)`.

---

## Transaction and finality

**A transaction hash is not success.** A hash means submitted, nothing more. Success requires two things together: the transaction reaches `FINALIZED`, **and** its execution result is `FINISHED_WITH_RETURN`.

```ts
import { TransactionStatus, ExecutionResult } from "genlayer-js/types";

const hash = await client.writeContract({
  address: PROOFMESH,
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

if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
  throw new Error("Finalized, but contract execution failed — nothing was written");
}
```

The three nondeterministic methods — `evaluate_identity`, `evaluate_continuity`, `evaluate_identity_challenge` — perform live web retrieval and validator consensus, so they take meaningfully longer than a plain state write. Budget for that in your polling.

ProofMesh's own frontend models this as an explicit 12-state machine (`idle → wallet_required | wrong_network → awaiting_signature → submitted → pending → accepted → awaiting_finality → finalized_success | finalized_execution_failed | rejected | timeout`) and never reports success before finality.

---

## Adapter pattern

ProofMesh's frontend isolates every raw `genlayer-js` call behind a typed adapter so page code never touches the SDK. The same shape works in a consuming app:

```ts
const CONTRACT = "0x92D7FA9942b3e4F832DEDA07a0F517a330499c4D";

async function read(functionName: string, args: CalldataEncodable[] = []) {
  const client = getReadClient();          // no wallet needed
  return (await client.readContract({
    address: CONTRACT, functionName, args,
  })) as string;                            // every view returns JSON
}

export const reads = {
  getCredential:      (id: string) => read("get_credential", [id]),
  listTrustPolicies:  ()           => read("list_trust_policies"),
  evaluatePolicyView: (p: string, pol: string, c: string) =>
    read("evaluate_policy_view", [p, pol, c]),
  // …20 views total
};
```

---

## Reusability audit

Answered against the deployed contract, not against intent.

### Can another project query ProofMesh without using the ProofMesh frontend?

**Yes.** Every view is a public read on the deployed contract, callable with plain `genlayer-js` (or any JSON-RPC client) against the StudioNet RPC. No wallet, no ProofMesh code, no permission. This was verified independently of the frontend via `frontend/scripts/verify-reads.mjs` and via Python `genlayer_py` during post-deployment verification.

### Can another project evaluate an identity policy deterministically?

**Yes.** `evaluate_policy_view` is a `@gl.public.view` containing no LLM call and no web retrieval — verified by inspection of `_evaluate_policy_deterministic`, which performs only numeric and set comparisons over finalized state. Because views cannot write, it also re-checks `expires_at` against current time on every call, so a time-expired credential can never report as satisfying a policy.

### Can arbitrary supported identity claim types be used without changing contract code?

**Yes, within the allowlist and source rules.** Eight claim types are supported (`GITHUB_PROFILE`, `X_PROFILE`, `PERSONAL_WEBSITE`, `PROJECT_WEBSITE`, `TEAM_PAGE`, `DEVELOPER_PROFILE`, `COMMUNITY_PROFILE`, `ORG_PAGE`). Platform-specific types are domain-bound (`github.com` for GitHub and `x.com`/`twitter.com` for X); generic website/page types accept any structurally valid public HTTP(S) source. The allowlist is deliberate rather than open-ended: arbitrary type strings would weaken policy comparisons and enter adjudication prompts without a defined meaning.

### Can identity ownership conflicts be resolved generically?

**Yes.** `open_identity_challenge` accepts any of eight reason codes against any credential, from any wallet — there is no privileged challenger. Adjudication runs the same leader/validator pattern regardless of claim type or credential type, and returns one of four generic outcomes (`UPHOLD` / `TRANSFER` / `REVOKE` / `REQUIRE_REVERIFICATION`). Nothing in the dispute path is specialised to a particular platform.

### Can continuity be triggered independently?

**Yes, permissionlessly.** `request_continuity_check` has no owner check — any wallet may trigger a recheck on any eligible credential once the recheck interval has elapsed. `evaluate_continuity` is likewise unrestricted. There is no scheduler, cron worker, or backend anywhere in the design; the permissionless trigger is what replaces one.

### Are historical credentials and transfers queryable?

**Yes.** Nothing is ever deleted — verified by grep: the contract contains no `del`, `.pop()`, `.clear()`, or `.remove()` on any storage map. A `TRANSFER` outcome changes only the original credential's `status` to `TRANSFERRED` and issues a *separate new* credential to the new controller; the original stays fully readable via `get_credential` and remains listed under the historical controller's `get_profile_credential_ids`. Continuity checks and disputes accumulate as append-only history.

### Are trust policies versioned and reusable?

**Yes.** Creating a policy under an existing name increments `version` and marks the previous version `INACTIVE` without deleting it. `get_trust_policy_versions(name)` returns every version ID ever published. An application pinned to a specific `policy_id` keeps evaluating against exactly the rules it integrated with — a superseded policy reports `POLICY_INACTIVE` rather than silently redirecting to different requirements.

### Is any contract logic hard-coded specifically to the demo?

**No.** The contract contains no demo profile IDs, no seeded credentials, no special-cased addresses, and no branch that behaves differently for particular inputs. The three example use cases in this document and in the Integration Hub exist purely as *frontend documentation* — they are policy configurations a third party would create with the same generic `create_trust_policy` call any user has. Verified by grep for `admin`/`grant`/`assign`/`seed`/`mock` method definitions (none) and for TODO/placeholder/fake markers (none).
