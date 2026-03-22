import { Agent } from "@openserv-labs/sdk";
import { z } from "zod";
import { parseUnits } from "viem";
import * as escrow from "../tools/escrow.js";
import { webSearch } from "../x402/research.js";
import { uploadToFilecoin } from "../tools/filecoin.js";
import { validateContent } from "../agents/base-agent.js";
import { logToWorkspace, uploadToWorkspace } from "./platform-hooks.js";
import { generateSealedKey, sealContent } from "../crypto/sealed.js";

const SYSTEM_PROMPT = `You are the AgentLedger Worker — an AI agent that bids on and executes jobs from the AgentLedger marketplace.

Your responsibilities:
1. Browse open jobs that match your capabilities
2. Propose a budget for jobs you want to take
3. Execute work using available tools (web search, Filecoin storage)
4. Submit deliverables when complete

Capabilities: code generation, data analysis, research, writing

Rules:
- Content must be at least 150 characters and contain no placeholders
- Store deliverables on Filecoin for verifiable retrieval
- Always validate your output before submitting`;

export function createWorkerAgent(port = 7379): Agent {
  const agent = new Agent({
    systemPrompt: SYSTEM_PROMPT,
    port,
  });

  agent.addCapability({
    name: "browse_jobs",
    description: "List open jobs available for bidding",
    inputSchema: z.object({}),
    async run() {
      const jobs = await escrow.browseJobs([0, 1]);
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
    name: "set_budget",
    description: "Propose a budget for a job",
    inputSchema: z.object({
      jobId: z.number().min(0),
      amountUsdc: z.number().min(0.01).max(1000),
    }),
    async run({ args }) {
      const amount = parseUnits(String(args.amountUsdc), 6);
      const txHash = await escrow.setBudget(BigInt(args.jobId), amount);
      return JSON.stringify({ txHash, amount: amount.toString() });
    },
  });

  agent.addCapability({
    name: "submit_work",
    description: "Submit deliverable for a funded job",
    inputSchema: z.object({
      jobId: z.number().min(0),
      deliverable: z.string().min(150),
    }),
    async run({ args, action }) {
      const validation = validateContent(args.deliverable);
      if (!validation.valid) {
        return JSON.stringify({ error: `Content validation failed: ${validation.reason}` });
      }
      try {
        const txHash = await escrow.submitWork(
          BigInt(args.jobId),
          args.deliverable,
        );
        await uploadToWorkspace(this, action, `deliverable-job-${args.jobId}.txt`, args.deliverable);
        await logToWorkspace(this, action, "info", `Submitted deliverable for job #${args.jobId} (tx: ${txHash})`);
        return JSON.stringify({ txHash });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("InvalidStatus") || msg.includes("revert")) {
          return JSON.stringify({ error: `Submit failed: ${msg.slice(0, 120)}` });
        }
        throw err;
      }
    },
  });

  agent.addCapability({
    name: "web_search",
    description: "Search the web for information",
    inputSchema: z.object({ query: z.string().min(3) }),
    async run({ args }) {
      const result = await webSearch(args.query);
      return JSON.stringify({
        results: result.results.slice(0, 5),
        source: result.source,
      });
    },
  });

  agent.addCapability({
    name: "store_deliverable",
    description: "Encrypt and store deliverable on Filecoin (sealed delivery with AES-256-GCM)",
    inputSchema: z.object({ content: z.string().min(150) }),
    async run({ args, action }) {
      try {
        const sealedKey = generateSealedKey();
        const encrypted = sealContent(args.content, sealedKey);
        const result = await uploadToFilecoin(encrypted);
        if (!result.stored) {
          await uploadToWorkspace(this, action, `filecoin-${result.cid?.slice(0, 12) ?? "upload"}.txt`, args.content);
          return JSON.stringify({ ...result, sealed: false, sealFailed: "Filecoin upload fell back to hash-only mode" });
        }
        await uploadToWorkspace(this, action, `sealed-cid-${result.cid?.slice(0, 12) ?? "upload"}.txt`, `CID: ${result.cid}\nSealed: true\nKey must be requested from worker agent.`);
        return JSON.stringify({ ...result, sealedKey, sealed: true });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        const result = await uploadToFilecoin(args.content);
        await uploadToWorkspace(this, action, `filecoin-${result.cid?.slice(0, 12) ?? "upload"}.txt`, args.content);
        return JSON.stringify({ ...result, sealed: false, sealFailed: reason });
      }
    },
  });

  return agent;
}
