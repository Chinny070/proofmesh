"""
Direct tests for ProofMesh (no simulator, no real web/LLM calls).

Uses gltest's direct execution harness (`direct_vm` / `direct_deploy`
fixtures), which runs the contract in-process against an in-memory
storage manager. datetime.now() is deterministically warped by the VM,
so challenge timestamps/expiry are reproducible.

Stage groups follow the build brief's Stage 18 test plan. Only the
groups covered by Stage 2 (profile creation, claim creation, challenge
generation, access control slice, and duplicate/expiry validation) are
implemented here; later groups are added as their stages land.
"""

import json
from pathlib import Path

import pytest

CONTRACT_PATH = str(Path(__file__).resolve().parents[2] / "contracts" / "proofmesh.py")


def deploy(direct_deploy):
    return direct_deploy(CONTRACT_PATH)


def as_hex(address) -> str:
    """direct_alice/direct_bob fixtures yield raw bytes; contract-side
    Address.as_hex is '0x' + hex. Normalize test-side bytes the same way."""
    return address.as_hex if hasattr(address, "as_hex") else "0x" + address.hex()


# -- Protocol initialization (Stage 1 regression coverage) --


class TestProtocolInitialization:
    def test_protocol_status_starts_zero(self, direct_deploy):
        contract = deploy(direct_deploy)
        status = json.loads(contract.get_protocol_status())
        assert status == {
            "profile_count": 0,
            "claim_count": 0,
            "proof_count": 0,
            "credential_count": 0,
            "continuity_count": 0,
            "identity_challenge_count": 0,
            "trust_policy_count": 0,
        }


# -- Profile creation --


