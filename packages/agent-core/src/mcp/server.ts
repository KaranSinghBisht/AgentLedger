import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parseUnits, formatUnits, keccak256, toHex, type Address } from "viem";
import * as schemas from "./schemas.js";
import * as escrowTools from "../tools/escrow.js";
import * as registryTools from "../tools/registry.js";
import * as balanceTools from "../tools/balance.js";
import * as ensTools from "../tools/ens.js";
import { safePaidFetch } from "../x402/client.js";
import { uploadToFilecoin, downloadFromFilecoin } from "../tools/filecoin.js";
import { generateSealedKey, sealContent, unsealContent } from "../crypto/sealed.js";

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
  const statusFilter: Record<string, number[]> = {
    all: [0, 1, 2, 3, 4, 5],
    open: [0],
    funded: [1],
    submitted: [2],
  };
  const allowed = statusFilter[params.status];
  const jobs = await escrowTools.browseJobs(allowed);

  const formatted = jobs.map((j) => ({
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

server.tool("claim_refund", schemas.claimRefundSchema.shape, async (params) => {
  try {
    const txHash = await escrowTools.claimRefund(BigInt(params.jobId));
    return {
      content: [{ type: "text", text: JSON.stringify({ txHash, jobId: params.jobId }) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: msg, jobId: params.jobId }) }],
    };
  }
});

// ─── Marketplace Bidding Tools ────────────────────────────────────────────

server.tool("submit_bid", schemas.submitBidSchema.shape, async (params) => {
  const { submitBid } = await import("../marketplace/bid-registry.js");
  submitBid({
    jobId: BigInt(params.jobId),
    agent: params.agentAddress as Address,
    agentId: params.agentId,
    proposedBudget: parseUnits(params.proposedBudget, 6),
    reason: params.reason,
    timestamp: Date.now(),
  });
  return { content: [{ type: "text", text: JSON.stringify({ status: "bid_submitted", jobId: params.jobId, agent: params.agentAddress }) }] };
});

server.tool("get_bids", schemas.getBidsSchema.shape, async (params) => {
  const { getBidsForJob } = await import("../marketplace/bid-registry.js");
  const bids = getBidsForJob(BigInt(params.jobId));
  return {
    content: [{ type: "text", text: JSON.stringify(bids.map(b => ({
      agent: b.agent,
      agentId: b.agentId,
      proposedBudget: formatUnits(b.proposedBudget, 6) + " USDC",
      reason: b.reason,
    })), null, 2) }],
  };
});

server.tool("select_worker", schemas.selectWorkerSchema.shape, async (params) => {
  const { getBestBid } = await import("../marketplace/bid-registry.js");
  const best = getBestBid(BigInt(params.jobId), params.strategy);
  if (!best) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "No bids for this job" }) }] };
  }
  const txHash = await escrowTools.setProvider(BigInt(params.jobId), best.agent);
  return {
    content: [{ type: "text", text: JSON.stringify({ selected: best.agent, agentId: best.agentId, budget: formatUnits(best.proposedBudget, 6), txHash }) }],
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

server.tool("give_feedback", schemas.giveFeedbackSchema.shape, async (params) => {
  try {
    const txHash = await registryTools.giveFeedback({
      agentId: BigInt(params.agentId),
      value: BigInt(params.value),
      valueDecimals: 0,
      tag1: params.tag1,
      tag2: params.tag2,
      endpoint: "",
      feedbackURI: "",
      feedbackHash: keccak256(toHex(`feedback:${params.agentId}:${params.value}:${params.tag1}`)),
    });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ txHash, agentId: params.agentId, value: params.value }),
        },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: msg, agentId: params.agentId }) }],
    };
  }
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

server.tool("set_agent_name", schemas.setAgentNameSchema.shape, async (params) => {
  try {
    const { txHash, resolver } = await ensTools.setTextRecord(
      params.name,
      params.key,
      params.value
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ txHash, resolver, name: params.name, key: params.key }),
        },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: msg, name: params.name, key: params.key }),
        },
      ],
    };
  }
});

