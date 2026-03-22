import { Agent } from "@openserv-labs/sdk";
import { z } from "zod";
import { type Address } from "viem";
import * as escrow from "../tools/escrow.js";
import * as registry from "../tools/registry.js";
import { logToWorkspace, createWorkspaceTask } from "./platform-hooks.js";

const SYSTEM_PROMPT = `You are the AgentLedger Orchestrator — an autonomous AI agent that posts jobs on the AgentLedger marketplace on Celo.

Your responsibilities:
1. Discover problems or tasks that need solving
2. Post jobs with appropriate budgets and deadlines
3. Select the best worker agent based on reputation
4. Fund jobs and monitor progress

You have a USDC wallet on Celo. You interact with the AgentLedger escrow contract.

Rules:
- Always check worker reputation before selecting
- Set reasonable budgets (1-100 USDC per job)
- Set deadlines at least 1 hour in the future
- Never fund a job without a provider and budget set`;

export function createOrchestratorAgent(port = 7378): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    port,
  });

  agent.addCapability({
    name: "create_job",
    description: "Create a new escrowed job on AgentLedger",
    inputSchema: z.object({
      description: z.string().min(10),
      provider: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      evaluator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      hoursDeadline: z.number().min(1).default(24),
    }),
    async run({ args, action }) {
      const expiredAt = BigInt(
        Math.floor(Date.now() / 1000) + args.hoursDeadline * 3600,
      );
      const result = await escrow.createJob({
        provider: args.provider as Address,
        evaluator: args.evaluator as Address,
        expiredAt,
        description: args.description,
        hook: "0x0000000000000000000000000000000000000000" as Address,
      });
      await createWorkspaceTask(this, action, `Job #${result.jobId}: ${args.description.slice(0, 50)}`, args.description);
      await logToWorkspace(this, action, "info", `Created job #${result.jobId} (tx: ${result.txHash})`);
      return JSON.stringify({
        jobId: result.jobId.toString(),
        txHash: result.txHash,
      });
    },
  });

  agent.addCapability({
    name: "fund_job",
    description: "Fund an existing job with USDC from escrow",
    inputSchema: z.object({ jobId: z.number().min(0) }),
    async run({ args, action }) {
      const txHash = await escrow.fundJob(BigInt(args.jobId));
      await logToWorkspace(this, action, "info", `Funded job #${args.jobId} (tx: ${txHash})`);
      return JSON.stringify({ txHash });
    },
  });

  agent.addCapability({
    name: "browse_jobs",
    description: "List all jobs on the marketplace",
    inputSchema: z.object({}),
    async run() {
      const jobs = await escrow.browseJobs();
      return JSON.stringify(
        jobs.map((j) => ({
          id: j.id.toString(),
          description: j.description,
          status: escrow.statusLabel(j.status),
          budget: j.budget.toString(),
        })),
      );
    },
  });

  agent.addCapability({
    name: "get_reputation",
    description: "Check an agent's reputation score via ERC-8004",
    inputSchema: z.object({ agentId: z.number() }),
    async run({ args }) {
      const rep = await registry.getReputation(BigInt(args.agentId));
      return JSON.stringify({
        totalFeedbacks: rep.totalFeedbacks.toString(),
        averageValue: rep.averageValue.toString(),
      });
    },
  });

  return agent;
}
