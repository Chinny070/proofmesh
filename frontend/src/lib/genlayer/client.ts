/**
 * GenLayer client factories. This is the only file that calls
 * `createClient` from genlayer-js -- every other module in this app goes
 * through the typed wrappers in contract.ts / receipts.ts instead of
 * touching genlayer-js directly.
 */
import { createClient } from "genlayer-js";
import type { GenLayerClient } from "genlayer-js/types";
import { getInjectedProvider, studioNetChain } from "./chain";

let readClient: GenLayerClient<typeof studioNetChain> | undefined;

/**
 * A read-only client with no wallet account attached. Safe to call from
 * anywhere without prompting or requiring an injected wallet -- reads go
 * straight to the RPC endpoint (genlayer-js's `gen_call`), never through
 * `window.ethereum`.
 */
export function getReadClient(): GenLayerClient<typeof studioNetChain> {
  if (!readClient) {
    readClient = createClient({ chain: studioNetChain });
  }
  return readClient;
}

/**
 * A client bound to a connected wallet address, routing signing requests
 * (eth_sendTransaction, personal_sign, etc.) through the injected
 * provider. Constructed fresh per call so it always reflects the current
 * connected account -- the underlying provider connection is cheap
 * (genlayer-js just wraps `window.ethereum.request`).
 */
export function getWriteClient(account: `0x${string}`): GenLayerClient<typeof studioNetChain> {
  return createClient({
    chain: studioNetChain,
    account,
    provider: getInjectedProvider(),
  });
}
