import { config } from "dotenv";
config({ path: "../../.env" });

import { runOrchestrator } from "./agents/orchestrator.js";

async function main() {
  const task = process.argv[2];
  console.log("Starting AgentLedger Orchestrator...");
  const result = await runOrchestrator(task);
  console.log("Orchestrator result:", result);
}

main().catch((err) => {
  console.error("Orchestrator failed:", err);
  process.exit(1);
});
