import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseUnits, formatUnits, type Address } from "viem";
import * as schemas from "./schemas.js";
import * as escrowTools from "../tools/escrow.js";
import * as registryTools from "../tools/registry.js";
import * as balanceTools from "../tools/balance.js";
import * as ensTools from "../tools/ens.js";

const server = new McpServer({
  name: "agentledger",
  version: "0.1.0",
});

// ─── Job Lifecycle Tools ────────────────────────────────────────────────

server.tool("create_job", schemas.createJobSchema.shape, async (params) => {
  const { jobId, txHash } = await escrowTools.createJob({
    provider: params.provider as Address,
    evaluator: params.evaluator as Address,
    expiredAt: BigInt(params.expiredAt),
    description: params.description,
    hook: params.hook as Address,
  });
  return {
    content: [{ type: "text", text: JSON.stringify({ jobId: jobId.toString(), txHash }) }],
  };
});

server.tool("set_provider", schemas.setProviderSchema.shape, async (params) => {
  const txHash = await escrowTools.setProvider(BigInt(params.jobId), params.provider as Address);
  return {
    content: [{ type: "text", text: JSON.stringify({ txHash }) }],
  };
});

server.tool("set_budget", schemas.setBudgetSchema.shape, async (params) => {
  const amount = parseUnits(params.amount, 6); // USDC 6 decimals
  const txHash = await escrowTools.setBudget(BigInt(params.jobId), amount);
  return {
    content: [{ type: "text", text: JSON.stringify({ txHash, amount: amount.toString() }) }],
  };
});

server.tool("fund_job", schemas.fundJobSchema.shape, async (params) => {
  const txHash = await escrowTools.fundJob(BigInt(params.jobId));
  return {
    content: [{ type: "text", text: JSON.stringify({ txHash }) }],
  };
});

server.tool("submit_work", schemas.submitWorkSchema.shape, async (params) => {
  const txHash = await escrowTools.submitWork(BigInt(params.jobId), params.deliverable);
  return {
    content: [{ type: "text", text: JSON.stringify({ txHash }) }],
  };
});

server.tool("evaluate_work", schemas.evaluateWorkSchema.shape, async (params) => {
  const txHash = params.approve
    ? await escrowTools.completeJob(BigInt(params.jobId), params.reason)
    : await escrowTools.rejectJob(BigInt(params.jobId), params.reason);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          txHash,
          action: params.approve ? "completed" : "rejected",
        }),
      },
    ],
  };
});

server.tool("browse_jobs", schemas.browseJobsSchema.shape, async (params) => {
  const jobs = await escrowTools.browseJobs();
  const statusFilter: Record<string, number[]> = {
    all: [0, 1, 2, 3, 4, 5],
    open: [0],
    funded: [1],
    submitted: [2],
  };
  const allowed = statusFilter[params.status];
  const filtered = jobs.filter((j) => allowed.includes(j.status));

  const formatted = filtered.map((j) => ({
    id: j.id.toString(),
    client: j.client,
    provider: j.provider,
    evaluator: j.evaluator,
    description: j.description,
    budget: formatUnits(j.budget, 6) + " USDC",
    status: escrowTools.statusLabel(j.status),
    expiredAt: new Date(Number(j.expiredAt) * 1000).toISOString(),
  }));

  return {
    content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
  };
});

server.tool("get_job", schemas.getJobSchema.shape, async (params) => {
  const job = await escrowTools.getJob(BigInt(params.jobId));
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          ...job,
          id: job.id.toString(),
          budget: formatUnits(job.budget, 6) + " USDC",
          status: escrowTools.statusLabel(job.status),
          expiredAt: new Date(Number(job.expiredAt) * 1000).toISOString(),
        }),
      },
    ],
  };
});

// ─── Identity & Reputation Tools ────────────────────────────────────────

server.tool("register_agent", schemas.registerAgentSchema.shape, async (params) => {
  const metadata = [
    { key: "role", value: params.role },
    { key: "capabilities", value: params.capabilities },
  ];
  const { agentId, txHash } = await registryTools.registerAgent(
    params.role,
    params.agentURI,
    metadata
  );
  return {
    content: [{ type: "text", text: JSON.stringify({ agentId: agentId.toString(), txHash }) }],
  };
});

server.tool("get_reputation", schemas.getReputationSchema.shape, async (params) => {
  const rep = await registryTools.getReputation(BigInt(params.agentId));
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          totalFeedbacks: rep.totalFeedbacks.toString(),
          averageValue: rep.averageValue.toString(),
          averageValueDecimals: rep.averageValueDecimals,
        }),
      },
    ],
  };
});

// ─── Balance & ENS Tools ────────────────────────────────────────────────

server.tool("check_balance", schemas.checkBalanceSchema.shape, async (params) => {
  const info = await balanceTools.checkBalance(params.address as Address);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          address: info.address,
          balance: info.formatted + " " + info.symbol,
          raw: info.balance.toString(),
        }),
      },
    ],
  };
});

server.tool("resolve_name", schemas.resolveNameSchema.shape, async (params) => {
  const address = await ensTools.resolveAddress(params.name);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ name: params.name, address: address ?? "not found" }),
      },
    ],
  };
});

// ─── Resources ──────────────────────────────────────────────────────────

server.resource(
  "jobs",
  "celo://agentledger/jobs",
  async () => {
    const jobs = await escrowTools.browseJobs();
    return {
      contents: [
        {
          uri: "celo://agentledger/jobs",
          mimeType: "application/json",
          text: JSON.stringify(jobs.map((j) => ({
            id: j.id.toString(),
            status: escrowTools.statusLabel(j.status),
            description: j.description,
            budget: formatUnits(j.budget, 6) + " USDC",
          }))),
        },
      ],
    };
  }
);

// ─── Start Server ───────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`MCP server error: ${err}\n`);
  process.exit(1);
});
