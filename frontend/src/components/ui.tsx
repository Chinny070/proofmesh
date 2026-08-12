import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { bpsToPercent } from "../types/proofmesh";

/** Status pill. `status` drives the colour via the `.st-*` classes. */
export function StatusBadge({ status, title }: { status: string; title?: string }) {
  return (
    <span className={`badge st-${status}`} title={title ?? status}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p className="row dim" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
    </p>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: "3rem" }} />
      ))}
    </div>
  );
}

/** Renders a normalized contract/network error readably. */
export function ErrorNote({ error, context }: { error: unknown; context?: string }) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error);
  return (
    <p className="note note-bad" role="alert">
      <strong>{context ?? "Could not read from the contract"}</strong>
      <br />
      {message}
    </p>
  );
}

/**
 * Shown when a record ID in the URL doesn't resolve on-chain. Renders the
 * underlying contract message in a details disclosure rather than dumping
 * it as the headline.
 */
export function RecordNotFound({
  kind,
  id,
  error,
  backTo,
  backLabel,
}: {
  kind: string;
  id?: string;
  error?: unknown;
  backTo: string;
  backLabel: string;
}) {
  const detail =
    error instanceof Error ? error.message : error ? String(error) : null;
  return (
    <div className="empty-state">
      <h3>{kind} not found</h3>
      <p>
        No {kind.toLowerCase()} with the ID {id ? <code>{id}</code> : "given"} exists on this
        ProofMesh deployment. It may have never been created, or the link may be wrong.
      </p>
      {detail && (
        <details style={{ maxWidth: "34rem", margin: "0 auto 1rem", textAlign: "left" }}>
          <summary className="small faint" style={{ cursor: "pointer" }}>
            Contract response
          </summary>
          <p className="small faint" style={{ marginTop: "0.5rem" }}>
            {detail}
          </p>
        </details>
      )}
      <Link className="btn btn-primary" to={backTo}>
        {backLabel}
      </Link>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children}
      {action}
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={item.label}>
          {i > 0 && " / "}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/** Confidence meter with an accessible text equivalent. */
export function ConfidenceMeter({ bps }: { bps: number }) {
  const pct = Math.max(0, Math.min(100, bps / 100));
  return (
    <div>
      <div className="row row-between small">
        <span className="faint">Confidence</span>
        <span className="mono">{bpsToPercent(bps)}</span>
      </div>
      <div
        className="meter"
        role="meter"
        aria-valuenow={bps}
        aria-valuemin={0}
        aria-valuemax={10000}
        aria-label={`Confidence ${bpsToPercent(bps)}`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ChipList({ items, empty = "None" }: { items: string[]; empty?: string }) {
  if (!items || items.length === 0) return <span className="faint small">{empty}</span>;
  return (
    <ul className="chips">
      {items.map((item) => (
        <li key={item} className="chip">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function KeyValue({ children }: { children: ReactNode }) {
  return <dl className="kv">{children}</dl>;
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
