import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useCredentials,
  usePolicyEvaluation,
  useTrustPolicy,
  useTrustPolicyVersions,
} from "../features/contract/useProofMeshRead";
import {
  Breadcrumb,
  ChipList,
  ErrorNote,
  Loading,
  PageHead,
  RecordNotFound,
  StatusBadge,
} from "../components/ui";
import { PROOFMESH_CONTRACT_ADDRESS } from "../lib/genlayer";
import { CLAIM_TYPE_LABELS, bpsToPercent, formatTimestamp } from "../types/proofmesh";

const FAILURE_EXPLANATIONS: Record<string, string> = {
  POLICY_INACTIVE: "This policy version has been superseded by a newer one.",
  CREDENTIAL_PROFILE_MISMATCH: "The credential does not belong to the supplied profile.",
  CONTINUITY_NOT_CURRENT: "The policy requires a current continuity state.",
  ACTIVE_CHALLENGE_PRESENT: "The credential has an unresolved dispute.",
  CREDENTIAL_TYPE_MISMATCH: "The credential is not the type this policy requires.",
  CONFIDENCE_BELOW_MINIMUM: "Confidence is below the policy's minimum.",
  INSUFFICIENT_INDEPENDENT_SIGNALS: "Fewer independent signals than the policy requires.",
  CLAIM_TYPE_NOT_ALLOWED: "Evidence comes from a claim type this policy doesn't allow.",
};

function explainFailure(reason: string): string {
  if (reason.startsWith("CREDENTIAL_STATUS_NOT_ELIGIBLE")) {
    const status = reason.split(":")[1] ?? "";
    return `Credential status ${status} is not eligible — only ACTIVE and RECHECK_DUE pass.`;
  }
  return FAILURE_EXPLANATIONS[reason] ?? reason;
}

