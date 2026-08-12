import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPermittedAccounts,
  getWalletChainId,
  hasInjectedProvider,
  getInjectedProvider,
  isCorrectChain,
  normalizeError,
  requestAccounts,
  subscribeToProviderEvents,
  switchToStudioNet,
} from "../../lib/genlayer";
import type { WalletState } from "../../lib/genlayer";

/**
 * Injected-wallet connection state. Uses only the standard EIP-1193
 * surface exposed through lib/genlayer/chain.ts -- this hook never
 * touches `window.ethereum` or genlayer-js directly.
 *
 * There is no mock/fake wallet path here: if no injected provider is
 * present, the state is `unavailable` and connect() is a no-op.
 */
export function useWallet() {
  const [state, setState] = useState<WalletState>(() => ({
    connectionState: hasInjectedProvider() ? "disconnected" : "unavailable",
  }));

  const applyAccountAndChain = useCallback(
    (accounts: `0x${string}`[], chainId: number) => {
      if (accounts.length === 0) {
        setState({ connectionState: "disconnected", chainId });
        return;
      }
      setState({
        connectionState: isCorrectChain(chainId) ? "connected" : "wrong_network",
        address: accounts[0],
        chainId,
      });
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!hasInjectedProvider()) {
      setState({ connectionState: "unavailable" });
      return;
    }
    try {
      const provider = getInjectedProvider();
      const [accounts, chainId] = await Promise.all([
        getPermittedAccounts(provider),
        getWalletChainId(provider),
      ]);
      applyAccountAndChain(accounts, chainId);
    } catch (err) {
      setState({ connectionState: "disconnected", error: normalizeError(err) });
    }
  }, [applyAccountAndChain]);

  /** Silent reconnect on mount: reads already-permitted accounts, never prompts. */
  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Standard EIP-1193 provider events. */
  useEffect(() => {
    if (!hasInjectedProvider()) return;
    const provider = getInjectedProvider();
    return subscribeToProviderEvents(provider, {
      accountsChanged: () => void refresh(),
      chainChanged: () => void refresh(),
      disconnect: () => setState({ connectionState: "disconnected" }),
    });
  }, [refresh]);

  const connect = useCallback(async () => {
    if (!hasInjectedProvider()) {
      setState({ connectionState: "unavailable" });
      return;
    }
    setState((prev) => ({ ...prev, connectionState: "connecting", error: undefined }));
    try {
      const provider = getInjectedProvider();
      const accounts = await requestAccounts(provider);
      const chainId = await getWalletChainId(provider);
      applyAccountAndChain(accounts, chainId);
    } catch (err) {
      setState({ connectionState: "disconnected", error: normalizeError(err) });
    }
  }, [applyAccountAndChain]);

  const switchNetwork = useCallback(async () => {
    if (!hasInjectedProvider()) return;
    try {
      const provider = getInjectedProvider();
      await switchToStudioNet(provider);
      await refresh();
    } catch (err) {
      setState((prev) => ({ ...prev, error: normalizeError(err) }));
    }
  }, [refresh]);

  return useMemo(
    () => ({
      ...state,
      isConnected: state.connectionState === "connected",
      isWrongNetwork: state.connectionState === "wrong_network",
      connect,
      switchNetwork,
      refresh,
    }),
    [state, connect, switchNetwork, refresh],
  );
}
