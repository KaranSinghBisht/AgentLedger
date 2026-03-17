import { config } from "dotenv";
config({ path: "../../.env" });

import { runSentinel } from "./agents/sentinel.js";

async function main() {
  const context = process.argv[2];
  console.log("Starting AgentLedger Sentinel...");
  const result = await runSentinel(context);
  console.log("Sentinel result:", result);
}

main().catch((err) => {
  console.error("Sentinel failed:", err);
  process.exit(1);
});