export default function PolicyDetailPage() {
  const { policyId } = useParams<{ policyId: string }>();
  const policy = useTrustPolicy(policyId);
  const versions = useTrustPolicyVersions(policy.data?.name);

  if (policy.isLoading) return <Loading label="Loading policy…" />;
  if (policy.error || !policy.data) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Trust Policies", to: "/policies" }, { label: "Not found" }]} />
        <RecordNotFound
          kind="Policy"
          id={policyId}
          error={policy.error}
          backTo="/policies"
          backLabel="Back to policies"
        />
      </div>
    );
  }

  const p = policy.data;

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <Breadcrumb items={[{ label: "Trust Policies", to: "/policies" }, { label: p.name }]} />

      <PageHead eyebrow="Trust policy" title={p.name}>
        <p className="row" style={{ gap: "0.5rem" }}>
          <StatusBadge status={p.status} />
          <span className="badge badge-plain st-CREDENTIALED">version {p.version}</span>
        </p>
      </PageHead>

      {p.status !== "ACTIVE" && (
        <p className="note note-warn">
          <strong>This version has been superseded.</strong> It is preserved and still queryable
          — evaluations against it report <code>POLICY_INACTIVE</code> rather than silently
          redirecting to a newer version.
        </p>
      )}

      <section className="card" aria-labelledby="req-h">
        <h2 id="req-h">Requirements</h2>
        <dl className="kv">
          <div>
            <dt>Policy ID</dt>
            <dd>
              <code>{p.id}</code>
            </dd>
          </div>
          <div>
            <dt>Credential type</dt>
            <dd>{p.credential_type.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt>Minimum confidence</dt>
            <dd>
              {bpsToPercent(p.minimum_confidence_bps)}{" "}
              <span className="faint mono small">({p.minimum_confidence_bps} BPS)</span>
            </dd>
          </div>
          <div>
            <dt>Minimum signals</dt>
            <dd>{p.minimum_independent_signals} independent</dd>
          </div>
          <div>
            <dt>Continuity</dt>
            <dd>
              {p.require_current_continuity
                ? "Must be current (ACTIVE only)"
                : "Not required"}
            </dd>
          </div>
          <div>
            <dt>Active disputes</dt>
            <dd>{p.require_no_active_challenge ? "None permitted" : "Permitted"}</dd>
          </div>
          <div>
            <dt>Allowed sources</dt>
            <dd>
              <ChipList items={p.allowed_claim_types.map((t) => CLAIM_TYPE_LABELS[t] ?? t)} />
            </dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatTimestamp(p.created_at)}</dd>
          </div>
        </dl>
      </section>

      {versions.data && versions.data.length > 1 && (
        <section className="card" aria-labelledby="versions-h">
          <h2 id="versions-h">Version history</h2>
          <p className="dim small">
            All {versions.data.length} versions of <code>{p.name}</code> remain queryable.
          </p>
          <ul className="chips">
            {versions.data.map((id, i) => (
              <li key={id}>
                <Link
                  className={`chip ${id === p.id ? "st-CREDENTIALED" : ""}`}
                  to={`/policies/${encodeURIComponent(id)}`}
                  style={id === p.id ? { borderColor: "var(--synapse-lime)" } : undefined}
                >
                  v{i + 1}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PolicyEvaluator policyId={p.id} />

      <section className="card" aria-labelledby="integrate-h">
        <h2 id="integrate-h">Integrate this policy</h2>
        <p className="dim small">
          Any GenLayer application can call this read-only view against the ProofMesh contract.
          It is fully deterministic — no LLM runs at query time.
        </p>
        <code className="challenge-text" style={{ color: "var(--mesh-lilac)", borderColor: "var(--hairline-strong)" }}>
          contract: {PROOFMESH_CONTRACT_ADDRESS}
          {"\n"}method:   evaluate_policy_view
          {"\n"}args:     [profile_id, "{p.id}", credential_id]
        </code>
      </section>
    </div>
  );
}

/** Live deterministic policy evaluation against a chosen credential. */
function PolicyEvaluator({ policyId }: { policyId: string }) {
  const credentials = useCredentials();
  const [selected, setSelected] = useState("");

  const credential = (credentials.data ?? []).find((c) => c.id === selected);
  const evaluation = usePolicyEvaluation(credential?.profile_id, policyId, credential?.id);

  return (
    <section className="card card-lift" aria-labelledby="eval-h">
      <h2 id="eval-h">Evaluate a credential</h2>
      <p className="dim small">
        Pick any credential on this deployment and check it against this policy — exactly the
        call an integrating application would make.
      </p>

      {credentials.isLoading && <Loading label="Loading credentials…" />}
      {(credentials.data?.length ?? 0) === 0 && !credentials.isLoading && (
        <p className="note">
          No credentials exist on this deployment yet, so there's nothing to evaluate.{" "}
          <Link to="/identity/new">Create an identity profile</Link> to issue the first one.
        </p>
      )}

      {(credentials.data?.length ?? 0) > 0 && (
        <div className="field" style={{ maxWidth: "32rem" }}>
          <label htmlFor="credSelect">Credential</label>
          <select
            id="credSelect"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Select a credential…</option>
            {credentials.data!.map((c) => (
              <option key={c.id} value={c.id}>
                {c.profile_id} — {c.credential_type.replace(/_/g, " ")} ({c.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {evaluation.isLoading && selected && <Loading label="Evaluating…" />}
      {evaluation.error && <ErrorNote error={evaluation.error} context="Evaluation failed" />}

      {evaluation.data && (
        <div
          className={`note ${evaluation.data.satisfied ? "note-ok" : "note-bad"}`}
          role="status"
        >
          <strong>
            {evaluation.data.satisfied
              ? "Satisfied — this credential meets the policy"
              : "Not satisfied"}
          </strong>
          <dl className="kv small" style={{ marginTop: "0.6rem" }}>
            <div>
              <dt>Credential type</dt>
              <dd>{evaluation.data.credential_type.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{bpsToPercent(evaluation.data.confidence_bps)}</dd>
            </div>
            <div>
              <dt>Independent signals</dt>
              <dd>{evaluation.data.independent_signal_count}</dd>
            </div>
            <div>
              <dt>Continuity current</dt>
              <dd>{evaluation.data.continuity_current ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Active dispute</dt>
              <dd>{evaluation.data.active_challenge ? "Yes" : "No"}</dd>
            </div>
          </dl>

          {evaluation.data.failure_reasons.length > 0 && (
            <>
              <p className="section-label" style={{ marginTop: "0.75rem" }}>
                Why it failed
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                {evaluation.data.failure_reasons.map((reason) => (
                  <li key={reason} className="small">
                    <code>{reason}</code> — {explainFailure(reason)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
