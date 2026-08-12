import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletPanel } from "./components/WalletPanel";
import { ContractPanel } from "./components/ContractPanel";
import { TransactionStatus } from "./components/TransactionStatus";
import { useProofMeshWrite } from "./features/contract/useProofMeshWrite";
import "./App.css";

const queryClient = new QueryClient();

/**
 * Stage 9 verification surface only. The real product UI (Identity Mesh,
 * Claim Wizard, Conflict Court, Trust Policy Explorer, Integration Hub)
 * is Stage 10+.
 */
function IntegrationCheck() {
  const write = useProofMeshWrite();

  return (
    <main className="stage9">
      <header>
        <h1>ProofMesh</h1>
        <p>Prove control. Preserve continuity. Resolve conflicts.</p>
        <p className="stage-note">
          Stage 9 — GenLayer integration foundation. Verification surface only.
        </p>
      </header>

      <WalletPanel />
      <ContractPanel />

      <section className="panel">
        <h2>Transaction lifecycle</h2>
        <p>
          No write is triggered automatically. This panel renders the shared
          transaction state machine used by every ProofMesh write.
        </p>
        <p>
          Current state: <code>{write.progress.state}</code>
        </p>
        <TransactionStatus progress={write.progress} />
      </section>
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <IntegrationCheck />
    </QueryClientProvider>
  );
}
