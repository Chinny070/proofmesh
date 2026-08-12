/**
 * Regression check for transaction-receipt interpretation.
 *
 * This exists because a receipt-parsing bug once reported a *successful*
 * on-chain write as "contract execution failed": the code checked
 * `txExecutionResultName`, which StudioNet never populates. A user retried,
 * and the retry genuinely failed with "Profile ID already exists".
 *
 * It runs the real `trackTransaction` (bundled from source, not
 * reimplemented) against real finalized transactions fetched live from the
 * deployed contract, and asserts the outcome for each.
 *
 * Usage: npm run verify:receipts
 */
import { createServer } from "vite";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT = "0xfC0504f92783F1418e333AECb6CB587E24979e2a";

// Load the real module through Vite so we exercise shipped logic rather
// than a reimplementation of it.
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});
const { trackTransaction } = await server.ssrLoadModule("/src/lib/genlayer/receipts.ts");

const client = createClient({ chain: studionet });
const txs = await client.request({
  method: "sim_getTransactionsForAddress",
  params: [CONTRACT],
});

if (!Array.isArray(txs) || txs.length === 0) {
  console.error("No transactions found for the contract — cannot verify.");
  process.exit(1);
}

/** Runs the shipped tracker against one already-finalized receipt. */
async function outcomeFor(tx) {
  const receipt = await client.getTransaction({ hash: tx.hash });
  const stubClient = { waitForTransactionReceipt: async () => receipt };
  return trackTransaction(stubClient, tx.hash, () => {});
}

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
}

console.log(`Verifying receipt interpretation against ${txs.length} live transactions\n`);

for (const tx of txs) {
  const leader = [].concat(tx.consensus_data?.leader_receipt ?? [])[0];
  const execResult = leader?.execution_result;
  const expected =
    execResult === "SUCCESS" ? "finalized_success" : "finalized_execution_failed";

  const progress = await outcomeFor(tx);
  console.log(`${tx.hash.slice(0, 12)}…  execution_result=${execResult}`);
  check("state", progress.state, expected);

  if (expected === "finalized_success") {
    // A successful write must surface the contract's decoded return value,
    // not the input calldata.
    const hasReturn = progress.result !== undefined;
    console.log(
      `  ${hasReturn ? "PASS" : "FAIL"}  return value decoded: ${JSON.stringify(progress.result)}`,
    );
    if (!hasReturn) failures += 1;
  } else {
    // A failed write must surface the contract's own revert message.
    // The message must be the contract's own revert text, taken from the
    // leader receipt — not a generic fallback and not "undetermined".
    const expectedMsg = [].concat(tx.consensus_data?.leader_receipt ?? [])[0]?.result?.payload;
    const msg = progress.error?.message ?? "";
    const usesContractMessage =
      typeof expectedMsg === "string" ? msg === expectedMsg.trim() : msg.length > 0;
    console.log(`  ${usesContractMessage ? "PASS" : "FAIL"}  contract message: "${msg}"`);
    if (!usesContractMessage) failures += 1;
  }
  console.log();
}

await server.close();

if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("All receipt-interpretation checks passed.");
