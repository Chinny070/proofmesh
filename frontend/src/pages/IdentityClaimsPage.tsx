import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { writes } from "../lib/genlayer";
import {
  useProfile,
  useProfileClaims,
} from "../features/contract/useProofMeshRead";
import { useProofMeshWrite } from "../features/contract/useProofMeshWrite";
import { useWallet } from "../features/wallet/useWallet";
import { WalletGate } from "../components/WalletPanel";
import { TransactionStatus } from "../components/TransactionStatus";
import {
  Breadcrumb,
  ErrorNote,
  Loading,
  PageHead,
  RecordNotFound,
  StatusBadge,
} from "../components/ui";
import {
  CLAIM_TYPES,
  CLAIM_TYPE_HINTS,
  CLAIM_TYPE_LABELS,
  PROOF_TYPES,
  PROOF_TYPE_LABELS,
  formatTimestamp,
} from "../types/proofmesh";
import type { ClaimType, IdentityClaim, ProofType } from "../types/proofmesh";

const WIZARD_STEPS = [
  "Choose source",
  "Create claim",
  "Get challenge",
  "Publish it",
  "Submit proof",
  "Freeze & evaluate",
];

/** Which wizard step a claim is currently sitting at. */
function stepForClaim(claim: IdentityClaim | undefined): number {
  if (!claim) return 0;
  switch (claim.status) {
    case "PENDING":
      return 2;
    case "CHALLENGE_ISSUED":
      return 3;
    case "CHALLENGE_EXPIRED":
      return 2;
    case "PROOF_SUBMITTED":
      return 5;
    case "FROZEN":
      return 5;
    default:
      return 0;
  }
}

export default function IdentityClaimsPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const profile = useProfile(profileId);
  const claims = useProfileClaims(profileId);
  const wallet = useWallet();

  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const isOwner =
    wallet.address && profile.data
      ? wallet.address.toLowerCase() === profile.data.owner.toLowerCase()
      : false;

  const activeClaim = useMemo(
    () => claims.data?.find((c) => c.claim_id === selectedClaimId),
    [claims.data, selectedClaimId],
  );

  if (profile.isLoading) return <Loading label="Loading profile…" />;
  if (profile.error || !profile.data) {
    return (
      <RecordNotFound
        kind="Profile"
        id={profileId}
        error={profile.error}
        backTo="/identity"
        backLabel="Back to identities"
      />
    );
  }

  const p = profile.data;
  const frozen = p.status !== "ACTIVE";

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <Breadcrumb
        items={[
          { label: "Identity", to: "/identity" },
          { label: p.id, to: `/identity/${encodeURIComponent(p.id)}` },
          { label: "Claims" },
        ]}
      />

      <PageHead eyebrow="Claim wizard" title="Prove your identity sources">
        <p>
          Each claim links your wallet to one public identity you control. ProofMesh gives you a
          unique challenge to publish at that source, then validators check it independently.
        </p>
      </PageHead>

      <ol className="wizard-steps" aria-label="Verification steps">
        {WIZARD_STEPS.map((label, i) => {
          const current = stepForClaim(activeClaim);
          return (
            <li key={label} data-state={i < current ? "done" : i === current ? "current" : "todo"}>
              {label}
            </li>
          );
        })}
      </ol>

      <p className="note note-info">
        <strong>ProofMesh cannot post on your behalf.</strong> You publish the challenge text
        yourself at the identity source — a GitHub gist or profile bio, an X post, a page on your
        website. ProofMesh only reads what's publicly there.
      </p>

      {!isOwner && (
        <p className="note note-warn">
          You are viewing someone else's profile. Only <code>{p.owner}</code> can add claims or
          submit proofs here.
        </p>
      )}

      {frozen && (
        <p className="note note-warn">
          This profile is <StatusBadge status={p.status} /> — its evidence set is locked and no
          further claims or proofs can be added.
        </p>
      )}

      {claims.error && <ErrorNote error={claims.error} context="Could not load claims" />}
      {claims.isLoading && <Loading label="Loading claims…" />}

      {claims.data && claims.data.length > 0 && (
        <section className="card" aria-labelledby="existing-h">
          <h2 id="existing-h">Claims on this profile</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">URL</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last verified</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {claims.data.map((claim) => (
                  <tr key={claim.claim_id}>
                    <td>{CLAIM_TYPE_LABELS[claim.claim_type]}</td>
                    <td className="mono small">{claim.claim_value}</td>
                    <td>
                      <StatusBadge status={claim.status} />
                    </td>
                    <td className="small dim">
                      {claim.last_verified_at ? formatTimestamp(claim.last_verified_at) : "—"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setSelectedClaimId(
                            selectedClaimId === claim.claim_id ? null : claim.claim_id,
                          )
                        }
                        aria-expanded={selectedClaimId === claim.claim_id}
                      >
                        {selectedClaimId === claim.claim_id ? "Hide details" : "Show details"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isOwner && activeClaim && (
        <ClaimProgressPanel
          profileId={p.id}
          profileOwner={p.owner}
          claim={activeClaim}
          disabled={frozen}
        />
      )}

      {isOwner && !frozen && (
        <AddClaimForm profileId={p.id} onCreated={(claimId) => setSelectedClaimId(claimId)} />
      )}

      {isOwner && (
        <FreezeAndEvaluatePanel profileId={p.id} profileStatus={p.status} claims={claims.data ?? []} />
      )}
    </div>
  );
}

