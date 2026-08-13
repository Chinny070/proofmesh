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

  const raw = err instanceof Error ? err.message : String(err);
  const message = tidyMessage(raw);

  if (/wrong chain|configured for chain|switch your wallet/i.test(raw)) {
    return { category: "wrong_network", message, cause: err };
  }

  if (/timed out waiting for transaction/i.test(raw)) {
    return { category: "timeout", message, cause: err };
  }

  // GenVM surfaces contract reverts through viem as a generic
  // "execution failed" / invalid-parameters wrapper, so match both the
  // explicit forms and that wrapper.
  if (/UserError|revert|VM execution error|execution failed|Missing or invalid parameters/i.test(raw)) {
    return {
      category: "contract_revert",
      message: extractContractMessage(raw) ?? message,
      cause: err,
    };
  }

  if (/fetch|network|ECONNREFUSED|Failed to fetch/i.test(raw)) {
    return { category: "network_error", message, cause: err };
  }

  return { category: "unknown", message, cause: err };
}

/** Strips viem/SDK boilerplate that is noise to an end user. */
function tidyMessage(message: string): string {
  return message
    .replace(/\s*Version:\s*viem@[\d.]+/gi, "")
    .replace(/\s*Double check you have provided the correct parameters\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pulls a contract-authored message out of the wrapper when present.
 * ProofMesh raises `gl.vm.UserError("...")`, which can surface as
 * `UserError(message='...')` or as a bare quoted string.
 */
function extractContractMessage(raw: string): string | null {
  const userError = raw.match(/UserError\((?:message=)?['"](.+?)['"]\)/);
  if (userError) return userError[1];

  if (/execution failed|Missing or invalid parameters/i.test(raw)) {
    return "The contract rejected this call. The record may not exist, or the arguments were invalid.";
  }
  return null;
}

/**
 * Whether an error means "the contract rejected this call" (the record
 * genuinely does not exist / the arguments were invalid) as opposed to a
 * transport failure.
 *
 * This distinction matters: a transient RPC blip must not be presented to
 * the user as "record not found", which reads like data loss.
 */
export function isContractRevert(error: unknown): boolean {
  const normalized = (error as { normalized?: NormalizedError } | null)?.normalized;
  return normalized?.category === "contract_revert";
}

/**
 * Whether a failed read is worth retrying. Contract reverts are
 * deterministic — retrying re-runs the same rejection — so only transport
 * failures are retried.
 */
export function isRetryableError(error: unknown): boolean {
  const normalized = (error as { normalized?: NormalizedError } | null)?.normalized;
  if (!normalized) return true; // unclassified: assume transport, allow a retry
  return normalized.category === "network_error" || normalized.category === "timeout";
}

export class WalletNotFoundError extends Error {
  constructor(message = "No injected wallet was found in this browser.") {
    super(message);
    this.name = "WalletNotFoundError";
  }
}
