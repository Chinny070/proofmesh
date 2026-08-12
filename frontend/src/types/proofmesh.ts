/**
 * ProofMesh domain record shapes. These mirror the JSON payloads returned
 * by the deployed contract's views (see docs/credential-schema.md and
 * docs/deployed-schema.json). Every deployed view returns a JSON-encoded
 * string; these types describe the parsed result.
 */

export interface IdentityProfile {
  id: string;
  owner: string;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  claim_count: number;
  credential_count: number;
  active_challenge_id: string;
  continuity_status: string;
}

export type ProfileStatus =
  | "ACTIVE"
  | "EVALUATION_FROZEN"
  | "EVALUATION_REJECTED"
  | "CREDENTIALED";

export interface IdentityClaim {
  profile_id: string;
  claim_id: string;
  claim_type: ClaimType;
  claim_value: string;
  normalized_url: string;
  status: ClaimStatus;
  created_at: string;
  last_verified_at: string;
  challenge_nonce: string;
  challenge_expires_at: string;
}

export type ClaimStatus =
  | "PENDING"
  | "CHALLENGE_ISSUED"
  | "CHALLENGE_EXPIRED"
  | "PROOF_SUBMITTED"
  | "FROZEN";

export interface ProofRecord {
  claim_id: string;
  proof_id: string;
  submitter: string;
  source_url: string;
  proof_type: ProofType;
  challenge_text: string;
  content_hash: string;
  observed_at: string;
  submitted_at: string;
  status: "SUBMITTED" | "FROZEN";
}

