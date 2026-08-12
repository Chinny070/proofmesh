import { useCallback, useState } from "react";
import {
  ContractCallError,
  getWriteClient,
  isCorrectChain,
  normalizeError,
  trackTransaction,
} from "../../lib/genlayer";
import type { TxProgress } from "../../lib/genlayer";
import { useWallet } from "../wallet/useWallet";

/**
 * Drives a single ProofMesh write through the full transaction lifecycle:
 *
 *   idle -> wallet_required | wrong_network
 *        -> awaiting_signature -> submitted -> pending -> accepted
 *        -> awaiting_finality -> finalized_success
 *                              | finalized_execution_failed
 *        -> rejected | timeout
 *
 * The returned hash alone is never treated as success -- `isSuccess` is
 * only true at `finalized_success`, after the finalized receipt confirms
 * successful contract execution.
 */
export function useProofMeshWrite() {
  const wallet = useWallet();
  const [progress, setProgress] = useState<TxProgress>({ state: "idle" });

  const reset = useCallback(() => setProgress({ state: "idle" }), []);

  const execute = useCallback(
    async (
      submit: (account: `0x${string}`) => Promise<`0x${string}`>,
    ): Promise<TxProgress> => {
      if (!wallet.address) {
        const next: TxProgress = { state: "wallet_required" };
        setProgress(next);
        return next;
      }
      if (wallet.chainId === undefined || !isCorrectChain(wallet.chainId)) {
        const next: TxProgress = { state: "wrong_network" };
        setProgress(next);
        return next;
      }

      setProgress({ state: "awaiting_signature" });

      let hash: `0x${string}`;
      try {
        hash = await submit(wallet.address);
      } catch (err) {
        const error =
          err instanceof ContractCallError ? err.normalized : normalizeError(err);
        const next: TxProgress = { state: "rejected", error };
        setProgress(next);
        return next;
      }

      const client = getWriteClient(wallet.address);
      return trackTransaction(client, hash, setProgress);
    },
    [wallet.address, wallet.chainId],
  );

  return {
    progress,
    execute,
    reset,
    isPending: [
      "awaiting_signature",
      "submitted",
      "pending",
      "accepted",
      "awaiting_finality",
    ].includes(progress.state),
    isSuccess: progress.state === "finalized_success",
    isError: [
      "finalized_execution_failed",
      "rejected",
      "timeout",
      "wallet_required",
      "wrong_network",
    ].includes(progress.state),
  };
}