// -- Add claim ------------------------------------------------------------

function AddClaimForm({
  profileId,
  onCreated,
}: {
  profileId: string;
  onCreated: (claimId: string) => void;
}) {
  const [claimType, setClaimType] = useState<ClaimType>("GITHUB_PROFILE");
  const [claimValue, setClaimValue] = useState("");
  const [claimId, setClaimId] = useState("");
  const [touched, setTouched] = useState(false);
  const write = useProofMeshWrite();

  const trimmedValue = claimValue.trim();
  const trimmedId = claimId.trim();

  const error = !trimmedId
    ? "Give this claim a short identifier."
    : !/^[A-Za-z0-9._-]+$/.test(trimmedId)
      ? "Use letters, numbers, dots, dashes, or underscores only."
      : !trimmedValue
        ? "Enter the URL of the identity source."
        : !/^https?:\/\/.+\..+/.test(trimmedValue)
          ? "Enter a full URL starting with https://"
          : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (error) return;
    const result = await write.execute((account) =>
      writes.addIdentityClaim(account, profileId, trimmedId, claimType, trimmedValue),
    );
    if (result.state === "finalized_success") {
      onCreated(trimmedId);
      setClaimValue("");
      setClaimId("");
      setTouched(false);
      write.reset();
    }
  }

  return (
    <section className="card" aria-labelledby="add-claim-h">
      <h2 id="add-claim-h">Add an identity claim</h2>
      <WalletGate>
        <form onSubmit={handleSubmit} noValidate style={{ maxWidth: "36rem" }}>
          <div className="field">
            <label htmlFor="claimType">Identity source</label>
            <select
              id="claimType"
              value={claimType}
              onChange={(e) => setClaimType(e.target.value as ClaimType)}
              disabled={write.isPending}
            >
              {CLAIM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CLAIM_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="claimValue">Public URL</label>
            <input
              id="claimValue"
              type="url"
              value={claimValue}
              onChange={(e) => setClaimValue(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={CLAIM_TYPE_HINTS[claimType]}
              aria-describedby="claimValue-hint"
              disabled={write.isPending}
            />
            <p className="field-hint" id="claimValue-hint">
              The page validators will fetch. Must be publicly reachable.
            </p>
          </div>

          <div className="field">
            <label htmlFor="claimId">Claim identifier</label>
            <input
              id="claimId"
              type="text"
              value={claimId}
              onChange={(e) => setClaimId(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="github-main"
              aria-describedby="claimId-hint"
              disabled={write.isPending}
            />
            <p className="field-hint" id="claimId-hint">
              A short unique name for this claim, used in evidence references.
            </p>
          </div>

          {touched && error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={write.isPending || Boolean(error)}
          >
            {write.isPending ? "Creating claim…" : "Create claim"}
          </button>
        </form>
        <TransactionStatus progress={write.progress} />
      </WalletGate>
    </section>
  );
}

// -- Per-claim progress: challenge → proof --------------------------------

function ClaimProgressPanel({
  profileId,
  profileOwner,
  claim,
  disabled,
}: {
  profileId: string;
  profileOwner: string;
  claim: IdentityClaim;
  disabled: boolean;
}) {
  const challengeWrite = useProofMeshWrite();
  const [challengeText, setChallengeText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const expired =
    claim.challenge_expires_at && new Date(claim.challenge_expires_at) < new Date();
  const issuedChallenge =
    challengeText ??
    (claim.challenge_nonce && claim.challenge_expires_at
      ? `PROOFMESH|PROFILE:${profileId}|CLAIM:${claim.claim_id}|WALLET:${profileOwner}|NONCE:${claim.challenge_nonce}|EXP:${claim.challenge_expires_at}`
      : null);

  async function issueChallenge() {
    setChallengeText(null);
    const result = await challengeWrite.execute((account) =>
      writes.issueVerificationChallenge(account, profileId, claim.claim_id),
    );
    if (result.state === "finalized_success" && typeof result.result === "string") {
      setChallengeText(result.result);
    }
  }

  async function copyChallenge() {
    if (!challengeText) return;
    try {
      await navigator.clipboard.writeText(challengeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="card card-lift" aria-labelledby="progress-h">
      <div className="row row-between">
        <h2 id="progress-h" style={{ margin: 0 }}>
          {CLAIM_TYPE_LABELS[claim.claim_type]}
        </h2>
        <StatusBadge status={claim.status} />
      </div>
      <p className="mono small faint" style={{ marginTop: "0.35rem" }}>
        {claim.claim_value}
      </p>

      {/* Step: issue challenge */}
      {(claim.status === "PENDING" || claim.status === "CHALLENGE_EXPIRED") && !disabled && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Get your verification challenge</h3>
          <p className="dim small">
            ProofMesh generates a unique message tied to your wallet, this claim, a random nonce,
            and a 24-hour expiry.
          </p>
          {claim.status === "CHALLENGE_EXPIRED" && (
            <p className="note note-warn">
              The previous challenge expired. Issue a fresh one to continue.
            </p>
          )}
          <WalletGate>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void issueChallenge()}
              disabled={challengeWrite.isPending}
            >
              {challengeWrite.isPending ? "Issuing…" : "Issue verification challenge"}
            </button>
            <TransactionStatus progress={challengeWrite.progress} />
          </WalletGate>
        </div>
      )}

      {/* Step: publish challenge */}
      {claim.status === "CHALLENGE_ISSUED" && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Publish this exact text at your identity source</h3>
          {challengeText ? (
            <>
              <code className="challenge-text">{challengeText}</code>
              <div className="row">
                <button type="button" className="btn btn-sm" onClick={() => void copyChallenge()}>
                  {copied ? "Copied" : "Copy challenge text"}
                </button>
                <a
                  className="btn btn-sm"
                  href={claim.claim_value}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open source ↗
                </a>
              </div>
            </>
          ) : (
            <p className="note note-warn">
              <strong>The challenge text is only returned when it's issued.</strong>
              <br />
              It isn't stored in a readable view, so if you've navigated away since issuing it,
              issue a fresh challenge below to see the full text again. Your current challenge
              nonce is <code>{claim.challenge_nonce}</code>, expiring{" "}
              {formatTimestamp(claim.challenge_expires_at)}.
            </p>
          )}

          <p className="dim small">
            Post it publicly — a gist, your profile bio, a plain page on your site. Validators
            will fetch <code>{claim.claim_value}</code> and look for it.
          </p>

          {expired && (
            <p className="note note-bad">
              This challenge has expired. Issue a new one before submitting a proof.
            </p>
          )}

          {!disabled && (
            <WalletGate>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void issueChallenge()}
                disabled={challengeWrite.isPending}
              >
                {challengeWrite.isPending ? "Issuing…" : "Issue a fresh challenge"}
              </button>
              <TransactionStatus progress={challengeWrite.progress} />
            </WalletGate>
          )}

          {!disabled && !expired && (
            <SubmitProofForm
              profileId={profileId}
              claim={claim}
              challengeText={issuedChallenge}
            />
          )}
        </div>
      )}

      {claim.status === "PROOF_SUBMITTED" && !disabled && (
        <div style={{ marginTop: "1rem" }}>
          <p className="note note-ok">
            <strong>Proof recorded.</strong> You can submit more evidence for this claim, or
            freeze the evidence set below and run the evaluation.
          </p>
          <SubmitProofForm
            profileId={profileId}
            claim={claim}
            challengeText={issuedChallenge}
          />
        </div>
      )}

      {claim.status === "FROZEN" && (
        <p className="note note-ok" style={{ marginTop: "1rem" }}>
          <strong>Evidence frozen.</strong> This claim's proofs are locked and ready for
          adjudication.
        </p>
      )}
    </section>
  );
}

// -- Submit proof ---------------------------------------------------------

function SubmitProofForm({
  profileId,
  claim,
  challengeText,
}: {
  profileId: string;
  claim: IdentityClaim;
  challengeText: string | null;
}) {
  const [proofId, setProofId] = useState("");
  const [sourceUrl, setSourceUrl] = useState(claim.claim_value);
  const [proofType, setProofType] = useState<ProofType>("PAGE_TEXT");
  const [contentHash, setContentHash] = useState("");
  const [touched, setTouched] = useState(false);
  const write = useProofMeshWrite();

  const trimmedProofId = proofId.trim();
  const trimmedHash = contentHash.trim().toLowerCase();

  const error = !trimmedProofId
    ? "Give this proof a short identifier."
    : !/^[A-Za-z0-9._-]+$/.test(trimmedProofId)
      ? "Use letters, numbers, dots, dashes, or underscores only."
      : !/^https?:\/\/.+\..+/.test(sourceUrl.trim())
        ? "Enter a full source URL starting with https://"
        : !/^[0-9a-f]{64}$/.test(trimmedHash)
          ? "Content hash must be a 64-character lowercase hex SHA-256 digest."
          : null;

  /** Hashes the exact issued wallet challenge required by the contract. */
  async function hashChallenge() {
    if (!challengeText) return;
    const bytes = new TextEncoder().encode(challengeText);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setContentHash(hex);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (error) return;
    const observedAt = new Date().toISOString().replace("Z", "");
    const result = await write.execute((account) =>
      writes.submitIdentityProof(
        account,
        profileId,
        claim.claim_id,
        trimmedProofId,
        sourceUrl.trim(),
        proofType,
        trimmedHash,
        observedAt,
      ),
    );
    if (result.state === "finalized_success") {
      setProofId("");
      setContentHash("");
      setTouched(false);
    }
  }

  return (
    <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--hairline)", paddingTop: "1rem" }}>
      <h3>Submit your proof</h3>
      <p className="dim small">
        Once the challenge is live at your submitted proof URL, record it on-chain. The
        digest must commit to the exact issued challenge; validators fetch that URL and
        require the same challenge in the retrieved content.
      </p>

      <WalletGate>
        <form onSubmit={handleSubmit} noValidate style={{ maxWidth: "36rem" }}>
          <div className="field">
            <label htmlFor="proofId">Proof identifier</label>
            <input
              id="proofId"
              type="text"
              value={proofId}
              onChange={(e) => setProofId(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="proof-1"
              disabled={write.isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="sourceUrl">Source URL</label>
            <input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              onBlur={() => setTouched(true)}
              disabled={write.isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="proofType">Proof type</label>
            <select
              id="proofType"
              value={proofType}
              onChange={(e) => setProofType(e.target.value as ProofType)}
              disabled={write.isPending}
            >
              {PROOF_TYPES.map((type) => (
                <option key={type} value={type}>
                  {PROOF_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <fieldset>
            <legend>Content hash</legend>
            <div className="field">
              <label>Issued challenge</label>
              <code className="challenge-text">
                {challengeText ?? "Issue a challenge before computing its digest."}
              </code>
              <p className="field-hint" id="pageText-hint">
                The exact challenge is hashed locally in your browser.
              </p>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => void hashChallenge()}
                disabled={!challengeText || write.isPending}
              >
                Compute challenge SHA-256
              </button>
            </div>

            <div className="field">
              <label htmlFor="contentHash">SHA-256 digest</label>
              <input
                id="contentHash"
                type="text"
                value={contentHash}
                onChange={(e) => setContentHash(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="64 lowercase hex characters"
                className="mono"
                disabled={write.isPending}
              />
            </div>
          </fieldset>

          {touched && error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={write.isPending || Boolean(error)}
          >
            {write.isPending ? "Submitting proof…" : "Submit proof"}
          </button>
        </form>
        <TransactionStatus progress={write.progress} />
      </WalletGate>
    </div>
  );
}

// -- Freeze + evaluate ----------------------------------------------------

function FreezeAndEvaluatePanel({
  profileId,
  profileStatus,
  claims,
}: {
  profileId: string;
  profileStatus: string;
  claims: IdentityClaim[];
}) {
  const freezeWrite = useProofMeshWrite();
  const evaluateWrite = useProofMeshWrite();
  const [policyId, setPolicyId] = useState("default");
  const [verdict, setVerdict] = useState<string | null>(null);

  const readyToFreeze = claims.some((c) => c.status === "PROOF_SUBMITTED");
  const canEvaluate = profileStatus === "EVALUATION_FROZEN";

  async function handleFreeze() {
    await freezeWrite.execute((account) => writes.freezeIdentityEvaluation(account, profileId));
  }

  async function handleEvaluate() {
    setVerdict(null);
    const result = await evaluateWrite.execute((account) =>
      writes.evaluateIdentity(account, profileId, policyId.trim() || "default"),
    );
    if (result.state === "finalized_success" && typeof result.result === "string") {
      setVerdict(result.result);
    }
  }

  return (
    <section className="card" aria-labelledby="freeze-h">
      <h2 id="freeze-h">Freeze evidence and evaluate</h2>
      <p className="dim small">
        Freezing locks your claims and proofs into an immutable evidence set. GenLayer validators
        then retrieve each claimed source live and adjudicate whether you credibly control the
        identity set.
      </p>

      <WalletGate>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="btn"
            onClick={() => void handleFreeze()}
            disabled={freezeWrite.isPending || !readyToFreeze || profileStatus !== "ACTIVE"}
          >
            {freezeWrite.isPending ? "Freezing…" : "Freeze evidence"}
          </button>
          {!readyToFreeze && profileStatus === "ACTIVE" && (
            <span className="small faint">Submit at least one proof first.</span>
          )}
          {profileStatus !== "ACTIVE" && (
            <span className="small faint">
              Profile is <StatusBadge status={profileStatus} />
            </span>
          )}
        </div>
        <TransactionStatus progress={freezeWrite.progress} />

        {canEvaluate && (
          <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--hairline)", paddingTop: "1rem" }}>
            <h3>Run identity evaluation</h3>
            <p className="dim small">
              This is the nondeterministic step: validators fetch your claimed sources, compare
              them against the frozen evidence, and reach consensus on a verdict. It can take
              longer than a normal transaction.
            </p>
            <div className="field" style={{ maxWidth: "22rem" }}>
              <label htmlFor="policyId">Policy label</label>
              <input
                id="policyId"
                type="text"
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                aria-describedby="policyId-hint"
                disabled={evaluateWrite.isPending}
              />
              <p className="field-hint" id="policyId-hint">
                Recorded on the credential for reference.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleEvaluate()}
              disabled={evaluateWrite.isPending}
            >
              {evaluateWrite.isPending ? "Evaluating…" : "Trigger identity evaluation"}
            </button>
            <TransactionStatus progress={evaluateWrite.progress} />

            {verdict && <VerdictCard raw={verdict} profileId={profileId} />}
          </div>
        )}
      </WalletGate>
    </section>
  );
}

function VerdictCard({ raw, profileId }: { raw: string; profileId: string }) {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return (
      <p className="note" style={{ marginTop: "1rem" }}>
        Evaluation returned: <code>{raw}</code>
      </p>
    );
  }

  const eligible = parsed.eligible === true;

  return (
    <div className={`note ${eligible ? "note-ok" : "note-warn"}`} style={{ marginTop: "1rem" }}>
      <strong>{eligible ? "Credential issued" : "Not eligible for a credential"}</strong>
      <dl className="kv small" style={{ marginTop: "0.5rem" }}>
        <div>
          <dt>Credential</dt>
          <dd>{String(parsed.credential_type ?? "—")}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Number(parsed.confidence_bps ?? 0) / 100}%</dd>
        </div>
        <div>
          <dt>Signals</dt>
          <dd>{String(parsed.independent_signal_count ?? 0)}</dd>
        </div>
        <div>
          <dt>Reasons</dt>
          <dd>{Array.isArray(parsed.reason_codes) ? parsed.reason_codes.join(", ") : "—"}</dd>
        </div>
      </dl>
      {typeof parsed.summary === "string" && <p>{parsed.summary}</p>}
      <Link className="btn btn-sm" to={`/identity/${encodeURIComponent(profileId)}/credentials`}>
        View credentials
      </Link>
    </div>
  );
}
