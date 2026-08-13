import { useQueries, useQuery } from "@tanstack/react-query";
import { isRetryableError, reads } from "../../lib/genlayer";
import type {
  ContinuityRecord,
  CredentialRecord,
  IdentityChallengeRecord,
  IdentityClaim,
  IdentityProfile,
  IdentityStatusSummary,
  PolicyEvaluationResult,
  ProofRecord,
  ProtocolStatus,
  TrustPolicyRecord,
} from "../../types/proofmesh";

/**
 * Typed read hooks over the deployed ProofMesh views. Every view returns a
 * JSON-encoded string, so each hook parses into the domain type. Reads
 * never require a wallet — they go through the read-only client.
 */

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

const STALE_TIME = 10_000;

/**
 * Retry policy for contract reads. A contract revert (e.g. the record
 * genuinely does not exist) is deterministic and is surfaced immediately.
 * A transport failure gets two retries, so a single RPC blip never
 * renders as "record not found" — which would read like data loss.
 */
const retry = (failureCount: number, error: Error) =>
  failureCount < 2 && isRetryableError(error);

export function useProtocolStatus() {
  return useQuery({
    queryKey: ["proofmesh", "protocolStatus"],
    queryFn: async () => parse<ProtocolStatus>(await reads.getProtocolStatus()),
    staleTime: STALE_TIME,
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["proofmesh", "profiles"],
    queryFn: async () => parse<IdentityProfile[]>(await reads.listProfiles()),
    staleTime: STALE_TIME,
  });
}

export function useProfile(profileId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "profile", profileId],
    queryFn: async () => parse<IdentityProfile>(await reads.getIdentityProfile(profileId!)),
    enabled: Boolean(profileId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useIdentityStatus(profileId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "identityStatus", profileId],
    queryFn: async () =>
      parse<IdentityStatusSummary>(await reads.getIdentityStatus(profileId!)),
    enabled: Boolean(profileId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useProfileClaimIds(profileId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "profileClaimIds", profileId],
    queryFn: async () => parse<string[]>(await reads.getProfileClaimIds(profileId!)),
    enabled: Boolean(profileId),
    staleTime: STALE_TIME,
    retry,
  });
}

/** Fetches every claim belonging to a profile. */
export function useProfileClaims(profileId: string | undefined) {
  const claimIds = useProfileClaimIds(profileId);
  const claimQueries = useQueries({
    queries: (claimIds.data ?? []).map((claimId) => ({
      queryKey: ["proofmesh", "claim", claimId],
      queryFn: async () => parse<IdentityClaim>(await reads.getIdentityClaim(claimId)),
      staleTime: STALE_TIME,
    })),
  });

  return {
    isLoading: claimIds.isLoading || claimQueries.some((q) => q.isLoading),
    error: claimIds.error ?? claimQueries.find((q) => q.error)?.error ?? null,
    data: claimQueries.every((q) => q.data)
      ? (claimQueries.map((q) => q.data) as IdentityClaim[])
      : undefined,
  };
}

