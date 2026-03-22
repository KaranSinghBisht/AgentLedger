import { z } from "zod";

// Shared Zod schemas used by both MCP server and AI SDK tools

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
export const bytes32Schema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);

export const createJobSchema = z.object({
  provider: addressSchema.describe("Provider (worker agent) address"),
  evaluator: addressSchema.describe("Evaluator (sentinel) address"),
  expiredAt: z.number().describe("Unix timestamp for job deadline"),
  description: z.string().min(10).max(5000).describe("Job requirements"),
  hook: addressSchema.default("0x0000000000000000000000000000000000000000").describe("Hook contract address"),
});

export const setProviderSchema = z.object({
  jobId: z.number().min(0).describe("Job ID"),
  provider: addressSchema.describe("Provider address to assign"),
});

export const setBudgetSchema = z.object({
  jobId: z.number().min(0).describe("Job ID"),
  amount: z.string().regex(/^\d+(\.\d+)?$/).describe("Budget amount in USDC (e.g. '10' for 10 USDC, max 1000)"),
});

export const fundJobSchema = z.object({
  jobId: z.number().min(0).describe("Job ID to fund"),
});

export const submitWorkSchema = z.object({
  jobId: z.number().min(0).describe("Job ID"),
  deliverable: z.string().min(150).max(50000).describe("Deliverable content (min 150 chars)"),
});

export const evaluateWorkSchema = z.object({
  jobId: z.number().min(0).describe("Job ID"),
  approve: z.boolean().describe("True to complete, false to reject"),
  reason: z.string().min(10).describe("Reason for evaluation decision"),
});

export const getJobSchema = z.object({
  jobId: z.number().min(0).describe("Job ID to query"),
});

export const registerAgentSchema = z.object({
  role: z.enum(["orchestrator", "worker", "sentinel"]),
  agentURI: z.string().url().max(500).describe("Agent metadata URI"),
  capabilities: z.string().max(1000).describe("Comma-separated capabilities"),
});

export const getReputationSchema = z.object({
  agentId: z.number().min(0).describe("ERC-8004 agent ID"),
});

export const giveFeedbackSchema = z.object({
  agentId: z.number().min(0).describe("Agent ID to give feedback for"),
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

export const storeDeliverableSchema = z.object({
  content: z.string().min(150).max(50000).describe("Content to store on Filecoin"),
});

export const retrieveDeliverableSchema = z.object({
  cid: z.string().describe("Filecoin CID to retrieve"),
  sealedKey: z.string().optional().describe("AES-256 decryption key (hex) for sealed deliverables"),
});

export const claimRefundSchema = z.object({
  jobId: z.number().min(0).describe("Job ID to claim refund for"),
});

export const submitBidSchema = z.object({
  jobId: z.number().min(0).describe("Job ID to bid on"),
  agentAddress: addressSchema.describe("Bidding agent's address"),
  agentId: z.number().min(0).describe("Agent's ERC-8004 ID"),
  proposedBudget: z.string().regex(/^\d+(\.\d+)?$/).describe("Proposed USDC amount"),
  reason: z.string().min(10).describe("Why this agent should get the job"),
});

export const getBidsSchema = z.object({
  jobId: z.number().min(0).describe("Job ID to get bids for"),
});

export const selectWorkerSchema = z.object({
  jobId: z.number().min(0).describe("Job ID"),
  strategy: z.enum(["cheapest", "best_value"]).default("cheapest").describe("Selection strategy"),
});

export const agentcashFetchSchema = z.object({
  url: z.string().url().describe("URL to fetch via x402 micropayment"),
  method: z.enum(["GET", "POST"]).default("GET").describe("HTTP method"),
});

export const setAgentNameSchema = z.object({
  name: z.string().describe("ENS name (e.g. 'orchestrator.agentledger.eth')"),
  key: z.string().describe("Text record key (e.g. 'description', 'agent.capabilities')"),
  value: z.string().describe("Text record value"),
});
