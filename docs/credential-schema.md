# Credential Schema and Contract Method Inventory

This document is the authoritative reference for `contracts/proofmesh.py` as
deployed at `0x92D7FA9942b3e4F832DEDA07a0F517a330499c4D` on GenLayer
StudioNet. It covers every storage record, every
strict JSON verdict schema, the full method inventory, and the exact status
transition tables.

## Method inventory

33 public methods total: **13 writes**, **20 views**.

### Writes (13)

| Method | Nondeterministic? | Purpose |
|---|---|---|
| `create_identity_profile(profile_id)` | no | Create a profile owned by the sender |
| `add_identity_claim(profile_id, claim_id, claim_type, claim_value)` | no | Register a claimed identity source |
| `issue_verification_challenge(profile_id, claim_id)` | no | Issue a nonce challenge for a claim |
| `submit_identity_proof(profile_id, claim_id, proof_id, source_url, proof_type, content_hash, observed_at)` | no | Submit a source-bound proof URL and exact-challenge digest against an active challenge |
| `freeze_identity_evaluation(profile_id)` | no | Freeze the current claim/proof evidence set |
| `evaluate_identity(profile_id, policy_id)` | **yes** | Adjudicate the frozen evidence and issue a credential |
| `request_continuity_check(credential_id, profile_id)`\* | no | Permissionlessly request a continuity recheck |
| `evaluate_continuity(continuity_id)` | **yes** | Adjudicate live evidence vs. the credential baseline |
| `open_identity_challenge(credential_id, competing_profile_id, reason_code, statement)` | no | Open a dispute against a credential |
| `submit_challenge_evidence(challenge_id, proof_id)` | no | Attach evidence to an open dispute |
| `freeze_identity_challenge(challenge_id)` | no | Freeze a dispute's evidence set |
| `evaluate_identity_challenge(challenge_id)` | **yes** | Adjudicate a dispute: UPHOLD / TRANSFER / REVOKE / REQUIRE_REVERIFICATION |
| `create_trust_policy(name, credential_type, minimum_confidence_bps, minimum_independent_signals, require_no_active_challenge, require_current_continuity, allowed_claim_types)` | no | Create/version a reusable trust policy |

\* actual parameter order is `(self, profile_id, credential_id)`.

### Views (20)

| Method | Purpose |
|---|---|
| `get_protocol_status()` | Aggregate counters across every record type |
| `get_identity_profile(profile_id)` | Full IdentityProfile record |
| `get_identity_claim(claim_id)` | Full IdentityClaim record |
| `get_profile_claim_ids(profile_id)` | Claim IDs for a profile |
| `get_identity_status(profile_id)` | Aggregate profile status summary |
| `list_profiles()` | Every IdentityProfile record |
| `get_identity_proof(proof_id)` | Full ProofRecord |
| `get_claim_proof_ids(claim_id)` | Proof IDs for a claim |
| `get_credential(credential_id)` | Full CredentialRecord |
| `list_credentials()` | Every CredentialRecord (all profiles, all statuses) |
| `get_profile_credential_ids(profile_id)` | Credential IDs for a profile |
| `get_continuity_record(continuity_id)` | Full ContinuityRecord |
| `get_credential_continuity_ids(credential_id)` | Continuity check history for a credential |
| `get_continuity_status(profile_id)` | A profile's current continuity_status string |
| `get_identity_challenge(challenge_id)` | Full IdentityChallengeRecord |
| `get_credential_challenge_ids(credential_id)` | Dispute history for a credential |
| `get_trust_policy(policy_id)` | Full TrustPolicyRecord |
| `get_trust_policy_versions(name)` | All policy_ids ever created under a name, oldest first |
| `list_trust_policies()` | Every TrustPolicyRecord (all names, all versions) |
| `evaluate_policy_view(profile_id, policy_id, credential_id)` | Deterministic policy-vs-credential check |

### Nondeterministic methods (3)

`evaluate_identity`, `evaluate_continuity`, `evaluate_identity_challenge`. All
three use the identical verified pattern:
`gl.eq_principle.prompt_comparative(leader, principle)`, where `leader()`
calls `gl.nondet.web.render(url, mode="text")` against on-chain-stored,
already-validated claim URLs only, then `gl.nondet.exec_prompt(task)` for a
strict-JSON verdict. See [docs/security.md](security.md) for the evidence
and prompt-injection model.

### Deterministic policy methods (2)

`create_trust_policy` (structural validation only, no adjudication) and
`evaluate_policy_view` (pure numeric/set comparison against already-finalized
credential state — **no LLM call**, per the build brief's explicit
requirement that policy evaluation must not invoke a model merely to compare
finalized fields against numeric thresholds).

---

## Storage records

