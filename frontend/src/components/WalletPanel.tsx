import type { ReactNode } from "react";
import { studioNetChain } from "../lib/genlayer";
import { useWallet } from "../features/wallet/useWallet";
import { shortenAddress } from "../types/proofmesh";

/** Compact wallet control for the top bar. */
export function WalletButton() {
  const wallet = useWallet();

  if (wallet.connectionState === "unavailable") {
    return (
      <span className="badge st-warn" title="No injected wallet detected in this browser">
        No wallet
      </span>
    );
  }
  if (wallet.isWrongNetwork) {
    return (
      <button type="button" className="btn btn-sm btn-danger" onClick={() => void wallet.switchNetwork()}>
        Wrong network — switch
      </button>
    );
  }
  if (wallet.address) {
    return (
      <span className="badge st-ACTIVE" title={wallet.address}>
        {shortenAddress(wallet.address)}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-sm btn-primary"
      onClick={() => void wallet.connect()}
      disabled={wallet.connectionState === "connecting"}
    >
      {wallet.connectionState === "connecting" ? "Connecting…" : "Connect wallet"}
    </button>
  );
}

/** Full wallet status panel, used on the Account page. */
export function WalletPanel() {
  const wallet = useWallet();

  return (
    <section className="card" aria-labelledby="wallet-h">
      <h2 id="wallet-h">Wallet</h2>

      {wallet.connectionState === "unavailable" && (
        <p className="note note-warn">
          <strong>No injected wallet detected.</strong>
          <br />
          Install a GenLayer-compatible browser wallet to send transactions. All read-only
          views in ProofMesh work without one.
        </p>
      )}

      {wallet.connectionState === "disconnected" && (
        <>
          <p className="dim">Connect a wallet to create profiles, submit proofs, and adjudicate.</p>
          <button type="button" className="btn btn-primary" onClick={() => void wallet.connect()}>
            Connect wallet
          </button>
        </>
      )}

      {wallet.connectionState === "connecting" && <p className="dim">Connecting…</p>}

      {wallet.address && (
        <dl className="kv">
          <div>
            <dt>Account</dt>
            <dd>
              <code>{wallet.address}</code>
            </dd>
          </div>
          <div>
            <dt>Chain ID</dt>
            <dd>
              <code>{wallet.chainId ?? "unknown"}</code>
            </dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>
              {wallet.isConnected ? (
                <span className="badge st-ACTIVE">Connected to StudioNet</span>
              ) : (
                <span className="badge st-bad">Wrong network</span>
              )}
            </dd>
          </div>
        </dl>
      )}

      {wallet.isWrongNetwork && (
        <div className="note note-warn">
          <p>
            Your wallet is on chain {wallet.chainId}. ProofMesh runs on {studioNetChain.name}{" "}
            (chain {studioNetChain.id}).
          </p>
          <button type="button" className="btn" onClick={() => void wallet.switchNetwork()}>
            Switch to StudioNet
          </button>
        </div>
      )}

      {wallet.error && (
        <p className="note note-bad" role="alert">
          {wallet.error.message}
        </p>
      )}
    </section>
  );
}

/**
 * Wraps any write-capable UI. Renders an explanatory state instead of the
 * form when a wallet is missing or on the wrong network, so no page has to
 * re-implement those two cases.
 */
export function WalletGate({ children }: { children: ReactNode }) {
  const wallet = useWallet();

  if (wallet.connectionState === "unavailable") {
    return (
      <p className="note note-warn">
        <strong>A browser wallet is required for this action.</strong>
        <br />
        No injected wallet was detected. Install a GenLayer-compatible wallet, then reload.
      </p>
    );
  }

  if (!wallet.address) {
    return (
      <div className="note note-info">
        <p>Connect your wallet to continue.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void wallet.connect()}
          disabled={wallet.connectionState === "connecting"}
        >
          {wallet.connectionState === "connecting" ? "Connecting…" : "Connect wallet"}
        </button>
      </div>
    );
  }

  if (wallet.isWrongNetwork) {
    return (
      <div className="note note-warn">
        <p>
          Wrong network. Switch your wallet to {studioNetChain.name} (chain {studioNetChain.id})
          to continue.
        </p>
        <button type="button" className="btn" onClick={() => void wallet.switchNetwork()}>
          Switch to StudioNet
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
