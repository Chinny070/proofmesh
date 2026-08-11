"""
Stage 1 integration test foundation for ProofMesh.

Run with: gltest tests/integration/ -v -s

Behavioral coverage (deployment, profile/claim/challenge lifecycle,
live/controlled source retrieval, evaluation, continuity, conflicts,
policy evaluation) is implemented stage-by-stage. External blockers,
if any, must be documented honestly rather than mocked away.
"""

import pytest


class TestDeployment:
    def test_placeholder_deploys_to_studionet(self):
        pytest.skip("Stage 8: deploy ProofMesh to StudioNet and verify schema")
