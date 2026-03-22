import { Agent } from "@openserv-labs/sdk";
import { z } from "zod";
import { keccak256, toHex } from "viem";
import * as escrow from "../tools/escrow.js";
import * as registry from "../tools/registry.js";
import { completeJobAndWait, rejectJobAndWait } from "../tools/escrow-receipts.js";
import { downloadFromFilecoin } from "../tools/filecoin.js";
import { logToWorkspace } from "./platform-hooks.js";
import { unsealContent } from "../crypto/sealed.js";

const SYSTEM_PROMPT = `You are the AgentLedger Sentinel — an AI evaluator that judges submitted work and manages reputation.

Your responsibilities:
1. Monitor for submitted jobs (status: Submitted)
2. Retrieve deliverables from Filecoin storage
3. Evaluate deliverables against job requirements
4. Complete or reject jobs with clear reasoning
5. Write reputation feedback via ERC-8004

Evaluation criteria:
- Does the deliverable address the job description?
- Is the content substantial (not placeholder/gibberish)?
- Does it meet minimum quality standards?

Rules:
- Always check the job description before evaluating
- Provide clear, specific reasons for approval or rejection
- After completing a job, write positive reputation
- After rejecting a job, write negative reputation`;

export function createSentinelAgent(port = 7380): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    port,
  });

  agent.addCapability({
    name: "browse_submitted",
    description: "List jobs awaiting evaluation",
    inputSchema: z.object({}),
    async run() {
      const jobs = await escrow.browseJobs([2]);
      return JSON.stringify(
        jobs.map((j) => ({
          id: j.id.toString(),
          description: j.description,
          provider: j.provider,
          budget: j.budget.toString(),
        })),
      );
    },
  });

  agent.addCapability({
    name: "get_job",
    description: "Get full details of a job",
    inputSchema: z.object({ jobId: z.number().min(0) }),
    async run({ args }) {
      const job = await escrow.getJob(BigInt(args.jobId));
      return JSON.stringify({
        id: job.id.toString(),
        description: job.description,
        status: escrow.statusLabel(job.status),
        budget: job.budget.toString(),
        provider: job.provider,
        client: job.client,
      });
    },
  });

  agent.addCapability({
    name: "complete_job",
    description: "Approve submitted work and trigger payment",
    inputSchema: z.object({
      jobId: z.number().min(0),
      reason: z.string().min(10),
    }),
    async run({ args, action }) {
      try {
        const { txHash, status } = await completeJobAndWait(
          BigInt(args.jobId),
          args.reason,
        );
        await logToWorkspace(this, action, "info", `Job #${args.jobId} APPROVED: ${args.reason}`);
        return JSON.stringify({ txHash, status, action: "completed" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("InvalidStatus") || msg.includes("revert")) {
          return JSON.stringify({ error: `Job already settled or wrong status: ${msg.slice(0, 120)}`, action: "skipped" });
        }
        throw err;
      }
    },
  });

  agent.addCapability({
    name: "reject_job",
    description: "Reject submitted work and refund client",
    inputSchema: z.object({
      jobId: z.number().min(0),
      reason: z.string().min(10),
    }),
    async run({ args, action }) {
      try {
        const { txHash, status } = await rejectJobAndWait(
          BigInt(args.jobId),
          args.reason,
        );
        await logToWorkspace(this, action, "warning", `Job #${args.jobId} REJECTED: ${args.reason}`);
        return JSON.stringify({ txHash, status, action: "rejected" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("InvalidStatus") || msg.includes("revert")) {
          return JSON.stringify({ error: `Job already settled or wrong status: ${msg.slice(0, 120)}`, action: "skipped" });
        }
        throw err;
      }
    },
  });

  agent.addCapability({
    name: "retrieve_deliverable",
    description: "Retrieve deliverable from Filecoin by CID. Provide sealedKey to decrypt sealed deliverables.",
    inputSchema: z.object({
      cid: z.string(),
      sealedKey: z.string().optional().describe("AES-256 decryption key (hex) for sealed deliverables"),
    }),
    async run({ args }) {
      try {
        let content = await downloadFromFilecoin(args.cid);
        if (args.sealedKey) {
          try {
            content = unsealContent(content, args.sealedKey);
          } catch (decryptErr) {
            const msg = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
            return JSON.stringify({ error: `Decryption failed: ${msg}`, sealed: true });
          }
        }
        return JSON.stringify({
          content: content.slice(0, 2000),
          length: content.length,
          sealed: !!args.sealedKey,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ error: msg });
      }
    },
  });

  agent.addCapability({
    name: "write_reputation",
    description: "Write reputation feedback for an agent via ERC-8004",
    inputSchema: z.object({
      agentId: z.number(),
      positive: z.boolean(),
      reason: z.string(),
    }),
    async run({ args, action }) {
      const value = args.positive ? 80n : -50n;
      const feedbackHash = keccak256(toHex(args.reason));
      try {
        const txHash = await registry.giveFeedback({
          agentId: BigInt(args.agentId),
          value,
          valueDecimals: 0,
          tag1: "quality",
          tag2: args.positive ? "approved" : "rejected",
          endpoint: "",
          feedbackURI: "",
          feedbackHash,
        });
        await logToWorkspace(this, action, "info", `Reputation ${args.positive ? "+80" : "-50"} for agent #${args.agentId}: ${args.reason}`);
        return JSON.stringify({ txHash, value: value.toString() });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("insufficient funds") || msg.includes("timed out")) {
          return JSON.stringify({ error: `Reputation write failed: ${msg.slice(0, 100)}`, value: value.toString(), skipped: true });
        }
        throw err;
      }
    },
  });

  return agent;
}
