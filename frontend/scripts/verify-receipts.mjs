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

/**
 * Runs the shipped tracker against one already-finalized receipt. The
 * tracker polls via getTransaction, so the stub serves the real receipt
 * from there — every transaction here is already terminal, so a single
 * poll settles it.
 */
async function outcomeFor(receipt, hash) {
  const stubClient = { getTransaction: async () => receipt };
  return trackTransaction(stubClient, hash, () => {});
}

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
}

console.log(`Verifying receipt interpretation against ${txs.length} live transactions\n`);

/** 6 = MAJORITY_AGREE, 7 = MAJORITY_DISAGREE (per the SDK's own mapping). */
const CONSENSUS_AGREE_CODES = new Set([1, 6]);

for (const tx of txs) {
  const leader = [].concat(tx.consensus_data?.leader_receipt ?? [])[0];
  const execResult = leader?.execution_result;

  // A write lands only when the leader executed successfully AND
  // validators agreed. The decoded receipt carries consensus as a numeric
  // `result` code; the raw shape carries the return value there instead,
  // so consensus is read from the decoded transaction.
  const decoded = await client.getTransaction({ hash: tx.hash });
  const consensusAgreed =
    typeof decoded.result === "number" ? CONSENSUS_AGREE_CODES.has(decoded.result) : true;

  const expected =
    execResult === "SUCCESS" && consensusAgreed
      ? "finalized_success"
      : "finalized_execution_failed";

  const progress = await outcomeFor(decoded, tx.hash);
  console.log(
    `${tx.hash.slice(0, 12)}…  execution_result=${execResult}  consensus=${
      consensusAgreed ? "agreed" : "DISAGREED"
    }`,
  );
  check("state", progress.state, expected);

  // Regression guard: a leader-success / consensus-disagree transaction
  // must never be reported as success. Reading only the leader receipt
  // once caused exactly that, claiming a credential that did not exist.
  if (execResult === "SUCCESS" && !consensusAgreed) {
    const ok = progress.state !== "finalized_success";
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  leader-success + consensus-disagree not reported as success`,
    );
    if (!ok) failures += 1;
    const mentionsConsensus = /agreement|consensus/i.test(progress.error?.message ?? "");
    console.log(`  ${mentionsConsensus ? "PASS" : "FAIL"}  explains consensus disagreement`);
    if (!mentionsConsensus) failures += 1;
    console.log();
    continue;
  }

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