export function useClaim(claimId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "claim", claimId],
    queryFn: async () => parse<IdentityClaim>(await reads.getIdentityClaim(claimId!)),
    enabled: Boolean(claimId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useClaimProofIds(claimId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "claimProofIds", claimId],
    queryFn: async () => parse<string[]>(await reads.getClaimProofIds(claimId!)),
    enabled: Boolean(claimId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useProof(proofId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "proof", proofId],
    queryFn: async () => parse<ProofRecord>(await reads.getIdentityProof(proofId!)),
    enabled: Boolean(proofId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useCredentials() {
  return useQuery({
    queryKey: ["proofmesh", "credentials"],
    queryFn: async () => parse<CredentialRecord[]>(await reads.listCredentials()),
    staleTime: STALE_TIME,
  });
}

export function useCredential(credentialId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "credential", credentialId],
    queryFn: async () => parse<CredentialRecord>(await reads.getCredential(credentialId!)),
    enabled: Boolean(credentialId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useProfileCredentialIds(profileId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "profileCredentialIds", profileId],
    queryFn: async () => parse<string[]>(await reads.getProfileCredentialIds(profileId!)),
    enabled: Boolean(profileId),
    staleTime: STALE_TIME,
    retry,
  });
}

/** Fetches every credential belonging to a profile. */
export function useProfileCredentials(profileId: string | undefined) {
  const ids = useProfileCredentialIds(profileId);
  const queries = useQueries({
    queries: (ids.data ?? []).map((credentialId) => ({
      queryKey: ["proofmesh", "credential", credentialId],
      queryFn: async () => parse<CredentialRecord>(await reads.getCredential(credentialId)),
      staleTime: STALE_TIME,
    })),
  });

  return {
    isLoading: ids.isLoading || queries.some((q) => q.isLoading),
    error: ids.error ?? queries.find((q) => q.error)?.error ?? null,
    data: queries.every((q) => q.data)
      ? (queries.map((q) => q.data) as CredentialRecord[])
      : undefined,
  };
}

export function useContinuityStatus(profileId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "continuityStatus", profileId],
    queryFn: async () => parse<string>(await reads.getContinuityStatus(profileId!)),
    enabled: Boolean(profileId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useCredentialContinuityIds(credentialId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "credentialContinuityIds", credentialId],
    queryFn: async () => parse<string[]>(await reads.getCredentialContinuityIds(credentialId!)),
    enabled: Boolean(credentialId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useContinuityRecords(credentialId: string | undefined) {
  const ids = useCredentialContinuityIds(credentialId);
  const queries = useQueries({
    queries: (ids.data ?? []).map((continuityId) => ({
      queryKey: ["proofmesh", "continuityRecord", continuityId],
      queryFn: async () =>
        parse<ContinuityRecord>(await reads.getContinuityRecord(continuityId)),
      staleTime: STALE_TIME,
    })),
  });

  return {
    isLoading: ids.isLoading || queries.some((q) => q.isLoading),
    error: ids.error ?? queries.find((q) => q.error)?.error ?? null,
    data: queries.every((q) => q.data)
      ? (queries.map((q) => q.data) as ContinuityRecord[])
      : undefined,
  };
}

export function useCredentialChallengeIds(credentialId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "credentialChallengeIds", credentialId],
    queryFn: async () => parse<string[]>(await reads.getCredentialChallengeIds(credentialId!)),
    enabled: Boolean(credentialId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useIdentityChallenge(challengeId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "challenge", challengeId],
    queryFn: async () =>
      parse<IdentityChallengeRecord>(await reads.getIdentityChallenge(challengeId!)),
    enabled: Boolean(challengeId),
    staleTime: STALE_TIME,
    retry,
  });
}

/**
 * There is no `list_challenges` view on the contract, so the challenge
 * index is derived: every credential's challenge-id list, fanned out.
 */
export function useAllChallenges() {
  const credentials = useCredentials();
  const idQueries = useQueries({
    queries: (credentials.data ?? []).map((credential) => ({
      queryKey: ["proofmesh", "credentialChallengeIds", credential.id],
      queryFn: async () => parse<string[]>(await reads.getCredentialChallengeIds(credential.id)),
      staleTime: STALE_TIME,
    })),
  });

  const challengeIds = idQueries.flatMap((q) => q.data ?? []);
  const challengeQueries = useQueries({
    queries: challengeIds.map((challengeId) => ({
      queryKey: ["proofmesh", "challenge", challengeId],
      queryFn: async () =>
        parse<IdentityChallengeRecord>(await reads.getIdentityChallenge(challengeId)),
      staleTime: STALE_TIME,
    })),
  });

  return {
    isLoading:
      credentials.isLoading ||
      idQueries.some((q) => q.isLoading) ||
      challengeQueries.some((q) => q.isLoading),
    error:
      credentials.error ??
      idQueries.find((q) => q.error)?.error ??
      challengeQueries.find((q) => q.error)?.error ??
      null,
    data: challengeQueries.every((q) => q.data)
      ? (challengeQueries.map((q) => q.data) as IdentityChallengeRecord[])
      : undefined,
  };
}

export function useTrustPolicies() {
  return useQuery({
    queryKey: ["proofmesh", "trustPolicies"],
    queryFn: async () => parse<TrustPolicyRecord[]>(await reads.listTrustPolicies()),
    staleTime: STALE_TIME,
  });
}

export function useTrustPolicy(policyId: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "trustPolicy", policyId],
    queryFn: async () => parse<TrustPolicyRecord>(await reads.getTrustPolicy(policyId!)),
    enabled: Boolean(policyId),
    staleTime: STALE_TIME,
    retry,
  });
}

export function useTrustPolicyVersions(name: string | undefined) {
  return useQuery({
    queryKey: ["proofmesh", "trustPolicyVersions", name],
    queryFn: async () => parse<string[]>(await reads.getTrustPolicyVersions(name!)),
    enabled: Boolean(name),
    staleTime: STALE_TIME,
    retry,
  });
}

/**
 * Deterministic policy evaluation. Disabled until all three ids are
 * present so it never fires a malformed call.
 */
export function usePolicyEvaluation(
  profileId: string | undefined,
  policyId: string | undefined,
  credentialId: string | undefined,
) {
  return useQuery({
    queryKey: ["proofmesh", "policyEvaluation", profileId, policyId, credentialId],
    queryFn: async () =>
      parse<PolicyEvaluationResult>(
        await reads.evaluatePolicyView(profileId!, policyId!, credentialId!),
      ),
    enabled: Boolean(profileId && policyId && credentialId),
    staleTime: STALE_TIME,
    retry,
  });
}
