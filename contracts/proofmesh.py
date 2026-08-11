# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json
from datetime import datetime, timedelta
from urllib.parse import urlparse
import hashlib


# Allowlisted identity claim types (build brief section 10 / spec section 8).
# Generic on purpose: claim types are the identity-signal categories the
# protocol reasons about, not tied to any single app-specific credential.
ALLOWED_CLAIM_TYPES = frozenset(
    {
        "GITHUB_PROFILE",
        "X_PROFILE",
        "PERSONAL_WEBSITE",
        "PROJECT_WEBSITE",
        "TEAM_PAGE",
        "DEVELOPER_PROFILE",
        "COMMUNITY_PROFILE",
        "ORG_PAGE",
    }
)

PROFILE_ID_MAX_LEN = 100
CLAIM_ID_MAX_LEN = 100
CLAIM_VALUE_MAX_LEN = 500

# Verification challenges expire this long after issuance.
CHALLENGE_VALIDITY = timedelta(hours=24)


def _normalize_claim_value(claim_value: str) -> str:
    """Deterministic URL/handle normalization: lowercase host+path, strip
    scheme, strip a leading www., strip trailing slash. No network access."""
    value = claim_value.strip().lower()
    if "://" not in value:
        value = "https://" + value
    parsed = urlparse(value)
    host = parsed.netloc
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/")
    normalized = host + path
    return normalized or value


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

    # -- Stage 2: identity profiles, identity claims, verification challenges --

    @gl.public.write
    def create_identity_profile(self, profile_id: str) -> str:
        if not profile_id or len(profile_id) > PROFILE_ID_MAX_LEN:
            raise gl.vm.UserError(
                f"Profile ID must be 1-{PROFILE_ID_MAX_LEN} characters"
            )
        if profile_id in self.profiles:
            raise gl.vm.UserError("Profile ID already exists")

        now = datetime.now().isoformat()
        profile_data = {
            "id": profile_id,
            "owner": gl.message.sender_address.as_hex,
            "status": "ACTIVE",
            "created_at": now,
            "updated_at": now,
            "claim_count": 0,
            "credential_count": 0,
            "active_challenge_id": "",
            "continuity_status": "NONE",
        }
        self.profiles[profile_id] = json.dumps(profile_data)
        self.profile_claims[profile_id] = json.dumps([])
        self.profile_count = u256(int(self.profile_count) + 1)
        return profile_id

    @gl.public.write
    def add_identity_claim(
        self,
        profile_id: str,
        claim_id: str,
        claim_type: str,
        claim_value: str,
    ) -> str:
        if profile_id not in self.profiles:
            raise gl.vm.UserError("Profile not found")

        profile = json.loads(self.profiles[profile_id])
        if profile["owner"] != gl.message.sender_address.as_hex:
            raise gl.vm.UserError("Only the profile owner may add claims")
        if profile["status"] != "ACTIVE":
            raise gl.vm.UserError("Profile is not active")

        if not claim_id or len(claim_id) > CLAIM_ID_MAX_LEN:
            raise gl.vm.UserError(f"Claim ID must be 1-{CLAIM_ID_MAX_LEN} characters")
        if claim_id in self.claims:
            raise gl.vm.UserError("Claim ID already exists")
        if claim_type not in ALLOWED_CLAIM_TYPES:
            allowed = ", ".join(sorted(ALLOWED_CLAIM_TYPES))
            raise gl.vm.UserError(f"Claim type must be one of: {allowed}")
        if not claim_value or len(claim_value) > CLAIM_VALUE_MAX_LEN:
            raise gl.vm.UserError(
                f"Claim value must be 1-{CLAIM_VALUE_MAX_LEN} characters"
            )

        normalized_url = _normalize_claim_value(claim_value)

        claim_ids = json.loads(self.profile_claims[profile_id])
        for existing_id in claim_ids:
            existing = json.loads(self.claims[existing_id])
            if (
                existing["normalized_url"] == normalized_url
                and existing["status"] != "REVOKED"
            ):
                raise gl.vm.UserError(
                    "CLAIM_DUPLICATED: an active claim already points to this source"
                )

        now = datetime.now().isoformat()
        claim_data = {
            "profile_id": profile_id,
            "claim_id": claim_id,
            "claim_type": claim_type,
            "claim_value": claim_value,
            "normalized_url": normalized_url,
            "status": "PENDING",
            "created_at": now,
            "last_verified_at": "",
            "challenge_nonce": "",
            "challenge_expires_at": "",
        }
        self.claims[claim_id] = json.dumps(claim_data)

        claim_ids.append(claim_id)
        self.profile_claims[profile_id] = json.dumps(claim_ids)

        profile["claim_count"] = int(profile["claim_count"]) + 1
        profile["updated_at"] = now
        self.profiles[profile_id] = json.dumps(profile)

        self.claim_count = u256(int(self.claim_count) + 1)
        return claim_id

    @gl.public.write
    def issue_verification_challenge(self, profile_id: str, claim_id: str) -> str:
        if profile_id not in self.profiles:
            raise gl.vm.UserError("Profile not found")
        if claim_id not in self.claims:
            raise gl.vm.UserError("Claim not found")

        profile = json.loads(self.profiles[profile_id])
        if profile["owner"] != gl.message.sender_address.as_hex:
            raise gl.vm.UserError("Only the profile owner may issue a challenge")

        claim = json.loads(self.claims[claim_id])
        if claim["profile_id"] != profile_id:
            raise gl.vm.UserError("Claim does not belong to this profile")
        if claim["status"] not in ("PENDING", "CHALLENGE_ISSUED", "CHALLENGE_EXPIRED"):
            raise gl.vm.UserError(
                "Claim is not eligible for a new challenge in its current status"
            )

        sender_hex = gl.message.sender_address.as_hex
        now = datetime.now()
        expires_at = now + CHALLENGE_VALIDITY

        seed = f"{profile_id}|{claim_id}|{sender_hex}|{int(self.claim_count)}|{now.isoformat()}"
        nonce = hashlib.sha256(seed.encode()).hexdigest()[:10].upper()

        expires_at_iso = expires_at.isoformat()
        challenge_text = (
            f"PROOFMESH|PROFILE:{profile_id}|CLAIM:{claim_id}"
            f"|WALLET:{sender_hex}|NONCE:{nonce}|EXP:{expires_at_iso}"
        )

        claim["status"] = "CHALLENGE_ISSUED"
        claim["challenge_nonce"] = nonce
        claim["challenge_expires_at"] = expires_at_iso
        self.claims[claim_id] = json.dumps(claim)

        profile["updated_at"] = now.isoformat()
        self.profiles[profile_id] = json.dumps(profile)

        return challenge_text

    @gl.public.view
    def get_identity_profile(self, profile_id: str) -> str:
        if profile_id not in self.profiles:
            raise gl.vm.UserError("Profile not found")
        return self.profiles[profile_id]

    @gl.public.view
    def get_identity_claim(self, claim_id: str) -> str:
        if claim_id not in self.claims:
            raise gl.vm.UserError("Claim not found")
        return self.claims[claim_id]

    @gl.public.view
    def get_profile_claim_ids(self, profile_id: str) -> str:
        if profile_id not in self.profile_claims:
            raise gl.vm.UserError("Profile not found")
        return self.profile_claims[profile_id]
