/**
 * GenLayer network configuration and injected-wallet/network primitives.
 *
 * All chain-id/network-switching logic here uses the standard EIP-1193 /
 * EIP-3326 (`wallet_switchEthereumChain`) / EIP-3085
 * (`wallet_addEthereumChain`) wallet RPC methods -- the officially
 * supported wallet APIs for network switching, not a GenLayer-specific
 * mechanism. genlayer-js's own client transport (verified by reading
 * node_modules/genlayer-js/dist/index.js) treats `window.ethereum` as a
 * plain EIP-1193 provider and does NOT enforce a chain-id match for chains
 * flagged `isStudio: true` (StudioNet and localnet both are) -- so this
 * adapter performs its own wrong-network detection independently.
 */
import { studionet } from "genlayer-js/chains";
import type { GenLayerChain } from "genlayer-js/types";
import { WalletNotFoundError } from "./errors";

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const RPC_URL = import.meta.env.VITE_GENLAYER_RPC_URL ?? "https://studio.genlayer.com/api";
const CHAIN_ID = Number(import.meta.env.VITE_GENLAYER_CHAIN_ID ?? "61999");

/**
 * The GenLayer StudioNet chain descriptor, built from genlayer-js's own
 * `chains.studionet` (verified: id 61999, matching RPC URL) but with the
 * RPC URL overridden from the env var so a different RPC endpoint can be
 * configured without a code change.
 */
export const studioNetChain: GenLayerChain = {
  ...studionet,
  id: CHAIN_ID,
  rpcUrls: {
    ...studionet.rpcUrls,
    default: { http: [RPC_URL] },
  },
};

export const PROOFMESH_CONTRACT_ADDRESS = (import.meta.env.VITE_PROOFMESH_CONTRACT_ADDRESS ??
  "") as `0x${string}`;

export function getInjectedProvider(): Eip1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new WalletNotFoundError();
  }
  return window.ethereum;
}

export function hasInjectedProvider(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

/** Reads the wallet's current chain id without prompting anything. */
export async function getWalletChainId(provider: Eip1193Provider): Promise<number> {
  const hex = (await provider.request({ method: "eth_chainId" })) as string;
  return Number.parseInt(hex, 16);
}

export function isCorrectChain(chainId: number): boolean {
  return chainId === studioNetChain.id;
}

/**
 * Requests account access (prompts the wallet if not already permitted).
 * Standard EIP-1193 `eth_requestAccounts`.
 */
export async function requestAccounts(provider: Eip1193Provider): Promise<`0x${string}`[]> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  return accounts as `0x${string}`[];
}

/**
 * Reads already-permitted accounts without prompting the wallet --
 * used for silent reconnect on page load. Standard EIP-1193 `eth_accounts`.
 */
export async function getPermittedAccounts(provider: Eip1193Provider): Promise<`0x${string}`[]> {
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return accounts as `0x${string}`[];
}

const studioNetAddEthereumChainParams = {
  chainId: toHexChainId(CHAIN_ID),
  chainName: studioNetChain.name,
  nativeCurrency: studioNetChain.nativeCurrency,
  rpcUrls: [RPC_URL],
  blockExplorerUrls: studioNetChain.blockExplorers
    ? [studioNetChain.blockExplorers.default.url]
    : undefined,
};

/**
 * Switches the wallet to StudioNet using `wallet_switchEthereumChain`
 * (EIP-3326). If the wallet doesn't have the chain yet (error code 4902,
 * the standard EIP-3326 "unrecognized chain" code), falls back to
 * `wallet_addEthereumChain` (EIP-3085) and retries the switch.
 */
export async function switchToStudioNet(provider: Eip1193Provider): Promise<void> {
  const targetChainIdHex = toHexChainId(CHAIN_ID);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: targetChainIdHex }],
    });
  } catch (err) {
    const code = (err as { code?: number } | undefined)?.code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [studioNetAddEthereumChainParams],
      });
      // wallet_addEthereumChain switches to the chain on success per EIP-3085,
      // but some wallets require an explicit follow-up switch.
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainIdHex }],
      });
      return;
    }
    throw err;
  }
}

export type ProviderEventName = "accountsChanged" | "chainChanged" | "disconnect";

/**
 * Subscribes to the standard EIP-1193 provider events. Returns an
 * unsubscribe function. No-ops (returns a no-op unsubscribe) if the
 * provider doesn't support `on`/`removeListener`.
 */
export function subscribeToProviderEvents(
  provider: Eip1193Provider,
  handlers: Partial<Record<ProviderEventName, (...args: unknown[]) => void>>,
): () => void {
  if (!provider.on || !provider.removeListener) {
    return () => {};
  }
  const entries = Object.entries(handlers) as [
    ProviderEventName,
    (...args: unknown[]) => void,
  ][];
  for (const [event, handler] of entries) {
    provider.on(event, handler);
  }
  return () => {
    for (const [event, handler] of entries) {
      provider.removeListener?.(event, handler);
    }
  };
}
