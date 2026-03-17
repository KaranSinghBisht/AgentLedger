import { tool } from "ai";
import { z } from "zod";
import { keccak256, toHex } from "viem";
import { runAgent } from "./base-agent.js";
import * as escrow from "../tools/escrow.js";
import * as registry from "../tools/registry.js";
import { completeJobAndWait, rejectJobAndWait } from "../tools/escrow-receipts.js";

const SYSTEM_PROMPT = `You are the AgentLedger Sentinel — an AI evaluator that judges submitted work and manages reputation.

Your responsibilities:
1. Monitor for submitted jobs (status: Submitted)
2. Evaluate deliverables against job requirements
3. Complete (approve) or reject jobs with clear reasoning
4. Write reputation feedback via ERC-8004 after settlement

Evaluation criteria:
- Does the deliverable address the job description?
- Is the content substantial (not placeholder/gibberish)?
- Does it meet minimum quality standards?

Rules:
- Always check the job description before evaluating
- Provide clear, specific reasons for approval or rejection
- After completing a job, write positive reputation for the worker
- After rejecting a job, write negative reputation
- Never approve empty or placeholder content`;

export const sentinelTools = {
  browse_submitted: tool({
    description: "List jobs awaiting evaluation (status: Submitted)",
    parameters: z.object({}),
    execute: async () => {
      const jobs = await escrow.browseJobs();
      return jobs
        .filter((j) => j.status === 2) // Submitted
        .map((j) => ({
          id: j.id.toString(),
          description: j.description,
          provider: j.provider,
          budget: j.budget.toString(),
        }));
    },
  }),

  get_job: tool({
    description: "Get full details of a job",
    parameters: z.object({ jobId: z.number() }),
    execute: async (params) => {
      const job = await escrow.getJob(BigInt(params.jobId));
      return {
        id: job.id.toString(),
        description: job.description,
        status: escrow.statusLabel(job.status),
        budget: job.budget.toString(),
        provider: job.provider,
        client: job.client,
      };
    },
  }),

  complete_job: tool({
    description: "Approve submitted work and trigger payment settlement (waits for tx confirmation)",
    parameters: z.object({
      jobId: z.number(),
      reason: z.string().min(10).describe("Reason for approval"),
    }),
    execute: async (params) => {
      const { txHash, status } = await completeJobAndWait(BigInt(params.jobId), params.reason);
      return { txHash, status, action: "completed" };
    },
  }),

  reject_job: tool({
    description: "Reject submitted work and refund client (waits for tx confirmation)",
    parameters: z.object({
      jobId: z.number(),
      reason: z.string().min(10).describe("Reason for rejection"),
    }),
    execute: async (params) => {
      const { txHash, status } = await rejectJobAndWait(BigInt(params.jobId), params.reason);
      return { txHash, status, action: "rejected" };
    },
  }),

  write_reputation: tool({
    description: "Write reputation feedback for an agent via ERC-8004 on Ethereum Sepolia",
    parameters: z.object({
      agentId: z.number(),
      positive: z.boolean(),
      reason: z.string(),
    }),
    execute: async (params) => {
      const value = params.positive ? 80n : -50n;
      const feedbackHash = keccak256(toHex(params.reason));
      const txHash = await registry.giveFeedback({
        agentId: BigInt(params.agentId),
        value,
        valueDecimals: 0,
        tag1: "quality",
        tag2: params.positive ? "approved" : "rejected",
        endpoint: "",
        feedbackURI: "",
        feedbackHash,
      });
      return { txHash, value: value.toString() };
    },
  }),
};

export function buildSentinelPrompt(jobContext?: string): string {
  if (jobContext) {
    return `${SYSTEM_PROMPT}\n\nCurrent context: ${jobContext}`;
  }
  return SYSTEM_PROMPT;
}

export async function runSentinel(jobContext?: string): Promise<string> {
  return runAgent({
    id: "sentinel-v1",
    role: "sentinel",
    systemPrompt: buildSentinelPrompt(jobContext),
    tools: sentinelTools,
    maxIterations: 15,
  });
}
