# Trust Policies

Trust policies are Stage 7's reusable layer: a versioned, named bundle of
requirements that any third-party GenLayer application can evaluate a
ProofMesh credential against, without needing to understand ProofMesh's
internal adjudication logic.

## Why this exists

ProofMesh's core value is that *other* apps — grants programs, DAO access
gates, developer marketplaces, faucets — can ask a single deterministic
question:

> "Does wallet X's credential satisfy policy Y?"

without re-implementing identity verification themselves, and without
calling an LLM at query time.

## Schema

```text
TrustPolicyRecord:
  id                            str   content-addressed policy_id
  creator                       str   sender address that created it
  name                          str   1-100 chars, e.g. "VERIFIED_DEVELOPER_V2"
  credential_type               str   one of the 6 allowlisted credential types
  minimum_confidence_bps        int   0-10000
  minimum_independent_signals   int   0-20
  require_no_active_challenge   bool
  require_current_continuity    bool
  allowed_claim_types           list[str]  non-empty, deduped, from the 8-value claim-type allowlist
  status                        str   ACTIVE | INACTIVE
  version                       int   1, 2, 3, ... per name
  created_at                    str   ISO-8601
```

## Creating a policy

```text
create_trust_policy(
    name="VERIFIED_DEVELOPER_V2",
    credential_type="VERIFIED_DEVELOPER",
    minimum_confidence_bps=8000,
    minimum_independent_signals=2,
    require_no_active_challenge=True,
    require_current_continuity=True,
    allowed_claim_types=["GITHUB_PROFILE", "PERSONAL_WEBSITE", "X_PROFILE"],
)
```

Every field is validated deterministically (bounds, allowlist membership, no
duplicate claim types) before the policy is stored — no LLM call is ever
made to create or evaluate a policy.

## Versioning

Creating a policy with a `name` that already exists produces a new version:
`version = previous_count + 1`. The *previous* latest version for that name
is flipped to `INACTIVE` (never deleted, never otherwise mutated) and the
new one becomes `ACTIVE`. Only the newest version of a given name is ever
active; every older version remains fully queryable via `get_trust_policy`
and `get_trust_policy_versions(name)`.

Only the creator recorded on the first version may publish later versions
of that named policy. Another wallet cannot deactivate or supersede a
builder's active policy by reusing its name.

This means an integrating app that pins a specific `policy_id` (rather than
just a `name`) keeps working even after the policy is superseded — it's
just checking against a now-`INACTIVE` policy, which `evaluate_policy_view`
reports as `POLICY_INACTIVE` in `failure_reasons` rather than silently
reinterpreting the request against a different version.

## Evaluating a policy

```text
evaluate_policy_view(profile_id, policy_id, credential_id) -> {
  "satisfied": bool,
  "policy_id": str,
  "profile_id": str,
  "credential_id": str,
  "credential_type": str,
  "confidence_bps": int,
  "independent_signal_count": int,
  "continuity_current": bool,
  "active_challenge": bool,
  "failure_reasons": [str, ...]
}
```

**Why `credential_id` is an explicit parameter** (rather than the two-arg
`evaluate_policy_view(profile_id, policy_id)` shown as an illustrative
example in the build brief): after Stage 6, a single profile can hold more
than one credential over its lifetime (e.g. the new credential issued to a
competing profile after a `TRANSFER`). The caller must name which
credential to check. This is "the exact equivalent supported by the current
contract structure," per the brief's own escape clause.

**Fully deterministic, no LLM call.** Every check is a numeric or set
comparison against already-finalized on-chain state:

1. Policy exists and is `ACTIVE`
2. Credential exists and belongs to the supplied `profile_id`
3. Credential status is eligible (`ACTIVE` or `RECHECK_DUE` only — `STALE`,
   `CHALLENGED`, `REVOKED`, `TRANSFERRED` always fail; `EXPIRED` is
   re-checked live against `expires_at` even if nothing has written to the
   credential since it expired, since `evaluate_policy_view` is a pure view
   and cannot apply the write-path expiry flip)
4. `credential_type` matches the policy's required type
5. `confidence_bps` meets the minimum
6. `independent_signal_count` meets the minimum
7. If `require_current_continuity`: credential status must be exactly
   `ACTIVE` (not `RECHECK_DUE`, not expired)
8. If `require_no_active_challenge`: `unresolved_challenges` must be `0`
9. Every claim type behind the credential's `evidence_refs` must be within
   `allowed_claim_types`

`failure_reasons` never short-circuits — every applicable check runs, so an
integrating app gets the complete picture in one call, not just a boolean.

## Reusability example

```text
Policy: VERIFIED_DEVELOPER_V2
minimum_confidence_bps = 8000
minimum_independent_signals = 2
require_no_active_challenge = true
require_current_continuity = true
allowed_claim_types = GITHUB_PROFILE | PERSONAL_WEBSITE | X_PROFILE
```

A DAO contributor program never has to touch ProofMesh's internal
adjudication code — it deploys nothing, just calls `evaluate_policy_view`
against the ProofMesh contract address with the applicant's `profile_id`,
`credential_id`, and this `policy_id`, and gets a structured, deterministic
answer it can gate access on.