// ─── x402 / AgentCash Tools ────────────────────────────────────────────

server.tool("agentcash_fetch", schemas.agentcashFetchSchema.shape, async (params) => {
  try {
    const result = await safePaidFetch(params.url, { method: params.method });
    if (result.success) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ data: result.data, source: result.source }),
          },
        ],
      };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: result.error, source: result.source }),
        },
      ],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: msg, source: "error" }) }],
    };
  }
});

// ─── Filecoin Storage Tools ─────────────────────────────────────────────

server.tool("store_deliverable", schemas.storeDeliverableSchema.shape, async (params) => {
  try {
    const sealedKey = generateSealedKey();
    const encrypted = sealContent(params.content, sealedKey);
    const result = await uploadToFilecoin(encrypted);
    if (!result.stored) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ...result, sealed: false, sealFailed: "Filecoin upload fell back to hash-only mode" }) }],
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ ...result, sealedKey, sealed: true }) }],
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const result = await uploadToFilecoin(params.content);
    return {
      content: [{ type: "text", text: JSON.stringify({ ...result, sealed: false, sealFailed: reason }) }],
    };
  }
});

server.tool("retrieve_deliverable", schemas.retrieveDeliverableSchema.shape, async (params) => {
  try {
    let content = await downloadFromFilecoin(params.cid);
    if (params.sealedKey) {
      try {
        content = unsealContent(content, params.sealedKey);
      } catch (decryptErr) {
        const msg = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Decryption failed: ${msg}`, sealed: true }) }],
        };
      }
    }
    return {
      content: [{ type: "text", text: JSON.stringify({ content: content.slice(0, 8000), length: content.length, sealed: !!params.sealedKey }) }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: msg }) }],
    };
  }
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

server.resource(
  "agents",
  "celo://agentledger/agents",
  async () => {
    const agents: Array<Record<string, unknown>> = [];
    for (let id = 0; id < 10; id++) {
      try {
        const identity = await registryTools.getIdentity(BigInt(id));
        const rep = await registryTools.getReputation(BigInt(id));
        agents.push({
          id: id.toString(),
          owner: identity.owner,
          agentURI: identity.agentURI,
          metadata: identity.metadata,
          reputation: {
            totalFeedbacks: rep.totalFeedbacks.toString(),
            averageValue: rep.averageValue.toString(),
          },
        });
      } catch {
        // Agent ID does not exist or call failed, skip
      }
    }
    return {
      contents: [
        {
          uri: "celo://agentledger/agents",
          mimeType: "application/json",
          text: JSON.stringify(agents),
        },
      ],
    };
  }
);

server.resource(
  "agent",
  "celo://agentledger/agent/{id}",
  async (uri) => {
    const idStr = uri.pathname.split("/").pop() ?? "";
    const agentId = BigInt(idStr);
    try {
      const identity = await registryTools.getIdentity(agentId);
      const rep = await registryTools.getReputation(agentId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              id: idStr,
              owner: identity.owner,
              agentURI: identity.agentURI,
              metadata: identity.metadata,
              reputation: {
                totalFeedbacks: rep.totalFeedbacks.toString(),
                averageValue: rep.averageValue.toString(),
                averageValueDecimals: rep.averageValueDecimals,
              },
            }),
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: msg, id: idStr }),
          },
        ],
      };
    }
  }
);

server.resource(
  "job",
  "celo://agentledger/job/{id}",
  async (uri) => {
    const idStr = uri.pathname.split("/").pop() ?? "";
    const jobId = BigInt(idStr);
    try {
      const job = await escrowTools.getJob(jobId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({
              id: job.id.toString(),
              client: job.client,
              provider: job.provider,
              evaluator: job.evaluator,
              hook: job.hook,
              description: job.description,
              budget: formatUnits(job.budget, 6) + " USDC",
              status: escrowTools.statusLabel(job.status),
              expiredAt: new Date(Number(job.expiredAt) * 1000).toISOString(),
            }),
          },
        ],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: msg, id: idStr }),
          },
        ],
      };
    }
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
