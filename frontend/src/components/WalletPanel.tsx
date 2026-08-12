import { studioNetChain } from "../lib/genlayer";
import { useWallet } from "../features/wallet/useWallet";

export function WalletPanel() {
  const wallet = useWallet();

  return (
    <section className="panel">
      <h2>Wallet</h2>

      {wallet.connectionState === "unavailable" && (
        <p className="warn">
          No injected wallet detected in this browser. Install a GenLayer-compatible
          wallet to send transactions. Reads below still work without one.
        </p>
      )}

      {wallet.connectionState === "disconnected" && (
        <button type="button" onClick={() => void wallet.connect()}>
          Connect wallet
        </button>
      )}

      {wallet.connectionState === "connecting" && <p>Connecting…</p>}

      {wallet.address && (
        <dl className="kv">
          <dt>Account</dt>
          <dd>
            <code>{wallet.address}</code>
          </dd>
          <dt>Chain ID</dt>
          <dd>
            <code>{wallet.chainId ?? "unknown"}</code>
          </dd>
          <dt>Status</dt>
          <dd>{wallet.isConnected ? "Connected to StudioNet" : "Wrong network"}</dd>
        </dl>
      )}

      {wallet.isWrongNetwork && (
        <div className="warn">
          <p>
            Wallet is on chain {wallet.chainId}. ProofMesh requires{" "}
            {studioNetChain.name} (chain {studioNetChain.id}).
          </p>
          <button type="button" onClick={() => void wallet.switchNetwork()}>
            Switch to StudioNet
          </button>
        </div>
      )}

      {wallet.error && <p className="bad">{wallet.error.message}</p>}
    </section>
  );
}