export interface CredentialRecord {
  id: string;
  profile_id: string;
  policy_id: string;
  credential_type: CredentialType;
  status: CredentialStatus;
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

export type CredentialStatus =
  | "ACTIVE"
  | "RECHECK_DUE"
  | "STALE"
  | "CHALLENGED"
  | "TRANSFERRED"
  | "REVOKED"
  | "EXPIRED";

export interface ContinuityRecord {
  id: string;
  profile_id: string;
  credential_id: string;
  requested_at: string;
  evaluated_at: string;
  status: string;
  continuity_risk_bps: number;
  reason_codes: string[];
  evidence_refs: string[];
  summary: string;
}

export interface IdentityChallengeRecord {
  id: string;
  credential_id: string;
  challenger: string;
  competing_profile_id: string;
  reason_code: ChallengeReason;
  statement: string;
  evidence_refs: string[];
  status: "OPEN" | "FROZEN" | "RESOLVED";
  opened_at: string;
  frozen_at: string;
  resolved_at: string;
  resolution: ChallengeDecision | "";
  summary: string;
}

export type ChallengeDecision =
  | "UPHOLD"
  | "TRANSFER"
  | "REVOKE"
  | "REQUIRE_REVERIFICATION";

export interface TrustPolicyRecord {
  id: string;
  creator: string;
  name: string;
  credential_type: CredentialType;
  minimum_confidence_bps: number;
  minimum_independent_signals: number;
  require_no_active_challenge: boolean;
  require_current_continuity: boolean;
  allowed_claim_types: ClaimType[];
  status: "ACTIVE" | "INACTIVE";
  version: number;
  created_at: string;
}

export interface PolicyEvaluationResult {
  satisfied: boolean;
  policy_id: string;
  profile_id: string;
  credential_id: string;
  credential_type: string;
  confidence_bps: number;
  independent_signal_count: number;
  continuity_current: boolean;
  active_challenge: boolean;
  failure_reasons: string[];
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

export interface IdentityStatusSummary {
  profile_id: string;
  owner: string;
  status: ProfileStatus;
  continuity_status: string;
  active_challenge_id: string;
  claim_count: number;
  credential_count: number;
  claim_ids: string[];
  credential_ids: string[];
}

// -- Contract allowlists (must match contracts/proofmesh.py) --------------

export const CLAIM_TYPES = [
  "GITHUB_PROFILE",
  "X_PROFILE",
  "PERSONAL_WEBSITE",
  "PROJECT_WEBSITE",
  "TEAM_PAGE",
  "DEVELOPER_PROFILE",
  "COMMUNITY_PROFILE",
  "ORG_PAGE",
] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const PROOF_TYPES = [
  "PAGE_TEXT",
  "SCREENSHOT",
  "API_RESPONSE",
  "SIGNED_MESSAGE",
] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

export const CREDENTIAL_TYPES = [
  "BASIC_IDENTITY",
  "BASIC_COMMUNITY_MEMBER",
  "VERIFIED_DEVELOPER",
  "VERIFIED_PROJECT_FOUNDER",
  "VERIFIED_COMMUNITY_MEMBER",
  "VERIFIED_ORG_REPRESENTATIVE",
] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export const CHALLENGE_REASONS = [
  "ACCOUNT_OWNERSHIP_CHANGED",
  "PROOF_STALE",
  "CLAIM_DUPLICATED",
  "CLAIM_FABRICATED",
  "SOURCE_COMPROMISED",
  "ACCOUNT_TRANSFERRED",
  "CREDENTIAL_POLICY_NO_LONGER_SATISFIED",
  "CONFLICTING_WALLET_CLAIM",
] as const;
export type ChallengeReason = (typeof CHALLENGE_REASONS)[number];

/** Reasons the contract requires a competing_profile_id for. */
export const REASONS_REQUIRING_COMPETING_PROFILE: readonly ChallengeReason[] = [
  "CONFLICTING_WALLET_CLAIM",
  "ACCOUNT_TRANSFERRED",
];

// -- Human-facing labels --------------------------------------------------

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  GITHUB_PROFILE: "GitHub profile",
  X_PROFILE: "X / Twitter profile",
  PERSONAL_WEBSITE: "Personal website",
  PROJECT_WEBSITE: "Project website",
  TEAM_PAGE: "Team page",
  DEVELOPER_PROFILE: "Developer profile",
  COMMUNITY_PROFILE: "Community profile",
  ORG_PAGE: "Organization page",
};

export const CLAIM_TYPE_HINTS: Record<ClaimType, string> = {
  GITHUB_PROFILE: "https://github.com/yourhandle",
  X_PROFILE: "https://x.com/yourhandle",
  PERSONAL_WEBSITE: "https://yourname.dev",
  PROJECT_WEBSITE: "https://yourproject.xyz",
  TEAM_PAGE: "https://yourproject.xyz/team",
  DEVELOPER_PROFILE: "https://yourprofile.dev",
  COMMUNITY_PROFILE: "https://community.example/u/you",
  ORG_PAGE: "https://yourorg.com/about",
};

export const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  PAGE_TEXT: "Page text",
  SCREENSHOT: "Screenshot",
  API_RESPONSE: "API response",
  SIGNED_MESSAGE: "Signed message",
};

export const CHALLENGE_REASON_LABELS: Record<ChallengeReason, string> = {
  ACCOUNT_OWNERSHIP_CHANGED: "Account ownership changed",
  PROOF_STALE: "Proof is stale",
  CLAIM_DUPLICATED: "Claim is duplicated",
  CLAIM_FABRICATED: "Claim is fabricated",
  SOURCE_COMPROMISED: "Source is compromised",
  ACCOUNT_TRANSFERRED: "Account was transferred",
  CREDENTIAL_POLICY_NO_LONGER_SATISFIED: "Credential policy no longer satisfied",
  CONFLICTING_WALLET_CLAIM: "Conflicting wallet claim",
};

export const CREDENTIAL_STATUS_DESCRIPTIONS: Record<CredentialStatus, string> = {
  ACTIVE: "Currently trustworthy and within its validity window.",
  RECHECK_DUE: "Still valid, but risk has increased — re-verification recommended.",
  STALE: "Not currently valid for an uncertain reason (e.g. an unreachable source).",
  CHALLENGED: "Locked under an active dispute until adjudication resolves it.",
  TRANSFERRED: "Historical record — control moved to another profile.",
  REVOKED: "Finalized as not trustworthy.",
  EXPIRED: "Past its expiry date.",
};

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function shortenAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatTimestamp(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
