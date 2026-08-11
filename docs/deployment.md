# Deployment

**Status: not yet deployed.** No contract address is recorded anywhere in
this repository. This document is manual deployment guidance for GenLayer
Studio, prepared at the end of Stage 8 (contract completion gate). Nothing
here should be read as "already deployed."

## Exact contract file to deploy

```text
contracts/proofmesh.py
```

Single-file contract, no external file dependencies. Depends header pinned
to `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`
(resolves to SDK `py-lib-genlayer-std v0.3.0-rc7` — verified by reading the
extracted SDK source directly during Stage 4, not guessed).

Before deploying, confirm the file still passes:

```bash
genvm-lint check contracts/proofmesh.py --json
pytest tests/direct/ -v
```

Both must be clean (see [Stage 8 audit result](#stage-8-audit-summary) below
for the exact output as of this document's writing).

## Constructor requirements

```python
def __init__(self):
    ...
```

**Zero constructor parameters.** All counters initialize to `0` and every
storage `TreeMap` starts empty. Deploy with an empty args list.

## StudioNet network details

| Setting | Value |
|---|---|
| Network | StudioNet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Studio UI | https://studio.genlayer.com |

## Expected deployed method/schema inventory

33 public methods: 13 writes, 20 views. Full list in
[docs/credential-schema.md](credential-schema.md#method-inventory). After
deployment, use Studio's contract-schema inspector to confirm the deployed
ABI matches this count and these exact method names/signatures — a mismatch
would indicate a stale build or a deployment of the wrong file.

## Post-deployment verification checklist

1. **Confirm finality**, not just submission — Studio shows transaction
   status; wait for the deployment transaction to reach a finalized state
   before treating the contract address as usable. A transaction hash is
   not success (see the frontend transaction-state-machine design in the
   build brief, section 22 — the same principle applies to deployment
   itself).
2. **Inspect the schema** via Studio's contract viewer. Confirm 13 write
   methods and 20 view methods, matching
   [docs/credential-schema.md](credential-schema.md#method-inventory)
   exactly by name.
3. **Call every read method in the checklist below** and confirm each
   returns the expected empty/zero state.
4. **Confirm error handling on-chain**, not just in `gltest` direct mode:
   call `get_identity_profile("does-not-exist")` and confirm it reverts
   with `"Profile not found"` rather than returning a default value.
5. **Run the first write flow below** end-to-end, including a real
   `evaluate_identity` call, and confirm it reaches finality with a valid
   credential (or a clean rejection) — this is the only way to confirm the
   real GenVM validator network (not the `gltest` direct-mode mock) can
   actually execute `gl.nondet.web.render` + `gl.nondet.exec_prompt` +
   `gl.eq_principle.prompt_comparative` against this contract.
6. **Record the deployed contract address** in `frontend/.env.example`
   (`VITE_PROOFMESH_CONTRACT_ADDRESS`) only after this checklist passes —
   not before.

## Exact read methods to test on a fresh contract

```text
get_protocol_status()
  -> {"profile_count":0,"claim_count":0,"proof_count":0,"credential_count":0,
      "continuity_count":0,"identity_challenge_count":0,"trust_policy_count":0}

list_profiles()       -> []
list_credentials()    -> []
list_trust_policies() -> []
```

## Exact first write flow to test after deployment

This mirrors the Stage 1–4 direct-test flow, but against real StudioNet
validators — expect it to take longer (real LLM + real web fetch) and to
require the identity source to genuinely exist and contain the challenge
text.

1. `create_identity_profile("demo-profile-1")`
2. `add_identity_claim("demo-profile-1", "demo-claim-1", "GITHUB_PROFILE", "<a real, reachable URL you control>")`
3. `issue_verification_challenge("demo-profile-1", "demo-claim-1")`
   — capture the returned challenge text
   (`PROOFMESH|PROFILE:...|CLAIM:...|WALLET:...|NONCE:...|EXP:...`) and
   actually publish it at the claimed URL before continuing.
4. `submit_identity_proof("demo-profile-1", "demo-claim-1", "demo-proof-1", "<same URL>", "PAGE_TEXT", "<sha256 hex of the page content you observed>", "<ISO-8601 timestamp you observed it>")`
5. `freeze_identity_evaluation("demo-profile-1")`
6. `evaluate_identity("demo-profile-1", "demo-policy-placeholder")` — this
   is the first real nondeterministic call; wait for finality across
   validators.
7. `get_credential(...)` (use the credential ID from `get_profile_credential_ids("demo-profile-1")`)
   to confirm issuance, or `get_identity_profile("demo-profile-1")` to
   confirm `status: "EVALUATION_REJECTED"` if the evidence wasn't found
   credible.

`policy_id` in step 6 is accepted as a free-form label at this stage (Stage
7's `create_trust_policy`/`evaluate_policy_view` are separate from
credential issuance) — any non-empty string ≤ 100 chars works for this
smoke test.

## Stage 8 audit summary

- `genvm-lint check contracts/proofmesh.py --json`: clean (see
  [docs/credential-schema.md](credential-schema.md) for the method count it
  reports)
- `pytest tests/direct/ -v`: 127 passed, 0 failed, 0 skipped
- `gltest tests/integration/ -v -s`: **blocked**. The one integration test
  present (`test_placeholder_deploys_to_studionet`) is a Stage 1-era
  placeholder that intentionally `pytest.skip()`s pending a real deployment.
  Local Docker Desktop is not running on this machine, so `gltest`'s
  `localnet` target (`http://127.0.0.1:4000/api`) is unreachable
  (connection refused). StudioNet's RPC (`https://studio.genlayer.com/api`)
  *is* reachable, but running `gltest` against it would submit a real
  on-chain deployment transaction — explicitly out of scope for this stage
  ("do not deploy through CLI unless I explicitly ask"). Real integration
  tests against a deployed contract are deferred to whenever manual
  deployment actually happens.