class TestProfileCreation:
    def test_create_identity_profile(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice

        result = contract.create_identity_profile("profile-1")
        assert result == "profile-1"

        profile = json.loads(contract.get_identity_profile("profile-1"))
        assert profile["id"] == "profile-1"
        assert profile["owner"].lower() == as_hex(direct_alice).lower()
        assert profile["status"] == "ACTIVE"
        assert profile["claim_count"] == 0
        assert profile["credential_count"] == 0
        assert profile["active_challenge_id"] == ""
        assert profile["continuity_status"] == "NONE"
        assert profile["created_at"] == profile["updated_at"]

        status = json.loads(contract.get_protocol_status())
        assert status["profile_count"] == 1

    def test_duplicate_profile_id_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")

        with direct_vm.expect_revert("Profile ID already exists"):
            contract.create_identity_profile("profile-1")

    def test_empty_profile_id_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice

        with direct_vm.expect_revert("Profile ID must be"):
            contract.create_identity_profile("")

    def test_oversized_profile_id_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice

        with direct_vm.expect_revert("Profile ID must be"):
            contract.create_identity_profile("x" * 101)

    def test_unknown_profile_lookup_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice

        with direct_vm.expect_revert("Profile not found"):
            contract.get_identity_profile("does-not-exist")


# -- Claim creation --


class TestClaimCreation:
    def _profile(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")
        return contract

    def test_add_identity_claim(self, direct_deploy, direct_vm, direct_alice):
        contract = self._profile(direct_deploy, direct_vm, direct_alice)

        result = contract.add_identity_claim(
            "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
        )
        assert result == "claim-1"

        claim = json.loads(contract.get_identity_claim("claim-1"))
        assert claim["profile_id"] == "profile-1"
        assert claim["claim_type"] == "GITHUB_PROFILE"
        assert claim["claim_value"] == "https://github.com/alexdev"
        assert claim["normalized_url"] == "github.com/alexdev"
        assert claim["status"] == "PENDING"
        assert claim["challenge_nonce"] == ""
        assert claim["challenge_expires_at"] == ""

        profile = json.loads(contract.get_identity_profile("profile-1"))
        assert profile["claim_count"] == 1

        claim_ids = json.loads(contract.get_profile_claim_ids("profile-1"))
        assert claim_ids == ["claim-1"]

        status = json.loads(contract.get_protocol_status())
        assert status["claim_count"] == 1

    def test_claim_url_normalization_strips_scheme_www_and_slash(
        self, direct_deploy, direct_vm, direct_alice
    ):
        contract = self._profile(direct_deploy, direct_vm, direct_alice)
        contract.add_identity_claim(
            "profile-1",
            "claim-1",
            "PERSONAL_WEBSITE",
            "https://WWW.Alexdev.xyz/",
        )
        claim = json.loads(contract.get_identity_claim("claim-1"))
        assert claim["normalized_url"] == "alexdev.xyz"

    def test_claim_on_unknown_profile_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice

        with direct_vm.expect_revert("Profile not found"):
            contract.add_identity_claim(
                "no-such-profile", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
            )

    def test_claim_by_non_owner_rejected(
        self, direct_deploy, direct_vm, direct_alice, direct_bob
    ):
        contract = self._profile(direct_deploy, direct_vm, direct_alice)
        direct_vm.sender = direct_bob

        with direct_vm.expect_revert("Only the profile owner may add claims"):
            contract.add_identity_claim(
                "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
            )

    def test_invalid_claim_type_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._profile(direct_deploy, direct_vm, direct_alice)

        with direct_vm.expect_revert("Claim type must be one of"):
            contract.add_identity_claim(
                "profile-1", "claim-1", "NOT_A_REAL_TYPE", "https://github.com/alexdev"
            )

    def test_duplicate_claim_id_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._profile(direct_deploy, direct_vm, direct_alice)
        contract.add_identity_claim(
            "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
        )
        with direct_vm.expect_revert("Claim ID already exists"):
            contract.add_identity_claim(
                "profile-1", "claim-1", "X_PROFILE", "https://x.com/alexdev"
            )

    def test_duplicate_normalized_source_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._profile(direct_deploy, direct_vm, direct_alice)
        contract.add_identity_claim(
            "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
        )
        with direct_vm.expect_revert("CLAIM_DUPLICATED"):
            contract.add_identity_claim(
                "profile-1", "claim-2", "GITHUB_PROFILE", "https://github.com/alexdev/"
            )

    def test_empty_claim_value_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._profile(direct_deploy, direct_vm, direct_alice)
        with direct_vm.expect_revert("Claim value must be"):
            contract.add_identity_claim("profile-1", "claim-1", "GITHUB_PROFILE", "")


# -- Verification challenge generation --


class TestChallengeGeneration:
    def _claim(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")
        contract.add_identity_claim(
            "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
        )
        return contract

    def test_issue_verification_challenge_format(self, direct_deploy, direct_vm, direct_alice):
        contract = self._claim(direct_deploy, direct_vm, direct_alice)

        challenge_text = contract.issue_verification_challenge("profile-1", "claim-1")

        assert challenge_text.startswith("PROOFMESH|PROFILE:profile-1|CLAIM:claim-1|WALLET:")
        parts = dict(
            segment.split(":", 1) for segment in challenge_text.split("|")[1:]
        )
        assert parts["PROFILE"] == "profile-1"
        assert parts["CLAIM"] == "claim-1"
        assert parts["WALLET"].lower() == as_hex(direct_alice).lower()
        assert len(parts["NONCE"]) == 10
        assert parts["NONCE"] == parts["NONCE"].upper()
        assert "EXP" in parts

        claim = json.loads(contract.get_identity_claim("claim-1"))
        assert claim["status"] == "CHALLENGE_ISSUED"
        assert claim["challenge_nonce"] == parts["NONCE"]
        assert claim["challenge_expires_at"] == parts["EXP"]

    def test_reissued_challenge_uses_a_fresh_nonce(
        self, direct_deploy, direct_vm, direct_alice
    ):
        contract = self._claim(direct_deploy, direct_vm, direct_alice)
        first = contract.issue_verification_challenge("profile-1", "claim-1")
        direct_vm.warp("2030-01-01T00:00:00Z")
        second = contract.issue_verification_challenge("profile-1", "claim-1")
        assert first != second

    def test_challenge_expiry_is_24_hours_out(self, direct_deploy, direct_vm, direct_alice):
        direct_vm.warp("2030-01-01T00:00:00Z")
        contract = self._claim(direct_deploy, direct_vm, direct_alice)

        challenge_text = contract.issue_verification_challenge("profile-1", "claim-1")
        exp = challenge_text.split("EXP:", 1)[1]
        assert exp == "2030-01-02T00:00:00"

    def test_challenge_on_unknown_claim_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")

        with direct_vm.expect_revert("Claim not found"):
            contract.issue_verification_challenge("profile-1", "no-such-claim")

    def test_challenge_by_non_owner_rejected(
        self, direct_deploy, direct_vm, direct_alice, direct_bob
    ):
        contract = self._claim(direct_deploy, direct_vm, direct_alice)
        direct_vm.sender = direct_bob

        with direct_vm.expect_revert("Only the profile owner may issue a challenge"):
            contract.issue_verification_challenge("profile-1", "claim-1")


# -- Stage groups reserved for future stages (see build brief section 18) --


class TestProofSubmission:
    pass


class TestIdentityEvaluationParsing:
    pass


class TestCredentialIssuance:
    pass


class TestContinuity:
    pass


class TestConflicts:
    pass


class TestTrustPolicies:
    pass


class TestAccessControl:
    pass


class TestPauseBehavior:
    pass


class TestHistoricalRecordImmutability:
    pass
