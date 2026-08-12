/**
 * Shared types for the GenLayer adapter layer. No raw genlayer-js imports
 * here beyond type-only re-exports -- this file is safe to import from
 * anywhere (pages, components, hooks) without pulling in SDK internals.
 */

/**
 * Transaction lifecycle state machine (build brief section 22).
 * A transaction hash is never treated as success -- `finalized_success`
 * is only reached after a finalized receipt confirms successful execution.
 */
export type TxState =
  | "idle"
  | "wallet_required"
  | "wrong_network"
  | "awaiting_signature"
  | "submitted"
  | "pending"
  | "accepted"
  | "awaiting_finality"
  | "finalized_success"
  | "finalized_execution_failed"
  | "rejected"
  | "timeout";

export interface TxProgress {
  state: TxState;
  hash?: `0x${string}`;
  /** Raw GenVM transaction status name, when known (e.g. "ACCEPTED", "FINALIZED"). */
  statusName?: string;
  /** Decoded contract return value, once finalized successfully. */
  result?: unknown;
  error?: NormalizedError;
}

/** Normalized error shape -- every thrown error from the adapter layer is
 * funneled through lib/genlayer/errors.ts into this shape before reaching
 * UI code. */
export interface NormalizedError {
  category:
    | "wallet_not_found"
    | "wallet_rejected"
    | "wrong_network"
    | "network_error"
    | "contract_revert"
    | "timeout"
    | "unknown";
  message: string;
  cause?: unknown;
}

export type WalletConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "wrong_network"
  | "unavailable";

export interface WalletState {
  connectionState: WalletConnectionState;
  address?: `0x${string}`;
  chainId?: number;
  error?: NormalizedError;
}