All records are stored as JSON strings inside `TreeMap[str, str]` fields
(GenVM-safe; avoids `@allow_storage` dataclass friction across stages).

### IdentityProfile

```text
id, owner, status, created_at, updated_at, claim_count, credential_count,
active_challenge_id, continuity_status
```

Profile `status`: `ACTIVE` → `EVALUATION_FROZEN` → `EVALUATION_REJECTED` |
`CREDENTIALED`.

### IdentityClaim

```text
profile_id, claim_id, claim_type, claim_value, normalized_url, status,
created_at, last_verified_at, challenge_nonce, challenge_expires_at
```

Claim `status`: `PENDING` → `CHALLENGE_ISSUED` → (`CHALLENGE_EXPIRED` |
`PROOF_SUBMITTED`) → `FROZEN`.

### ProofRecord

```text
claim_id, proof_id, submitter, source_url, proof_type, challenge_text,
content_hash, observed_at, submitted_at, status
```

Proof `status`: `SUBMITTED` → `FROZEN` (immutable once frozen).

### CredentialRecord

```text
id, profile_id, policy_id, credential_type, status, confidence_bps,
independent_signal_count, issued_at, expires_at, last_continuity_check,
unresolved_challenges, reason_codes, evidence_refs, summary
```

Credential `status`: see the [status transition table](#credential-status-transition-table) below.

### ContinuityRecord

```text
id, profile_id, credential_id, requested_at, evaluated_at, status,
continuity_risk_bps, reason_codes, evidence_refs, summary
```

### IdentityChallengeRecord

```text
id, credential_id, challenger, competing_profile_id, reason_code, statement,
evidence_refs, status, opened_at, frozen_at, resolved_at, resolution, summary
```

Challenge `status`: `OPEN` → `FROZEN` → `RESOLVED`.

### TrustPolicyRecord

```text
id, creator, name, credential_type, minimum_confidence_bps,
minimum_independent_signals, require_no_active_challenge,
require_current_continuity, allowed_claim_types, status, version, created_at
```

Policy `status`: `ACTIVE` (newest version of a name) or `INACTIVE`
(superseded by a newer version — never deleted).

---

## Credential status transition table

| Status | Meaning | Set by |
|---|---|---|
| `ACTIVE` | Currently trustworthy | `evaluate_identity` (issuance), `evaluate_continuity` (confirmed), `evaluate_identity_challenge` (UPHOLD) |
| `RECHECK_DUE` | Still valid, elevated risk or explicit re-verification request | `evaluate_continuity`, `evaluate_identity_challenge` (REQUIRE_REVERIFICATION) |
| `STALE` | Not currently valid, but only for an uncertain/inaccessible reason | `evaluate_continuity` |
| `CHALLENGED` | Under active dispute — locked until resolved | `evaluate_continuity` (ownership-change-suspected or dispute-worthy reason codes), `open_identity_challenge` |
| `REVOKED` | Finalized: not trustworthy (strong fabrication/manipulation evidence only) | `evaluate_continuity` (narrow reason-code set), `evaluate_identity_challenge` (REVOKE) |
| `TRANSFERRED` | Finalized, historical: ownership moved to a competing profile | `evaluate_identity_challenge` (TRANSFER) — original record preserved unchanged except this field |
| `EXPIRED` | Finalized: past `expires_at` | Any write touching the credential (`request_continuity_check`, `open_identity_challenge`); `evaluate_policy_view` also re-checks this deterministically since it cannot write |

`REVOKED`, `TRANSFERRED`, and `EXPIRED` are terminal for that specific
credential record — the record itself is never deleted or further mutated,
it simply stops being eligible for continuity checks, new disputes, or trust
policy satisfaction. A `TRANSFER` outcome issues a brand-new credential to
the competing profile rather than mutating the original.

**Conservative REVOKED policy** (audited and corrected in Stage 6, per
explicit instruction): irreversible `REVOKED` is reserved for
`MANIPULATION_RISK_HIGH` and `CIRCULAR_EVIDENCE` only — strong, positively
fabrication-indicating signals. A merely suspected ownership transfer,
policy mismatch, or source conflict routes to `CHALLENGED` instead, so
Stage 6's dispute adjudication (not continuity alone) decides the outcome.

---

## Strict JSON verdict schemas

### Identity evaluation (`evaluate_identity`)

```json
{
  "eligible": true,
  "confidence_bps": 0,
  "independent_signal_count": 0,
  "continuity_risk_bps": 0,
  "conflict_risk_bps": 0,
  "manipulation_risk_bps": 0,
  "credential_type": "",
  "reason_codes": [],
  "evidence_refs": [],
  "summary": ""
}
```

### Continuity check (`evaluate_continuity`)

```json
{
  "still_valid": true,
  "continuity_risk_bps": 0,
  "ownership_change_suspected": false,
  "recheck_due": false,
  "reason_codes": [],
  "evidence_refs": [],
  "summary": ""
}
```

### Identity challenge adjudication (`evaluate_identity_challenge`)

```json
{
  "decision": "UPHOLD",
  "current_controller_profile_id": "",
  "historical_controller_profile_id": "",
  "credential_action": "KEEP_ACTIVE",
  "confidence_bps": 0,
  "reason_codes": [],
  "evidence_refs": [],
  "summary": ""
}
```

`decision` ∈ `{UPHOLD, TRANSFER, REVOKE, REQUIRE_REVERIFICATION}`, strictly
paired with `credential_action` ∈ `{KEEP_ACTIVE, TRANSFER_CREDENTIAL,
REVOKE_CREDENTIAL, REQUIRE_REVERIFICATION}`.

**Deviation from the illustrative schema:** `current_controller_profile_id`
and `historical_controller_profile_id` are `str` here (ProofMesh profile
IDs), not the `int` `0` shown as a placeholder default in the build brief —
every ID in this protocol has been a string since Stage 1 (`profile_id`,
`credential_id`, `policy_id`, etc.), so the illustrative `0` is read as "a
generic empty/unset default," not a literal type requirement. The same
applies to `policy_id`/`credential_id` in the trust-policy result below.

### Trust policy evaluation (`evaluate_policy_view`, deterministic)

```json
{
  "satisfied": true,
  "policy_id": "policy-...",
  "profile_id": "profile-1",
  "credential_id": "cred-...",
  "credential_type": "VERIFIED_DEVELOPER",
  "confidence_bps": 9140,
  "independent_signal_count": 3,
  "continuity_current": true,
  "active_challenge": false,
  "failure_reasons": []
}
```

`failure_reasons` is never short-circuited — every applicable check runs, so
a caller gets the complete picture in one call.

---

## Allowlists

- **Claim types (8):** `GITHUB_PROFILE`, `X_PROFILE`, `PERSONAL_WEBSITE`, `PROJECT_WEBSITE`, `TEAM_PAGE`, `DEVELOPER_PROFILE`, `COMMUNITY_PROFILE`, `ORG_PAGE`
- **Proof types (4):** `PAGE_TEXT`, `SCREENSHOT`, `API_RESPONSE`, `SIGNED_MESSAGE`
- **Credential types (6):** `BASIC_IDENTITY`, `BASIC_COMMUNITY_MEMBER`, `VERIFIED_DEVELOPER`, `VERIFIED_PROJECT_FOUNDER`, `VERIFIED_COMMUNITY_MEMBER`, `VERIFIED_ORG_REPRESENTATIVE`
- **Reason codes (22):** 8 positive (build brief §10) + 14 negative (§11) — see `contracts/proofmesh.py` for the exact frozensets (`POSITIVE_REASON_CODES`, `NEGATIVE_REASON_CODES`)
- **Challenge reasons (8):** `ACCOUNT_OWNERSHIP_CHANGED`, `PROOF_STALE`, `CLAIM_DUPLICATED`, `CLAIM_FABRICATED`, `SOURCE_COMPROMISED`, `ACCOUNT_TRANSFERRED`, `CREDENTIAL_POLICY_NO_LONGER_SATISFIED`, `CONFLICTING_WALLET_CLAIM`

## Numeric bounds

| Field | Bound |
|---|---|
| All `*_bps` fields | integer, `0`–`10000` |
| `profile_id` / `claim_id` / `proof_id` / `challenge_id` | ≤ 100 chars |
| `claim_value` | ≤ 500 chars |
| `source_url` | ≤ 500 chars, must be `http`/`https` with a host |
| `content_hash` | exactly 64 lowercase hex chars and equal to sha256 of the exact issued challenge |
| platform claim source | `GITHUB_PROFILE` uses `github.com`; `X_PROFILE` uses `x.com` or `twitter.com` |
| proof source binding | platform proof URL must remain under the claimed account; generic proof URL must remain on the claimed host |
| live challenge binding | retrieved proof content must contain the exact issued challenge before its proof ID can support an eligible verdict |
| `statement` (challenge) | ≤ 1000 chars |
| `summary` (any verdict) | ≤ 500 chars |
| `reason_codes` (any verdict) | ≤ 12 entries |
| `MAX_PROOFS_PER_CLAIM` | 5 |
| `minimum_independent_signals` (policy) | `0`–`20` |
| Fetched page text before prompting | ≤ 4000 chars |
| Challenge validity | 24 hours |
| Credential validity | 90 days |
| Continuity recheck interval | 30 days |
