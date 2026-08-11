# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json


class ProofMesh(gl.Contract):
    # -- Stage 1: storage model only. Write/view methods land in later stages. --

    # IdentityProfile: profile_id -> JSON
    profiles: TreeMap[str, str]
    # IdentityClaim: claim_id -> JSON
    claims: TreeMap[str, str]
    # claim ids belonging to a profile: profile_id -> JSON array of claim_id
    profile_claims: TreeMap[str, str]

    # ProofRecord: proof_id -> JSON
    proofs: TreeMap[str, str]
    # proof ids belonging to a claim: claim_id -> JSON array of proof_id
    claim_proofs: TreeMap[str, str]

    # CredentialRecord: credential_id -> JSON
    credentials: TreeMap[str, str]
    # credential ids belonging to a profile: profile_id -> JSON array of credential_id
    profile_credentials: TreeMap[str, str]

    # ContinuityRecord: continuity_id -> JSON
    continuity_records: TreeMap[str, str]
    # continuity ids belonging to a credential: credential_id -> JSON array of continuity_id
    credential_continuity: TreeMap[str, str]

    # IdentityChallengeRecord: challenge_id -> JSON
    identity_challenges: TreeMap[str, str]
    # challenge ids belonging to a credential: credential_id -> JSON array of challenge_id
    credential_challenges: TreeMap[str, str]

    # TrustPolicyRecord: policy_id -> JSON
    trust_policies: TreeMap[str, str]

    # monotonic id counters
    profile_count: u256
    claim_count: u256
    proof_count: u256
    credential_count: u256
    continuity_count: u256
    identity_challenge_count: u256
    trust_policy_count: u256

    def __init__(self):
        self.profile_count = u256(0)
        self.claim_count = u256(0)
        self.proof_count = u256(0)
        self.credential_count = u256(0)
        self.continuity_count = u256(0)
        self.identity_challenge_count = u256(0)
        self.trust_policy_count = u256(0)

    @gl.public.view
    def get_protocol_status(self) -> str:
        return json.dumps(
            {
                "profile_count": int(self.profile_count),
                "claim_count": int(self.claim_count),
                "proof_count": int(self.proof_count),
                "credential_count": int(self.credential_count),
                "continuity_count": int(self.continuity_count),
                "identity_challenge_count": int(self.identity_challenge_count),
                "trust_policy_count": int(self.trust_policy_count),
            }
        )
