# ProofMesh

**Prove control. Preserve continuity. Resolve conflicts.**

ProofMesh is a reusable digital identity and trust-attestation protocol for GenLayer. It lets a wallet prove control over multiple public identity signals (GitHub, X, personal/project websites, team pages), evaluates whether those signals are coherent and current, and issues purpose-specific on-chain credentials that other GenLayer applications can query.

This is not a one-post social verification app — see [docs/credential-schema.md](docs/credential-schema.md) for the full protocol model.

## Stack

- Frontend: React + TypeScript + Vite + `genlayer-js@1.1.8` + injected wallet
- Contract: Python Intelligent Contract (`gl.Contract`) on GenLayer StudioNet
- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- No backend, no centralized database, no serverless functions.

## Repository layout

```text
proofmesh/
├─ contracts/proofmesh.py
├─ tests/direct/test_proofmesh.py
├─ tests/integration/test_proofmesh_integration.py
├─ frontend/
└─ docs/
```

## Status

**Stage 8 complete: contract audited and completion-gated, ready for manual StudioNet deployment.**

The contract (`contracts/proofmesh.py`) implements the full protocol through Stage 7:

- **Identity profiles, claims, verification challenges** — `create_identity_profile`, `add_identity_claim`, `issue_verification_challenge`
- **Proof submission and evidence freeze** — `submit_identity_proof`, `freeze_identity_evaluation`
- **GenLayer identity adjudication and credential issuance** — `evaluate_identity` (nondeterministic leader/validator)
- **Continuity checks** — `request_continuity_check`, `evaluate_continuity` (nondeterministic)
- **Identity challenges / conflicting-claim resolution** — `open_identity_challenge`, `submit_challenge_evidence`, `freeze_identity_challenge`, `evaluate_identity_challenge` (nondeterministic)
- **Reusable trust policies** — `create_trust_policy`, `evaluate_policy_view` (deterministic, no LLM)

33 public methods total: 13 writes, 20 views. See [docs/credential-schema.md](docs/credential-schema.md) for the full method inventory and every strict JSON schema, and [docs/security.md](docs/security.md) for the prompt-injection and evidence-validation model.

Direct tests: 127 passed, 0 failed, 0 skipped (`pytest tests/direct/ -v`). `genvm-lint check contracts/proofmesh.py --json` passes clean.

Not yet built: the product frontend (Stages 9–10) and the Integration Hub (Stage 11). See [docs/deployment.md](docs/deployment.md) for manual StudioNet deployment instructions — no contract has been deployed yet, so no address is recorded anywhere in this repo.
