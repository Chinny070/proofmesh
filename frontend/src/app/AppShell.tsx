import { NavLink, Link, Outlet } from "react-router-dom";
import { WalletButton } from "../components/WalletPanel";

const NAV = [
  { to: "/identity", label: "Identity" },
  { to: "/challenges", label: "Conflict Court" },
  { to: "/policies", label: "Trust Policies" },
  { to: "/integration", label: "Integrate" },
  { to: "/demo", label: "Demo" },
  { to: "/protocol", label: "Protocol" },
  { to: "/account", label: "Account" },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
              <circle cx="16" cy="16" r="6" fill="var(--synapse-lime)" />
              <circle cx="16" cy="16" r="11" fill="none" stroke="var(--mesh-lilac)" strokeWidth="1.5" opacity="0.6" />
              <circle cx="16" cy="4" r="2.6" fill="var(--trust-mint)" />
              <circle cx="27" cy="22" r="2.6" fill="var(--proof-amber)" />
              <circle cx="5" cy="22" r="2.6" fill="var(--finality-blue)" />
              <path d="M16 10V6M20.5 19l4.5 2M11.5 19L7 21" stroke="var(--mesh-lilac)" strokeWidth="1.3" />
            </svg>
            ProofMesh
          </Link>

          <nav className="nav" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <WalletButton />
        </div>
      </header>

      <main className="app-main" id="main">
        <Outlet />
      </main>
    </div>
  );
}
