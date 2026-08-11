"""
Direct tests for ProofMesh (no simulator, no real web/LLM calls).

Uses gltest's direct execution harness (`direct_vm` / `direct_deploy`
fixtures), which runs the contract in-process against an in-memory
storage manager. datetime.now() is deterministically warped by the VM,
so challenge timestamps/expiry are reproducible.

Stage groups follow the build brief's Stage 18 test plan. Stages 1-3 are
covered here (protocol init, profile creation, claim creation, challenge
generation, proof submission, evaluation freeze); later groups are added
as their stages land.
"""

import hashlib
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


# -- Proof submission --


VALID_CONTENT_HASH = hashlib.sha256(b"evidence-1").hexdigest()


class TestProofSubmission:
    def _challenged_claim(self, direct_deploy, direct_vm, direct_alice, warp=None):
        direct_vm.warp(warp or "2030-01-01T00:00:00Z")
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")
        contract.add_identity_claim(
            "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
        )
        contract.issue_verification_challenge("profile-1", "claim-1")
        # Advance "now" past issuance so observed_at values between issuance
        # and submission time are neither future nor pre-dating the challenge.
        direct_vm.warp("2030-01-01T02:00:00Z")
        return contract

    def test_submit_identity_proof(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)

        result = contract.submit_identity_proof(
            "profile-1",
            "claim-1",
            "proof-1",
            "https://github.com/alexdev",
            "PAGE_TEXT",
            VALID_CONTENT_HASH,
            "2030-01-01T01:00:00",
        )
        assert result == "proof-1"

        proof = json.loads(contract.get_identity_proof("proof-1"))
        assert proof["claim_id"] == "claim-1"
        assert proof["submitter"].lower() == as_hex(direct_alice).lower()
        assert proof["source_url"] == "https://github.com/alexdev"
        assert proof["proof_type"] == "PAGE_TEXT"
        assert proof["content_hash"] == VALID_CONTENT_HASH
        assert proof["observed_at"] == "2030-01-01T01:00:00"
        assert proof["status"] == "SUBMITTED"
        assert proof["challenge_text"].startswith("PROOFMESH|PROFILE:profile-1|CLAIM:claim-1")

        claim = json.loads(contract.get_identity_claim("claim-1"))
        assert claim["status"] == "PROOF_SUBMITTED"
        assert claim["last_verified_at"] == proof["submitted_at"]

        proof_ids = json.loads(contract.get_claim_proof_ids("claim-1"))
        assert proof_ids == ["proof-1"]

        status = json.loads(contract.get_protocol_status())
        assert status["proof_count"] == 1

    def test_second_proof_allowed_before_cap(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)
        contract.submit_identity_proof(
            "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
            "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
        )
        other_hash = hashlib.sha256(b"evidence-2").hexdigest()
        result = contract.submit_identity_proof(
            "profile-1", "claim-1", "proof-2", "https://github.com/alexdev",
            "SCREENSHOT", other_hash, "2030-01-01T02:00:00",
        )
        assert result == "proof-2"
        proof_ids = json.loads(contract.get_claim_proof_ids("claim-1"))
        assert proof_ids == ["proof-1", "proof-2"]

    def test_proof_on_unknown_claim_rejected(self, direct_deploy, direct_vm, direct_alice):
        direct_vm.warp("2030-01-01T00:00:00Z")
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")

        with direct_vm.expect_revert("Claim not found"):
            contract.submit_identity_proof(
                "profile-1", "no-such-claim", "proof-1", "https://github.com/alexdev",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
            )

    def test_proof_claim_profile_mismatch_rejected(
        self, direct_deploy, direct_vm, direct_alice
    ):
        direct_vm.warp("2030-01-01T00:00:00Z")
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")
        contract.create_identity_profile("profile-2")
        contract.add_identity_claim(
            "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
        )
        contract.issue_verification_challenge("profile-1", "claim-1")

        with direct_vm.expect_revert("Claim does not belong to this profile"):
            contract.submit_identity_proof(
                "profile-2", "claim-1", "proof-1", "https://github.com/alexdev",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
            )

    def test_proof_by_non_owner_rejected(
        self, direct_deploy, direct_vm, direct_alice, direct_bob
    ):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)
        direct_vm.sender = direct_bob

        with direct_vm.expect_revert(
            "Only the profile owner may submit the verification proof"
        ):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
            )

    def test_proof_without_active_challenge_rejected(
        self, direct_deploy, direct_vm, direct_alice
    ):
        direct_vm.warp("2030-01-01T00:00:00Z")
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")
        contract.add_identity_claim(
            "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
        )

        with direct_vm.expect_revert(
            "Claim has no active challenge eligible for a proof submission"
        ):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
            )

    def test_expired_challenge_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)
        direct_vm.warp("2030-01-02T00:00:01Z")  # 1 second past the 24h window

        with direct_vm.expect_revert("CHALLENGE_EXPIRED"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-02T00:00:00",
            )

        claim = json.loads(contract.get_identity_claim("claim-1"))
        assert claim["status"] == "CHALLENGE_EXPIRED"

    def test_proof_predating_challenge_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)

        with direct_vm.expect_revert("PROOF_PREDATES_CHALLENGE"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2029-12-31T23:59:59",
            )

    def test_future_observed_at_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)

        with direct_vm.expect_revert("observed_at cannot be in the future"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-05T00:00:00",
            )

    def test_malformed_source_url_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)

        with direct_vm.expect_revert("SOURCE_INACCESSIBLE"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "not-a-url",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
            )

    def test_invalid_content_hash_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)

        with direct_vm.expect_revert("Content hash must be a 64-character"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
                "PAGE_TEXT", "not-a-hash", "2030-01-01T01:00:00",
            )

    def test_invalid_proof_type_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)

        with direct_vm.expect_revert("Proof type must be one of"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
                "NOT_A_TYPE", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
            )

    def test_duplicate_proof_id_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)
        contract.submit_identity_proof(
            "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
            "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
        )
        with direct_vm.expect_revert("Proof ID already exists"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
                "SCREENSHOT", hashlib.sha256(b"evidence-2").hexdigest(), "2030-01-01T02:00:00",
            )

    def test_duplicate_evidence_content_hash_rejected(
        self, direct_deploy, direct_vm, direct_alice
    ):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)
        contract.submit_identity_proof(
            "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
            "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
        )
        with direct_vm.expect_revert("CLAIM_DUPLICATED"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-2", "https://github.com/alexdev",
                "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T02:00:00",
            )

    def test_proof_cap_enforced(self, direct_deploy, direct_vm, direct_alice):
        contract = self._challenged_claim(direct_deploy, direct_vm, direct_alice)
        for i in range(5):
            contract.submit_identity_proof(
                "profile-1", "claim-1", f"proof-{i}", "https://github.com/alexdev",
                "PAGE_TEXT", hashlib.sha256(f"evidence-{i}".encode()).hexdigest(),
                "2030-01-01T01:00:00",
            )
        with direct_vm.expect_revert("Proof cap reached"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-overflow", "https://github.com/alexdev",
                "PAGE_TEXT", hashlib.sha256(b"evidence-overflow").hexdigest(),
                "2030-01-01T01:00:00",
            )


