import { useState } from "react";
import { Link } from "react-router-dom";
import { writes } from "../lib/genlayer";
import { useTrustPolicies } from "../features/contract/useProofMeshRead";
import { useProofMeshWrite } from "../features/contract/useProofMeshWrite";
import { WalletGate } from "../components/WalletPanel";
import { TransactionStatus } from "../components/TransactionStatus";
import {
  ChipList,
  EmptyState,
  ErrorNote,
  PageHead,
  SkeletonRows,
  StatusBadge,
} from "../components/ui";
import {
  CLAIM_TYPES,
  CLAIM_TYPE_LABELS,
  CREDENTIAL_TYPES,
  bpsToPercent,
} from "../types/proofmesh";
import type { ClaimType, CredentialType } from "../types/proofmesh";

export default function PoliciesPage() {
  const policies = useTrustPolicies();
  const [showForm, setShowForm] = useState(false);

  const active = (policies.data ?? []).filter((p) => p.status === "ACTIVE");
  const superseded = (policies.data ?? []).filter((p) => p.status !== "ACTIVE");

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <PageHead
        eyebrow="Trust Policy Explorer"
        title="Reusable trust policies"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowForm((v) => !v)}
            aria-expanded={showForm}
          >
            {showForm ? "Cancel" : "Create policy"}
          </button>
        }
      >
        <p>
          A trust policy is a versioned bundle of requirements any GenLayer application can
          evaluate a ProofMesh credential against — deterministically, with no LLM call at query
          time.
        </p>
      </PageHead>

      <section className="card note-info" style={{ borderLeft: "3px solid var(--finality-blue)" }}>
        <h2 style={{ marginTop: 0 }}>How another application uses this</h2>
        <p className="dim">
          An integrating app doesn't deploy anything or learn ProofMesh's internals. It calls one
          view on this contract and gates access on the structured result:
        </p>
        <code className="challenge-text" style={{ color: "var(--mesh-lilac)", borderColor: "var(--hairline-strong)" }}>
          evaluate_policy_view(profile_id, policy_id, credential_id)
          {"\n"}→ {"{"} satisfied, credential_type, confidence_bps, independent_signal_count,
          {"\n"}   continuity_current, active_challenge, failure_reasons[] {"}"}
        </code>
        <p className="small faint">
          Every check runs — <code>failure_reasons</code> is never short-circuited, so a caller
          gets the complete picture in one call rather than just a boolean.
        </p>
      </section>

      {showForm && <CreatePolicyForm onDone={() => setShowForm(false)} />}

      {policies.isLoading && <SkeletonRows rows={2} />}
      {policies.error && <ErrorNote error={policies.error} />}

      {!policies.isLoading && (policies.data?.length ?? 0) === 0 && (
        <EmptyState
          title="No trust policies yet"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
              Create the first policy
            </button>
          }
        >
          <p>
            Define reusable credential requirements — minimum confidence, independent signals,
            continuity, and which identity sources count.
          </p>
        </EmptyState>
      )}

      {active.length > 0 && (
        <section aria-labelledby="active-h">
          <h2 id="active-h">Active policies</h2>
          <div className="grid grid-2">
            {active.map((policy) => (
              <Link
                key={policy.id}
                to={`/policies/${encodeURIComponent(policy.id)}`}
                className="card card-link"
              >
                <div className="row row-between">
                  <h3 style={{ margin: 0 }}>{policy.name}</h3>
                  <span className="badge badge-plain st-CREDENTIALED">v{policy.version}</span>
                </div>
                <p className="small dim" style={{ marginTop: "0.4rem" }}>
                  Requires {policy.credential_type.replace(/_/g, " ")}
                </p>
                <dl className="kv small">
                  <div>
                    <dt>Min confidence</dt>
                    <dd>{bpsToPercent(policy.minimum_confidence_bps)}</dd>
                  </div>
                  <div>
                    <dt>Min signals</dt>
                    <dd>{policy.minimum_independent_signals}</dd>
                  </div>
                  <div>
                    <dt>Continuity</dt>
                    <dd>{policy.require_current_continuity ? "Must be current" : "Not required"}</dd>
                  </div>
                  <div>
                    <dt>Disputes</dt>
                    <dd>
                      {policy.require_no_active_challenge ? "None allowed" : "Permitted"}
                    </dd>
                  </div>
                </dl>
                <div style={{ marginTop: "0.6rem" }}>
                  <ChipList items={policy.allowed_claim_types} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {superseded.length > 0 && (
        <section aria-labelledby="superseded-h">
          <h2 id="superseded-h">Superseded versions</h2>
          <p className="dim small">
            Older versions are never deleted. An application pinned to a specific policy ID keeps
            working — evaluation simply reports <code>POLICY_INACTIVE</code>.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Policy</th>
                  <th scope="col">Version</th>
                  <th scope="col">Status</th>
                  <th scope="col">Min confidence</th>
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {superseded.map((policy) => (
                  <tr key={policy.id}>
                    <td>{policy.name}</td>
                    <td>v{policy.version}</td>
                    <td>
                      <StatusBadge status={policy.status} />
                    </td>
                    <td>{bpsToPercent(policy.minimum_confidence_bps)}</td>
                    <td>
                      <Link
                        className="btn btn-sm"
                        to={`/policies/${encodeURIComponent(policy.id)}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function CreatePolicyForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [credentialType, setCredentialType] = useState<CredentialType>("VERIFIED_DEVELOPER");
  const [minConfidence, setMinConfidence] = useState(8000);
  const [minSignals, setMinSignals] = useState(2);
  const [requireNoChallenge, setRequireNoChallenge] = useState(true);
  const [requireContinuity, setRequireContinuity] = useState(true);
  const [allowedTypes, setAllowedTypes] = useState<ClaimType[]>([
    "GITHUB_PROFILE",
    "PERSONAL_WEBSITE",
    "X_PROFILE",
  ]);
  const [touched, setTouched] = useState(false);
  const write = useProofMeshWrite();

  const trimmedName = name.trim();
  const error = !trimmedName
    ? "Give the policy a name."
    : trimmedName.length > 100
      ? "Name must be 100 characters or fewer."
      : minConfidence < 0 || minConfidence > 10000
        ? "Minimum confidence must be between 0 and 10000 BPS."
        : minSignals < 0 || minSignals > 20
          ? "Minimum signals must be between 0 and 20."
          : allowedTypes.length === 0
            ? "Select at least one allowed claim type."
            : null;

  function toggleType(type: ClaimType) {
    setAllowedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (error) return;
    const result = await write.execute((account) =>
      writes.createTrustPolicy(
        account,
        trimmedName,
        credentialType,
        minConfidence,
        minSignals,
        requireNoChallenge,
        requireContinuity,
        allowedTypes,
      ),
    );
    if (result.state === "finalized_success") onDone();
  }

  return (
    <section className="card card-lift" aria-labelledby="create-policy-h">
      <h2 id="create-policy-h">Create a trust policy</h2>
      <p className="dim small">
        Creating a policy with an existing name produces a new version and marks the previous one
        inactive.
      </p>
      <WalletGate>
        <form onSubmit={handleSubmit} noValidate style={{ maxWidth: "40rem" }}>
          <div className="field">
            <label htmlFor="policyName">Policy name</label>
            <input
              id="policyName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="VERIFIED_DEVELOPER_V2"
              disabled={write.isPending}
            />
          </div>

          <div className="field">
            <label htmlFor="credType">Required credential type</label>
            <select
              id="credType"
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value as CredentialType)}
              disabled={write.isPending}
            >
              {CREDENTIAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="minConf">Minimum confidence (BPS)</label>
              <input
                id="minConf"
                type="number"
                min={0}
                max={10000}
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                aria-describedby="minConf-hint"
                disabled={write.isPending}
              />
              <p className="field-hint" id="minConf-hint">
                {bpsToPercent(minConfidence)} — 10000 BPS is 100%.
              </p>
            </div>

            <div className="field">
              <label htmlFor="minSig">Minimum independent signals</label>
              <input
                id="minSig"
                type="number"
                min={0}
                max={20}
                value={minSignals}
                onChange={(e) => setMinSignals(Number(e.target.value))}
                disabled={write.isPending}
              />
            </div>
          </div>

          <fieldset>
            <legend>Requirements</legend>
            <div className="checkbox-row">
              <input
                id="reqNoChallenge"
                type="checkbox"
                checked={requireNoChallenge}
                onChange={(e) => setRequireNoChallenge(e.target.checked)}
                disabled={write.isPending}
              />
              <label htmlFor="reqNoChallenge">
                No active dispute — credentials under challenge fail this policy
              </label>
            </div>
            <div className="checkbox-row">
              <input
                id="reqContinuity"
                type="checkbox"
                checked={requireContinuity}
                onChange={(e) => setRequireContinuity(e.target.checked)}
                disabled={write.isPending}
              />
              <label htmlFor="reqContinuity">
                Current continuity — only ACTIVE credentials pass, not RECHECK_DUE
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Allowed identity sources</legend>
            {CLAIM_TYPES.map((type) => (
              <div className="checkbox-row" key={type}>
                <input
                  id={`ct-${type}`}
                  type="checkbox"
                  checked={allowedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  disabled={write.isPending}
                />
                <label htmlFor={`ct-${type}`}>{CLAIM_TYPE_LABELS[type]}</label>
              </div>
            ))}
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
            {write.isPending ? "Creating policy…" : "Create policy"}
          </button>
        </form>
        <TransactionStatus progress={write.progress} />
      </WalletGate>
    </section>
  );
}
