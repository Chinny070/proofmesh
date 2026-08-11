# ProofMesh

**Prove control. Preserve continuity. Resolve conflicts.**

ProofMesh is a reusable digital identity and trust-attestation protocol for GenLayer. It lets a wallet prove control over multiple public identity signals (GitHub, X, personal/project websites, team pages), evaluates whether those signals are coherent and current, and issues purpose-specific on-chain credentials that other GenLayer applications can query.

This is not a one-post social verification app — see [docs/protocol overview](#status) below.

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

**Stage 1 complete: repository scaffold + storage model + test foundation.**

The contract currently defines the full storage model (identity profiles, claims,
proofs, credentials, continuity records, identity challenges, trust policies) plus
protocol-wide counters and a `get_protocol_status` view. Write methods for profile/claim/
challenge management land in Stage 2.

See the build brief's Stage 1–11 plan for the full roadmap. Nothing beyond Stage 1
has been implemented yet — this repo intentionally stays functional and minimal at
each stage.