# -- Freeze identity evaluation --


class TestFreezeIdentityEvaluation:
    def _profile_with_proof(self, direct_deploy, direct_vm, direct_alice):
        contract = TestProofSubmission()._challenged_claim(
            direct_deploy, direct_vm, direct_alice
        )
        contract.submit_identity_proof(
            "profile-1", "claim-1", "proof-1", "https://github.com/alexdev",
            "PAGE_TEXT", VALID_CONTENT_HASH, "2030-01-01T01:00:00",
        )
        return contract

    def test_freeze_marks_claim_and_proof_frozen(self, direct_deploy, direct_vm, direct_alice):
        contract = self._profile_with_proof(direct_deploy, direct_vm, direct_alice)

        result = contract.freeze_identity_evaluation("profile-1")
        assert json.loads(result) == ["claim-1"]

        claim = json.loads(contract.get_identity_claim("claim-1"))
        assert claim["status"] == "FROZEN"
        proof = json.loads(contract.get_identity_proof("proof-1"))
        assert proof["status"] == "FROZEN"
        profile = json.loads(contract.get_identity_profile("profile-1"))
        assert profile["status"] == "EVALUATION_FROZEN"

    def test_frozen_evidence_is_immutable(self, direct_deploy, direct_vm, direct_alice):
        contract = self._profile_with_proof(direct_deploy, direct_vm, direct_alice)
        contract.freeze_identity_evaluation("profile-1")

        with direct_vm.expect_revert("Profile is not active"):
            contract.submit_identity_proof(
                "profile-1", "claim-1", "proof-2", "https://github.com/alexdev",
                "SCREENSHOT", hashlib.sha256(b"evidence-2").hexdigest(),
                "2030-01-01T01:00:00",
            )

        with direct_vm.expect_revert("Profile is not active"):
            contract.add_identity_claim(
                "profile-1", "claim-2", "X_PROFILE", "https://x.com/alexdev"
            )

        with direct_vm.expect_revert("Profile is not active"):
            contract.issue_verification_challenge("profile-1", "claim-1")

    def test_freeze_without_any_submitted_proof_rejected(
        self, direct_deploy, direct_vm, direct_alice
    ):
        direct_vm.warp("2030-01-01T00:00:00Z")
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice
        contract.create_identity_profile("profile-1")
        contract.add_identity_claim(
            "profile-1", "claim-1", "GITHUB_PROFILE", "https://github.com/alexdev"
        )

        with direct_vm.expect_revert("INSUFFICIENT_EVIDENCE"):
            contract.freeze_identity_evaluation("profile-1")

    def test_freeze_by_non_owner_rejected(
        self, direct_deploy, direct_vm, direct_alice, direct_bob
    ):
        contract = self._profile_with_proof(direct_deploy, direct_vm, direct_alice)
        direct_vm.sender = direct_bob

        with direct_vm.expect_revert("Only the profile owner may freeze the evaluation"):
            contract.freeze_identity_evaluation("profile-1")

    def test_freeze_unknown_profile_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = deploy(direct_deploy)
        direct_vm.sender = direct_alice

        with direct_vm.expect_revert("Profile not found"):
            contract.freeze_identity_evaluation("no-such-profile")

    def test_double_freeze_rejected(self, direct_deploy, direct_vm, direct_alice):
        contract = self._profile_with_proof(direct_deploy, direct_vm, direct_alice)
        contract.freeze_identity_evaluation("profile-1")

        with direct_vm.expect_revert("Profile is not active"):
            contract.freeze_identity_evaluation("profile-1")


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
