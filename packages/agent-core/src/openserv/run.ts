import { config } from "dotenv";
import { createOrchestratorAgent } from "./orchestrator-agent.js";
import { createWorkerAgent } from "./worker-agent.js";
import { createSentinelAgent } from "./sentinel-agent.js";

config({ path: "../../.env" });

const agents = [
  { name: "Orchestrator", create: createOrchestratorAgent, port: 7378 },
  { name: "Worker", create: createWorkerAgent, port: 7379 },
  { name: "Sentinel", create: createSentinelAgent, port: 7380 },
];

async function main() {
  const target = process.argv[2];
  const toRun = target
    ? agents.filter((a) => a.name.toLowerCase() === target.toLowerCase())
    : agents;

  if (toRun.length === 0) {
    process.stderr.write(
      `Unknown agent: ${target}. Options: orchestrator, worker, sentinel\n`,
    );
    process.exit(1);
  }

  await Promise.all(
    toRun.map(async ({ name, create, port }) => {
      const agent = create(port);
      await agent.start();
      process.stderr.write(`${name} agent running on port ${port} (OpenServ SDK v2.4)\n`);
    }),
  );
}

main().catch((err) => {
  process.stderr.write(`OpenServ startup error: ${err}\n`);
  process.exit(1);
});
