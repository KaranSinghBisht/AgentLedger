import { config } from "dotenv";
config({ path: "../../.env" });

import { runWorker } from "./agents/worker.js";

async function main() {
  const context = process.argv[2];
  console.log("Starting AgentLedger Worker...");
  const result = await runWorker(context);
  console.log("Worker result:", result);
}

main().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
