import type { NormalizedError } from "./types";

/**
 * EIP-1193 provider error codes (standard, not GenLayer-specific).
 * https://eips.ethereum.org/EIPS/eip-1193#provider-errors
 */
const USER_REJECTED_CODE = 4001;
const CHAIN_NOT_ADDED_CODE = 4902;

interface ProviderLikeError {
  code?: number;
  message?: string;
}

function isProviderLikeError(err: unknown): err is ProviderLikeError {
  return typeof err === "object" && err !== null && ("code" in err || "message" in err);
}

/**
 * Normalizes any error thrown by the wallet provider, genlayer-js, or
 * fetch/network layer into a single NormalizedError shape. This is the
 * only place error-message string-matching happens -- everywhere else in
 * the adapter layer just calls this function and re-throws/returns the
 * result.
 */
export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof Error && err.name === "WalletNotFoundError") {
    return { category: "wallet_not_found", message: err.message, cause: err };
  }

  if (isProviderLikeError(err)) {
    if (err.code === USER_REJECTED_CODE) {
      return {
        category: "wallet_rejected",
        message: "The wallet request was rejected.",
        cause: err,
      };
    }
    if (err.code === CHAIN_NOT_ADDED_CODE) {
      return {
        category: "wrong_network",
        message: "StudioNet is not added to the wallet yet.",
        cause: err,
      };
    }
  }

  const message = err instanceof Error ? err.message : String(err);

  if (/wrong chain|configured for chain|switch your wallet/i.test(message)) {
    return { category: "wrong_network", message, cause: err };
  }

  if (/timed out waiting for transaction/i.test(message)) {
    return { category: "timeout", message, cause: err };
  }

  if (/UserError|revert|VM execution error/i.test(message)) {
    return { category: "contract_revert", message, cause: err };
  }

  if (/fetch|network|ECONNREFUSED|Failed to fetch/i.test(message)) {
    return { category: "network_error", message, cause: err };
  }

  return { category: "unknown", message, cause: err };
}

export class WalletNotFoundError extends Error {
  constructor(message = "No injected wallet was found in this browser.") {
    super(message);
    this.name = "WalletNotFoundError";
  }
}
