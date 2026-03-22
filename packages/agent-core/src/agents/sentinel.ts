import { tool } from "ai";
import { z } from "zod";
import { keccak256, toHex } from "viem";
import { runAgent } from "./base-agent.js";
import * as escrow from "../tools/escrow.js";
import * as registry from "../tools/registry.js";
import { completeJobAndWait, rejectJobAndWait } from "../tools/escrow-receipts.js";
import { downloadFromFilecoin } from "../tools/filecoin.js";
import { unsealContent } from "../crypto/sealed.js";

const SYSTEM_PROMPT = `You are the AgentLedger Sentinel — an AI evaluator that judges submitted work and manages reputation.

Your responsibilities:
1. Monitor for submitted jobs (status: Submitted)
2. Evaluate deliverables against job requirements using a structured rubric
3. Complete (approve) or reject jobs with clear reasoning
4. Write reputation feedback via ERC-8004 after settlement

EVALUATION RUBRIC — You MUST score each category before making your decision:

1. COMPLETENESS (0-25): Does the deliverable address ALL parts of the job description?
2. ACCURACY (0-25): Is the data real and verifiable? Are sources cited?
3. DEPTH (0-25): Is the analysis substantive or surface-level? Are there specific details?
4. FORMAT (0-25): Is it well-structured with clear sections, tables, or organized output?

Total score = sum of all categories (0-100)
- Score >= 60: APPROVE → call complete_job
- Score < 60: REJECT → call reject_job

CRITICAL: You MUST output your rubric scores BEFORE calling complete_job or reject_job. Format:
"Evaluation: Completeness X/25, Accuracy X/25, Depth X/25, Format X/25 = Total X/100 → APPROVE/REJECT"

Rules:
- Always check the job description before evaluating
- Provide clear, specific reasons for approval or rejection
- After completing a job, write positive reputation (+80) for the worker
- After rejecting a job, write negative reputation (-50)
- Never approve empty or placeholder content`;

export const sentinelTools = {
  browse_submitted: tool({
    description: "List jobs awaiting evaluation (status: Submitted)",
    parameters: z.object({}),
    execute: async () => {
      const jobs = await escrow.browseJobs([2]); // Submitted only
      return jobs
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
    parameters: z.object({ jobId: z.number().min(0) }),
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
      jobId: z.number().min(0),
      reason: z.string().min(10).describe("Reason for approval"),
    }),
    execute: async (params) => {
      try {
        const { txHash, status } = await completeJobAndWait(BigInt(params.jobId), params.reason);
        return { txHash, status, action: "completed" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("InvalidStatus") || msg.includes("revert")) {
          return { error: `Job already settled or wrong status: ${msg.slice(0, 120)}`, action: "skipped" };
        }
        throw err;
      }
    },
  }),

  reject_job: tool({
    description: "Reject submitted work and refund client (waits for tx confirmation)",
    parameters: z.object({
      jobId: z.number().min(0),
      reason: z.string().min(10).describe("Reason for rejection"),
    }),
    execute: async (params) => {
      try {
        const { txHash, status } = await rejectJobAndWait(BigInt(params.jobId), params.reason);
        return { txHash, status, action: "rejected" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("InvalidStatus") || msg.includes("revert")) {
          return { error: `Job already settled or wrong status: ${msg.slice(0, 120)}`, action: "skipped" };
        }
        throw err;
      }
    },
  }),

  retrieve_deliverable: tool({
    description: "Retrieve deliverable from Filecoin by CID. Provide sealedKey to decrypt sealed deliverables.",
    parameters: z.object({
      cid: z.string().describe("Filecoin CID to retrieve"),
      sealedKey: z.string().optional().describe("AES-256 decryption key (hex) for sealed deliverables"),
    }),
    execute: async (params) => {
      try {
        let content = await downloadFromFilecoin(params.cid);
        if (params.sealedKey) {
          try {
            content = unsealContent(content, params.sealedKey);
          } catch (decryptErr) {
            const msg = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
            return { error: `Decryption failed: ${msg}`, sealed: true };
          }
        }
        return { content: content.slice(0, 8000), length: content.length, sealed: !!params.sealedKey };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { error: msg };
      }
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
      try {
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("insufficient funds") || msg.includes("timed out")) {
          return {
            error: `Reputation write failed (Eth Sepolia): ${msg.slice(0, 100)}`,
            value: value.toString(),
            skipped: true,
          };
        }
        throw err;
      }
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
