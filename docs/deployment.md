# Deployment

**Status: contract deployed to GenLayer StudioNet; frontend deployed to
Vercel production.** The contract was deployed manually through GenLayer
Studio (not via CLI).

| Setting | Value |
|---|---|
| Contract address | `0x7e8EC29C1b6607bb6B078b6C684Cf29f4774Ccf2` |
| Network | GenLayer StudioNet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Frontend (production) | https://proofmesh.vercel.app |
| Source repository | https://github.com/Chinny070/proofmesh |

Post-deployment verification (schema inspection + live read-only calls) is
complete — see [Post-deployment verification result](#post-deployment-verification-result)
below. The full deployed schema, as returned live by the contract, is saved
at [docs/deployed-schema.json](deployed-schema.json).

The rest of this document is the deployment guidance prepared before the
deployment happened (contract file, constructor requirements, expected
schema) plus the verification checklist, now marked complete.

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

## Expected (and confirmed) deployed method/schema inventory

33 public methods: 13 writes, 20 views. Full list in
[docs/credential-schema.md](credential-schema.md#method-inventory). Confirmed
against the live deployed schema — see
[Post-deployment verification result](#post-deployment-verification-result)
and [docs/deployed-schema.json](deployed-schema.json).

## Post-deployment verification result

Performed against the live deployed contract at
`0x7e8EC29C1b6607bb6B078b6C684Cf29f4774Ccf2` on StudioNet, via
`genlayer_py`'s `get_contract_schema` and `read_contract` (read-only calls
only — no write, no redeployment).

1. **Schema inspection** — the live schema returned by the contract itself
   was fetched and saved to
   [docs/deployed-schema.json](deployed-schema.json). It reports **33
   methods: 13 write, 20 view**, a zero-parameter constructor
   (`"ctor": {"params": [], "kwparams": {}}`), and every one of the 18
   explicitly-required method names present with the expected parameter
   list (e.g. `create_trust_policy` takes exactly
   `name, credential_type, minimum_confidence_bps,
   minimum_independent_signals, require_no_active_challenge,
   require_current_continuity, allowed_claim_types`). This matches
   [docs/credential-schema.md](credential-schema.md#method-inventory)
   exactly by name and count — confirms this is the correct build, not a
   stale one.
2. **Live read-only calls** — all four returned the expected fresh-deploy
   empty state:

   ```text
   get_protocol_status() -> {"profile_count": 0, "claim_count": 0, "proof_count": 0,
     "credential_count": 0, "continuity_count": 0, "identity_challenge_count": 0,
     "trust_policy_count": 0}
   list_profiles()       -> []
   list_credentials()    -> []
   list_trust_policies() -> []
   ```

3. **Not yet performed**: the `get_identity_profile("does-not-exist")`
   on-chain-revert check and the full first-write flow (steps 4-5 of the
   original checklist below) — no write transaction has been sent to this
   contract yet. That's the next verification step once you're ready to
   spend a transaction against it.

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

## Frontend deployment (Vercel)

**Status: deployed to production.**

| Setting | Value |
|---|---|
| Production URL | https://proofmesh.vercel.app |
| Vercel project | `proofmesh` (scope `chinny070s-projects`) |
| Root directory | `frontend/` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

### Environment variables

Set in the Vercel project for Production, Preview, and Development:

```
VITE_GENLAYER_RPC_URL=https://studio.genlayer.com/api
VITE_GENLAYER_CHAIN_ID=61999
VITE_PROOFMESH_CONTRACT_ADDRESS=0x7e8EC29C1b6607bb6B078b6C684Cf29f4774Ccf2
```

None of these are secrets — they are a public RPC endpoint, a public chain
ID, and a public contract address, all of which ship in the client bundle
by design. No private key, API key, or credential is used by the frontend
or stored in the Vercel project.

### SPA routing

[`frontend/vercel.json`](../frontend/vercel.json) rewrites `/(.*)` to
`/index.html`, so client-side routes resolve on direct navigation and hard
refresh rather than returning 404.

### Production verification performed

All nine routes were checked directly (fresh HTTP request per path, not
client-side navigation) and returned HTTP 200 with the SPA root element:

```text
/  /identity  /identity/new  /challenges  /policies
/protocol  /integration  /demo  /account
```

In-browser against the production origin: every route rendered its expected
heading, zero console errors, the page issued a live request to
`https://studio.genlayer.com/api`, protocol counters loaded from chain
state, and the only contract address rendered anywhere was
`0x7e8EC29C1b6607bb6B078b6C684Cf29f4774Ccf2`.

## Browser-wallet verification checklist

**Status: not yet performed.** No write transaction has been sent to the
deployed contract. The development environment has no injected browser
wallet, so every write path below is implemented and type-checked but
unexercised against a live wallet. These steps must be run manually in a
browser with a GenLayer-compatible wallet before the app is considered
release-verified.

Run the frontend (`cd frontend && npm run dev`), then work through this in
order. Each step must reach **finalized success** — a transaction hash is
not success.

| # | Step | Where | Expected result |
|---|---|---|---|
| 1 | **Connect wallet** | `/account` | Address shown, "Connected to StudioNet" badge |
| 2 | **Switch / add StudioNet** | `/account` | If on another chain, "Switch to StudioNet" adds chain 61999 via `wallet_switchEthereumChain`, falling back to `wallet_addEthereumChain` on error 4902 |
| 3 | **Create profile** | `/identity/new` | Transaction reaches `finalized_success`; redirects to the Claim Wizard; profile appears in `/identity` |
| 4 | **Create claim** | `/identity/:id/claims` | Claim listed with status `PENDING` |
| 5 | **Issue challenge** | `/identity/:id/claims` | Claim moves to `CHALLENGE_ISSUED`; **the exact challenge text is displayed and copyable** — confirm it matches `PROOFMESH\|PROFILE:…\|CLAIM:…\|WALLET:…\|NONCE:…\|EXP:…` |
| 6 | **Publish challenge externally** | Off-site | Post the exact text at the claimed URL (gist, bio, page). Confirm it is publicly reachable without login |
| 7 | **Submit proof** | `/identity/:id/claims` | Compute the SHA-256 via the in-page helper; claim moves to `PROOF_SUBMITTED` |
| 8 | **Freeze evidence** | `/identity/:id/claims` | Claim → `FROZEN`, profile → `EVALUATION_FROZEN`; further claims/proofs are refused |
| 9 | **Evaluate identity** | `/identity/:id/claims` | Nondeterministic — expect a longer wait. Verdict panel renders the real returned JSON |
| 10 | **Verify finalized receipt** | Transaction panel | State reaches `finalized_success`, **not** merely `accepted`. Confirm the receipt's execution result is `FINISHED_WITH_RETURN` |
| 11 | **Inspect credential** | `/identity/:id/credentials` | Real credential with type, status, confidence BPS, independent signals, reason codes, evidence refs, issue/expiry dates |

Additional paths worth exercising once the above passes:

- **Continuity** (`/identity/:id/continuity`) — request a check, then evaluate it. Note the recheck interval must have elapsed since issuance.
- **Dispute** (`/identity/:id/credentials` → "Dispute this credential", then `/challenges/:id`) — open, submit evidence, freeze, adjudicate. Confirm a `TRANSFER` outcome preserves the original credential as `TRANSFERRED` and issues a new one to the competing profile.
- **Trust policy** (`/policies`) — create a policy, then evaluate a real credential against it and confirm `failure_reasons` are accurate.

**Do not record any of these as verified until they have actually been run.**

## Stage 8 audit summary

- `genvm-lint check contracts/proofmesh.py --json`: clean (see
  [docs/credential-schema.md](credential-schema.md) for the method count it
  reports)
- `pytest tests/direct/ -v`: 127 passed, 0 failed, 0 skipped
- `gltest tests/integration/ -v -s`: **blocked at the time of the Stage 8
  audit**. The one integration test present
  (`test_placeholder_deploys_to_studionet`) is a Stage 1-era placeholder
  that intentionally `pytest.skip()`s. Local Docker Desktop was not running
  on this machine, so `gltest`'s `localnet` target
  (`http://127.0.0.1:4000/api`) was unreachable (connection refused).
  StudioNet's RPC was reachable, but running `gltest` against it would have
  submitted a real on-chain deployment transaction — explicitly out of
  scope for Stage 8 ("do not deploy through CLI unless I explicitly ask").

## Post-deployment audit (this section)

Manual deployment through GenLayer Studio has since happened (see the
[Status](#deployment) banner at the top of this document). Post-deployment
verification used `genlayer_py`'s `get_contract_schema` / `read_contract`
directly (read-only, no `gltest`, no redeployment) — see
[Post-deployment verification result](#post-deployment-verification-result)
above for the schema-inspection and live-read results. The Stage
1-era `test_placeholder_deploys_to_studionet` integration test itself has
not been rewritten yet; that remains for whenever a full write-flow
integration test against the live contract is built.
