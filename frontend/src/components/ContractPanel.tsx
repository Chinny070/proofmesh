import { PROOFMESH_CONTRACT_ADDRESS, studioNetChain } from "../lib/genlayer";
import {
  useCredentials,
  useProfiles,
  useProtocolStatus,
  useTrustPolicies,
} from "../features/contract/useProofMeshRead";

function ReadResult({
  label,
  query,
}: {
  label: string;
  query: { isLoading: boolean; error: unknown; data: unknown[] | undefined };
}) {
  return (
    <div className="read-row">
      <span className="read-label">{label}</span>
      {query.isLoading && <span>loading…</span>}
      {!!query.error && <span className="bad">{String(query.error)}</span>}
      {query.data && (
        <span>
          {query.data.length === 0 ? (
            <em>empty (fresh deployment)</em>
          ) : (
            `${query.data.length} record(s)`
          )}
        </span>
      )}
    </div>
  );
}

export function ContractPanel() {
  const status = useProtocolStatus();
  const profiles = useProfiles();
  const credentials = useCredentials();
  const policies = useTrustPolicies();

  return (
    <section className="panel">
      <h2>Deployed contract</h2>
      <dl className="kv">
        <dt>Address</dt>
        <dd>
          <code>{PROOFMESH_CONTRACT_ADDRESS || "(not configured)"}</code>
        </dd>
        <dt>Network</dt>
        <dd>
          {studioNetChain.name} (chain {studioNetChain.id})
        </dd>
        <dt>RPC</dt>
        <dd>
          <code>{studioNetChain.rpcUrls.default.http[0]}</code>
        </dd>
      </dl>

      <h3>Protocol status</h3>
      {status.isLoading && <p>loading…</p>}
      {!!status.error && <p className="bad">{String(status.error)}</p>}
      {status.data && (
        <dl className="kv">
          {Object.entries(status.data).map(([key, value]) => (
            <div key={key} className="kv-pair">
              <dt>{key.replace(/_/g, " ")}</dt>
              <dd>
                <code>{value}</code>
              </dd>
            </div>
          ))}
        </dl>
      )}

      <h3>Live reads</h3>
      <ReadResult label="list_profiles()" query={profiles} />
      <ReadResult label="list_credentials()" query={credentials} />
      <ReadResult label="list_trust_policies()" query={policies} />
    </section>
  );
}
