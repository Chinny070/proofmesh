/**
 * Stage 9 live read verification against the deployed ProofMesh contract.
 *
 * Exercises the same genlayer-js call path the browser adapter uses
 * (createClient + readContract against StudioNet), without a wallet --
 * reads never require one.
 *
 * Run: node scripts/verify-reads.mjs
 */
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const CONTRACT = "0x92D7FA9942b3e4F832DEDA07a0F517a330499c4D";

const client = createClient({ chain: studionet });

const methods = [
  "get_protocol_status",
  "list_profiles",
  "list_credentials",
  "list_trust_policies",
];

let failed = 0;
for (const functionName of methods) {
  try {
    const result = await client.readContract({
      address: CONTRACT,
      functionName,
      args: [],
    });
    console.log(`${functionName}() -> ${result}`);
  } catch (err) {
    failed += 1;
    console.error(`${functionName}() -> ERROR: ${err?.message ?? err}`);
  }
}

process.exit(failed === 0 ? 0 : 1);
