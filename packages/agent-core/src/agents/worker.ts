import { tool } from "ai";
import { z } from "zod";
import { parseUnits } from "viem";
import { runAgent, validateContent } from "./base-agent.js";
import * as escrow from "../tools/escrow.js";
import { webSearch, fetchUrl, enrichCompany } from "../x402/research.js";
import { uploadToFilecoin } from "../tools/filecoin.js";
import { generateSealedKey, sealContent } from "../crypto/sealed.js";

const SYSTEM_PROMPT = `You are the AgentLedger Worker — an AI agent that bids on and executes jobs from the AgentLedger marketplace.

Your responsibilities:
1. Browse open jobs that match your capabilities
2. Propose a budget (setBudget) for jobs you want to take
3. Execute the work using available tools (including paid APIs via x402)
4. Submit your deliverable when complete
5. Ensure deliverables meet quality standards

Capabilities: code generation, data analysis, research, writing

Rules:
- Only bid on jobs you can complete within the deadline
- Content must be at least 150 characters and contain no placeholders
- Use web_search, fetch_url, and enrich_company to gather real data
- Always validate your output before submitting
- Propose fair budgets based on task complexity`;

export const workerTools = {
  browse_jobs: tool({
    description: "List open jobs available for bidding",
    parameters: z.object({}),
    execute: async () => {
      const jobs = await escrow.browseJobs([0, 1]); // Open + Funded
      return jobs
        .map((j) => ({
          id: j.id.toString(),
          description: j.description,
          status: escrow.statusLabel(j.status),
          budget: j.budget.toString(),
        }));
    },
  }),

  set_budget: tool({
    description: "Propose a budget for a job (provider-only per ERC-8183)",
    parameters: z.object({
      jobId: z.number().min(0),
      amountUsdc: z.union([z.string(), z.number()]).transform(Number).pipe(z.number().min(0.01).max(1000)).transform(String).describe("Budget in USDC (e.g. '10' or 10)"),
    }),
    execute: async (params) => {
      const amount = parseUnits(String(params.amountUsdc), 6);
      const txHash = await escrow.setBudget(BigInt(params.jobId), amount);
      return { txHash, amount: amount.toString() };
    },
  }),

  submit_work: tool({
    description: "Submit deliverable for a funded job. Automatically encrypts with AES-256-GCM and stores on Filecoin before submitting hash onchain.",
    parameters: z.object({
      jobId: z.number().min(0),
      deliverable: z.string().min(150).describe("The completed work output"),
    }),
    execute: async (params) => {
      const validation = validateContent(params.deliverable);
      if (!validation.valid) {
        return { error: `Content validation failed: ${validation.reason}` };
      }
      try {
        // Auto-seal: encrypt + store on Filecoin before submitting
        let sealedKey: string | undefined;
        let cid: string | undefined;
        let sealed = false;
        try {
          const key = generateSealedKey();
          const encrypted = sealContent(params.deliverable, key);
          const result = await uploadToFilecoin(encrypted);
          if (result.stored) {
            sealedKey = key;
            cid = result.cid;
            sealed = true;
          }
        } catch {
          // Sealing failed — submit without encryption
        }

        const txHash = await escrow.submitWork(BigInt(params.jobId), params.deliverable);
        return { txHash, sealed, sealedKey, cid };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("InvalidStatus") || msg.includes("revert")) {
          return { error: `Submit failed (already submitted or wrong status): ${msg.slice(0, 120)}` };
        }
        throw err;
      }
    },
  }),

  get_job: tool({
    description: "Get details of a specific job",
    parameters: z.object({ jobId: z.number().min(0) }),
    execute: async (params) => {
      const job = await escrow.getJob(BigInt(params.jobId));
      return {
        id: job.id.toString(),
        description: job.description,
        status: escrow.statusLabel(job.status),
        budget: job.budget.toString(),
        provider: job.provider,
        evaluator: job.evaluator,
      };
    },
  }),

  web_search: tool({
    description: "Search the web for information (uses x402 paid API with free fallback)",
    parameters: z.object({
      query: z.string().min(3).describe("Search query"),
    }),
    execute: async (params) => {
      const result = await webSearch(params.query);
      return {
        results: result.results.slice(0, 5),
        source: result.source,
        count: result.results.length,
      };
    },
  }),

  fetch_url: tool({
    description: "Fetch and read content from a URL (uses x402 scraping with direct fallback)",
    parameters: z.object({
      url: z.string().url().describe("URL to fetch"),
    }),
    execute: async (params) => {
      const result = await fetchUrl(params.url);
      return {
        content: result.content.slice(0, 2000),
        source: result.source,
        length: result.content.length,
      };
    },
  }),

  enrich_company: tool({
    description: "Get enriched company data for a domain (uses x402 paid API)",
    parameters: z.object({
      domain: z.string().describe("Company domain (e.g. 'ubeswap.org')"),
    }),
    execute: async (params) => {
      const result = await enrichCompany(params.domain);
      return result;
    },
  }),

  store_deliverable: tool({
    description: "Encrypt and store deliverable on Filecoin (sealed delivery with AES-256-GCM)",
    parameters: z.object({
      content: z.string().min(150).describe("Content to store on Filecoin"),
    }),
    execute: async (params) => {
      try {
        const sealedKey = generateSealedKey();
        const encrypted = sealContent(params.content, sealedKey);
        const result = await uploadToFilecoin(encrypted);
        if (!result.stored) {
          return { ...result, sealed: false, sealFailed: "Filecoin upload fell back to hash-only mode" };
        }
        return { ...result, sealedKey, sealed: true };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        const result = await uploadToFilecoin(params.content);
        return { ...result, sealed: false, sealFailed: reason };
      }
    },
  }),
};

export function buildWorkerPrompt(jobContext?: string): string {
  if (jobContext) {
    return `${SYSTEM_PROMPT}\n\nCurrent context: ${jobContext}`;
  }
  return SYSTEM_PROMPT;
}

export async function runWorker(jobContext?: string): Promise<string> {
  return runAgent({
    id: "worker-v1",
    role: "worker",
    systemPrompt: buildWorkerPrompt(jobContext),
    tools: workerTools,
    maxIterations: 15,
  });
}
