import { useQuery } from "@tanstack/react-query";
import { reads } from "../../lib/genlayer";

/**
 * Read hooks. Every deployed view returns a JSON-encoded string, so each
 * hook parses it into a typed shape. Reads never require a wallet -- they
 * go through the read-only client straight to the RPC endpoint.
 */

function parse<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

export interface ProtocolStatus {
  profile_count: number;
  claim_count: number;
  proof_count: number;
  credential_count: number;
  continuity_count: number;
  identity_challenge_count: number;
  trust_policy_count: number;
}

export interface IdentityProfile {
  id: string;
  owner: string;
  status: string;
  created_at: string;
  updated_at: string;
  claim_count: number;
  credential_count: number;
  active_challenge_id: string;
  continuity_status: string;
}

export interface CredentialRecord {
  id: string;
  profile_id: string;
  policy_id: string;
  credential_type: string;
  status: string;
  confidence_bps: number;
  independent_signal_count: number;
  issued_at: string;
  expires_at: string;
  last_continuity_check: string;
  unresolved_challenges: number;
  reason_codes: string[];
  evidence_refs: string[];
  summary: string;
}

export interface TrustPolicyRecord {
  id: string;
  creator: string;
  name: string;
  credential_type: string;
  minimum_confidence_bps: number;
  minimum_independent_signals: number;
  require_no_active_challenge: boolean;
  require_current_continuity: boolean;
  allowed_claim_types: string[];
  status: string;
  version: number;
  created_at: string;
}

const STALE_TIME = 15_000;

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

export function useCredentials() {
  return useQuery({
    queryKey: ["proofmesh", "credentials"],
    queryFn: async () => parse<CredentialRecord[]>(await reads.listCredentials()),
    staleTime: STALE_TIME,
  });
}

export function useTrustPolicies() {
  return useQuery({
    queryKey: ["proofmesh", "trustPolicies"],
    queryFn: async () => parse<TrustPolicyRecord[]>(await reads.listTrustPolicies()),
    staleTime: STALE_TIME,
  });
}
