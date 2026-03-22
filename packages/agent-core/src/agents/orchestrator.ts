import { tool } from "ai";
import { z } from "zod";
import { type Address } from "viem";
import { runAgent } from "./base-agent.js";
import * as escrow from "../tools/escrow.js";
import * as registry from "../tools/registry.js";

const SYSTEM_PROMPT = `You are the AgentLedger Orchestrator — an autonomous AI agent that posts jobs on the AgentLedger marketplace.

Your responsibilities:
1. Discover problems or tasks that need solving
2. Decompose complex tasks into sub-jobs
3. Post jobs with appropriate budgets and deadlines
4. Select the best worker agent based on reputation
5. Fund jobs and monitor progress
6. Verify completed work quality

You have a USDC wallet on Celo. You interact with the AgentLedger escrow contract.

Rules:
- Always check worker reputation before selecting
- Set reasonable budgets (1-100 USDC per job)
- Set deadlines at least 1 hour in the future
- Monitor job status and claim refunds if expired
- Never fund a job without a provider and budget set`;

export const orchestratorTools = {
  create_job: tool({
    description: "Create a new escrowed job on AgentLedger",
    parameters: z.object({
      description: z.string().min(10),
      provider: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("Worker address, or zero address for open jobs"),
      evaluator: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      hoursDeadline: z.number().min(1).default(24),
      hook: z.string().regex(/^0x[a-fA-F0-9]{40}$/).default("0xF969c4Daa194d639E8d505EebF38600Cc1A87DaE"),
    }),
    execute: async (params) => {
      const expiredAt = BigInt(Math.floor(Date.now() / 1000) + params.hoursDeadline * 3600);
      const { jobId, txHash } = await escrow.createJob({
        provider: params.provider as Address,
        evaluator: params.evaluator as Address,
        expiredAt,
        description: params.description,
        hook: params.hook as Address,
      });
      return { jobId: jobId.toString(), txHash };
    },
  }),

  set_provider: tool({
    description: "Assign a worker agent to a job (one-time, before funding)",
    parameters: z.object({
      jobId: z.number().min(0),
      provider: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    }),
    execute: async (params) => {
      const txHash = await escrow.setProvider(BigInt(params.jobId), params.provider as Address);
      return { txHash };
    },
  }),

  fund_job: tool({
    description: "Fund an existing job (transfers USDC to escrow)",
    parameters: z.object({ jobId: z.number().min(0) }),
    execute: async (params) => {
      const txHash = await escrow.fundJob(BigInt(params.jobId));
      return { txHash };
    },
  }),

  browse_jobs: tool({
    description: "List all jobs on the marketplace",
    parameters: z.object({}),
    execute: async () => {
      const jobs = await escrow.browseJobs();
      return jobs.map((j) => ({
        id: j.id.toString(),
        description: j.description,
        status: escrow.statusLabel(j.status),
        budget: j.budget.toString(),
        provider: j.provider,
      }));
    },
  }),

  get_reputation: tool({
    description: "Check an agent's reputation score",
    parameters: z.object({ agentId: z.number() }),
    execute: async (params) => {
      const rep = await registry.getReputation(BigInt(params.agentId));
      return {
        totalFeedbacks: rep.totalFeedbacks.toString(),
        averageValue: rep.averageValue.toString(),
      };
    },
  }),

  get_job: tool({
    description: "Get details of a specific job",
    parameters: z.object({ jobId: z.number().min(0) }),
    execute: async (params) => {
      const job = await escrow.getJob(BigInt(params.jobId));
      return {
        id: job.id.toString(),
        client: job.client,
        provider: job.provider,
        evaluator: job.evaluator,
        description: job.description,
        budget: job.budget.toString(),
        expiredAt: job.expiredAt.toString(),
        status: escrow.statusLabel(job.status),
      };
    },
  }),
};

export function buildOrchestratorPrompt(task?: string): string {
  const base = SYSTEM_PROMPT;
  if (task) {
    return `${base}\n\nYour current task: ${task}`;
  }
  return base;
}

export async function runOrchestrator(taskDescription?: string): Promise<string> {
  const task = taskDescription ?? "Research the top 5 DeFi protocols on Celo and write a 500-word analytical report";
  return runAgent({
    id: "orchestrator-v1",
    role: "orchestrator",
    systemPrompt: buildOrchestratorPrompt(task),
    tools: orchestratorTools,
    maxIterations: 20,
  });
}
