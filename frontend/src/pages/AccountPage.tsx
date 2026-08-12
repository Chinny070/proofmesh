import { Link } from "react-router-dom";
import { WalletPanel } from "../components/WalletPanel";
import { useWallet } from "../features/wallet/useWallet";
import { useProfiles } from "../features/contract/useProofMeshRead";
import { EmptyState, ErrorNote, Loading, PageHead, StatusBadge } from "../components/ui";
import { PROOFMESH_CONTRACT_ADDRESS, studioNetChain } from "../lib/genlayer";

export default function AccountPage() {
  const wallet = useWallet();
  const profiles = useProfiles();

  const mine = wallet.address
    ? (profiles.data ?? []).filter(
        (p) => p.owner.toLowerCase() === wallet.address!.toLowerCase(),
      )
    : [];

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      <PageHead eyebrow="Account" title="Your wallet and profiles">
        <p>
          ProofMesh has no accounts of its own — your wallet is your identity. Everything below
          is read directly from chain state.
        </p>
      </PageHead>

      <WalletPanel />

      <section className="card" aria-labelledby="network-h">
        <h2 id="network-h">Network</h2>
        <dl className="kv">
          <div>
            <dt>Contract</dt>
            <dd>
              <code>{PROOFMESH_CONTRACT_ADDRESS}</code>
            </dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{studioNetChain.name}</dd>
          </div>
          <div>
            <dt>Chain ID</dt>
            <dd>
              <code>{studioNetChain.id}</code>
            </dd>
          </div>
          <div>
            <dt>RPC</dt>
            <dd>
              <code>{studioNetChain.rpcUrls.default.http[0]}</code>
            </dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-labelledby="mine-h">
        <h2 id="mine-h">Your identity profiles</h2>

        {!wallet.address && (
          <p className="dim">Connect a wallet to see profiles you own.</p>
        )}

        {wallet.address && profiles.isLoading && <Loading />}
        {profiles.error && <ErrorNote error={profiles.error} />}

        {wallet.address && !profiles.isLoading && mine.length === 0 && (
          <EmptyState
            title="You don't own any profiles yet"
            action={
              <Link className="btn btn-primary" to="/identity/new">
                Create your first profile
              </Link>
            }
          >
            <p>Create an identity profile to start claiming and proving your public identities.</p>
          </EmptyState>
        )}

        {mine.length > 0 && (
          <ul className="stack" style={{ listStyle: "none", padding: 0, gap: "0.6rem" }}>
            {mine.map((profile) => (
              <li key={profile.id} className="row row-between">
                <Link to={`/identity/${encodeURIComponent(profile.id)}`}>{profile.id}</Link>
                <span className="row" style={{ gap: "0.4rem" }}>
                  <span className="small faint">
                    {profile.claim_count} claims · {profile.credential_count} credentials
                  </span>
                  <StatusBadge status={profile.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
