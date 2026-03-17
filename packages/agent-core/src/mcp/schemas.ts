import { z } from "zod";

// Shared Zod schemas used by both MCP server and AI SDK tools

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

export const createJobSchema = z.object({
  provider: addressSchema.describe("Provider (worker agent) address"),
  evaluator: addressSchema.describe("Evaluator (sentinel) address"),
  expiredAt: z.number().describe("Unix timestamp for job deadline"),
  description: z.string().min(10).describe("Job requirements"),
  hook: addressSchema.default("0x0000000000000000000000000000000000000000").describe("Hook contract address"),
});

export const setProviderSchema = z.object({
  jobId: z.number().describe("Job ID"),
  provider: addressSchema.describe("Provider address to assign"),
});

export const setBudgetSchema = z.object({
  jobId: z.number().describe("Job ID"),
  amount: z.string().describe("Budget amount in USDC (e.g. '100' for 100 USDC)"),
});

export const fundJobSchema = z.object({
  jobId: z.number().describe("Job ID to fund"),
});

export const submitWorkSchema = z.object({
  jobId: z.number().describe("Job ID"),
  deliverable: z.string().min(1).describe("Deliverable content or hash"),
});

export const evaluateWorkSchema = z.object({
  jobId: z.number().describe("Job ID"),
  approve: z.boolean().describe("True to complete, false to reject"),
  reason: z.string().describe("Reason for evaluation decision"),
});

export const getJobSchema = z.object({
  jobId: z.number().describe("Job ID to query"),
});

export const registerAgentSchema = z.object({
  role: z.enum(["orchestrator", "worker", "sentinel"]),
  agentURI: z.string().url().describe("Agent metadata URI"),
  capabilities: z.string().describe("Comma-separated capabilities"),
});

export const getReputationSchema = z.object({
  agentId: z.number().describe("ERC-8004 agent ID"),
});

export const giveFeedbackSchema = z.object({
  agentId: z.number().describe("Agent ID to give feedback for"),
  value: z.number().min(-100).max(100).describe("Feedback value (-100 to 100)"),
  tag1: z.string().default("quality").describe("Primary category tag"),
  tag2: z.string().default("").describe("Secondary tag"),
});

export const checkBalanceSchema = z.object({
  address: addressSchema.describe("Address to check balance for"),
});

export const resolveNameSchema = z.object({
  name: z.string().describe("ENS name to resolve"),
});

export const browseJobsSchema = z.object({
  status: z.enum(["all", "open", "funded", "submitted"]).default("all").describe("Filter by status"),
});
