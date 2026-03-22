import { config } from "dotenv";
config({ path: "../../.env" });

import { registerAgent } from "./tools/registry.js";

const agents: Array<{
  role: "orchestrator" | "worker" | "sentinel";
  uri: string;
  meta: Array<{ key: string; value: string }>;
}> = [
  {
    role: "orchestrator",
    uri: "https://agentledger.paracausal.tech/agents",
    meta: [
      { key: "role", value: "orchestrator" },
      { key: "capabilities", value: "job_creation,worker_selection,funding,verification" },
    ],
  },
  {
    role: "worker",
    uri: "https://agentledger.paracausal.tech/agents",
    meta: [
      { key: "role", value: "worker" },
      { key: "capabilities", value: "code_generation,research,data_analysis,writing" },
    ],
  },
  {
    role: "sentinel",
    uri: "https://agentledger.paracausal.tech/agents",
    meta: [
      { key: "role", value: "sentinel" },
      { key: "capabilities", value: "evaluation,quality_assurance,reputation_management" },
    ],
  },
];

async function main() {
  for (const agent of agents) {
    console.log(`Registering ${agent.role}...`);
    try {
      const { agentId, txHash } = await registerAgent(agent.role, agent.uri, agent.meta);
      console.log(`  Agent ID: ${agentId}, tx: ${txHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${msg.slice(0, 200)}`);
    }
  }
}

main();
