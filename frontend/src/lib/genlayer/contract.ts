/**
 * Typed ProofMesh contract adapter.
 *
 * Every method name, parameter name, and parameter order below is taken
 * directly from the live deployed schema (docs/deployed-schema.json,
 * fetched from the contract itself at
 * 0xfC0504f92783F1418e333AECb6CB587E24979e2a on StudioNet) -- not from
 * memory of the Python source. Page components must never call
 * genlayer-js's `readContract`/`writeContract` directly; they call the
 * functions in this file instead.
 */
import type { CalldataEncodable } from "genlayer-js/types";
import { PROOFMESH_CONTRACT_ADDRESS } from "./chain";
import { getReadClient, getWriteClient } from "./client";
import { normalizeError } from "./errors";
import type { NormalizedError } from "./types";

export class ContractCallError extends Error {
  normalized: NormalizedError;
  constructor(normalized: NormalizedError) {
    super(normalized.message);
    this.name = "ContractCallError";
    this.normalized = normalized;
  }
}

async function readMethod(
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<string> {
  try {
    const client = getReadClient();
    const result = await client.readContract({
      address: PROOFMESH_CONTRACT_ADDRESS,
      functionName,
      args,
    });
    return result as string;
  } catch (err) {
    throw new ContractCallError(normalizeError(err));
  }
}

/**
 * Submits a write transaction and returns its hash. Does NOT wait for
 * finality -- callers drive the transaction lifecycle themselves via
 * lib/genlayer/receipts.ts's `trackTransaction`, per the state machine
 * (submitted -> pending -> accepted -> awaiting_finality -> finalized_*).
 */
async function writeMethod(
  account: `0x${string}`,
  functionName: string,
  args: CalldataEncodable[] = [],
): Promise<`0x${string}`> {
  try {
    const client = getWriteClient(account);
    const hash = await client.writeContract({
      address: PROOFMESH_CONTRACT_ADDRESS,
      functionName,
      args,
      value: 0n,
    });
    return hash as `0x${string}`;
  } catch (err) {
    throw new ContractCallError(normalizeError(err));
  }
}

// -- Reads (20) --------------------------------------------------------

export const reads = {
  getProtocolStatus: () => readMethod("get_protocol_status"),
  getIdentityProfile: (profileId: string) => readMethod("get_identity_profile", [profileId]),
  getIdentityClaim: (claimId: string) => readMethod("get_identity_claim", [claimId]),
  getProfileClaimIds: (profileId: string) => readMethod("get_profile_claim_ids", [profileId]),
  getIdentityStatus: (profileId: string) => readMethod("get_identity_status", [profileId]),
  listProfiles: () => readMethod("list_profiles"),
  getIdentityProof: (proofId: string) => readMethod("get_identity_proof", [proofId]),
  getClaimProofIds: (claimId: string) => readMethod("get_claim_proof_ids", [claimId]),
  getCredential: (credentialId: string) => readMethod("get_credential", [credentialId]),
  listCredentials: () => readMethod("list_credentials"),
  getProfileCredentialIds: (profileId: string) =>
    readMethod("get_profile_credential_ids", [profileId]),
  getContinuityRecord: (continuityId: string) =>
    readMethod("get_continuity_record", [continuityId]),
  getCredentialContinuityIds: (credentialId: string) =>
    readMethod("get_credential_continuity_ids", [credentialId]),
  getContinuityStatus: (profileId: string) => readMethod("get_continuity_status", [profileId]),
  getIdentityChallenge: (challengeId: string) =>
    readMethod("get_identity_challenge", [challengeId]),
  getCredentialChallengeIds: (credentialId: string) =>
    readMethod("get_credential_challenge_ids", [credentialId]),
  getTrustPolicy: (policyId: string) => readMethod("get_trust_policy", [policyId]),
  getTrustPolicyVersions: (name: string) => readMethod("get_trust_policy_versions", [name]),
  listTrustPolicies: () => readMethod("list_trust_policies"),
  evaluatePolicyView: (profileId: string, policyId: string, credentialId: string) =>
    readMethod("evaluate_policy_view", [profileId, policyId, credentialId]),
} as const;

// -- Writes (13) ---------------------------------------------------------

export const writes = {
  createIdentityProfile: (account: `0x${string}`, profileId: string) =>
    writeMethod(account, "create_identity_profile", [profileId]),

  addIdentityClaim: (
    account: `0x${string}`,
    profileId: string,
    claimId: string,
    claimType: string,
    claimValue: string,
  ) => writeMethod(account, "add_identity_claim", [profileId, claimId, claimType, claimValue]),

  issueVerificationChallenge: (account: `0x${string}`, profileId: string, claimId: string) =>
    writeMethod(account, "issue_verification_challenge", [profileId, claimId]),

  submitIdentityProof: (
    account: `0x${string}`,
    profileId: string,
    claimId: string,
    proofId: string,
    sourceUrl: string,
    proofType: string,
    contentHash: string,
    observedAt: string,
  ) =>
    writeMethod(account, "submit_identity_proof", [
      profileId,
      claimId,
      proofId,
      sourceUrl,
      proofType,
      contentHash,
      observedAt,
    ]),

  freezeIdentityEvaluation: (account: `0x${string}`, profileId: string) =>
    writeMethod(account, "freeze_identity_evaluation", [profileId]),

  evaluateIdentity: (account: `0x${string}`, profileId: string, policyId: string) =>
    writeMethod(account, "evaluate_identity", [profileId, policyId]),

  requestContinuityCheck: (account: `0x${string}`, profileId: string, credentialId: string) =>
    writeMethod(account, "request_continuity_check", [profileId, credentialId]),

  evaluateContinuity: (account: `0x${string}`, continuityId: string) =>
    writeMethod(account, "evaluate_continuity", [continuityId]),

  openIdentityChallenge: (
    account: `0x${string}`,
    credentialId: string,
    competingProfileId: string,
    reasonCode: string,
    statement: string,
  ) =>
    writeMethod(account, "open_identity_challenge", [
      credentialId,
      competingProfileId,
      reasonCode,
      statement,
    ]),

  submitChallengeEvidence: (account: `0x${string}`, challengeId: string, proofId: string) =>
    writeMethod(account, "submit_challenge_evidence", [challengeId, proofId]),

  freezeIdentityChallenge: (account: `0x${string}`, challengeId: string) =>
    writeMethod(account, "freeze_identity_challenge", [challengeId]),

  evaluateIdentityChallenge: (account: `0x${string}`, challengeId: string) =>
    writeMethod(account, "evaluate_identity_challenge", [challengeId]),

  createTrustPolicy: (
    account: `0x${string}`,
    name: string,
    credentialType: string,
    minimumConfidenceBps: number,
    minimumIndependentSignals: number,
    requireNoActiveChallenge: boolean,
    requireCurrentContinuity: boolean,
    allowedClaimTypes: string[],
  ) =>
    writeMethod(account, "create_trust_policy", [
      name,
      credentialType,
      minimumConfidenceBps,
      minimumIndependentSignals,
      requireNoActiveChallenge,
      requireCurrentContinuity,
      allowedClaimTypes,
    ]),
} as const;
