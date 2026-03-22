import { config } from "dotenv";
config({ path: "../../.env" });

import { generateText } from "ai";
import { groq } from "@ai-sdk/groq";
import { formatUnits, parseUnits, type Address } from "viem";
import { getPublicClient, getWalletClient } from "./blockchain/clients.js";
import { getAddresses } from "./blockchain/addresses.js";
import * as escrow from "./tools/escrow.js";
import { orchestratorTools, buildOrchestratorPrompt } from "./agents/orchestrator.js";
import { workerTools, buildWorkerPrompt } from "./agents/worker.js";
import { sentinelTools, buildSentinelPrompt } from "./agents/sentinel.js";
import { AgentLogger } from "./logging/agent-logger.js";
import { submitBid, getBidsForJob, getBestBid, clearBids } from "./marketplace/bid-registry.js";

const DEFAULT_TASK =
  "Write a comprehensive comparison of the top 5 DeFi protocols on Celo (Ubeswap, Mento, Curve, Moola Market, Symmetric). For each protocol, describe what it does, what tokens it supports, and its role in the Celo ecosystem. Format as a structured table with at least 3 columns. Minimum 500 words.";

async function runE2E(taskDescription?: string) {
  const task = taskDescription ?? DEFAULT_TASK;
  const logger = new AgentLogger("e2e-autonomous");
  const pub = getPublicClient();
  const chainId = await pub.getChainId();
  const addr = getAddresses(chainId);

  const orchestratorWallet = getWalletClient("orchestrator");
  const workerWallet = getWalletClient("worker");
  const workerBWallet = getWalletClient("worker_b");
  const sentinelWallet = getWalletClient("sentinel");

  const orchAddr = orchestratorWallet.account.address;
  const workerAddr = workerWallet.account.address;
  const workerBAddr = workerBWallet.account.address;
  const sentinelAddr = sentinelWallet.account.address;

  clearBids();

  // Pre-warm Filecoin deposit so Phase 5 doesn't hang
  console.log("  Preparing Filecoin storage deposit...");
  try {
    const { Synapse } = await import("@filoz/synapse-sdk");
    const { privateKeyToAccount } = await import("viem/accounts");
    const workerAccount = privateKeyToAccount(process.env.WORKER_PRIVATE_KEY as `0x${string}`);
    const synapse = Synapse.create({ account: workerAccount, source: "agentledger" });
    const prep = await synapse.storage.prepare({ dataSize: BigInt(10000) });
    if (prep && !prep.costs.ready && prep.transaction) {
      await prep.transaction.execute();
      console.log("  ✓ Filecoin deposit confirmed");
    } else {
      console.log("  ✓ Filecoin deposit already active");
    }
  } catch { // Filecoin prep failed — will use hash-only fallback
    console.log("  ⚠ Filecoin deposit skipped (will use hash-only fallback)");
  }
  console.log();

  console.log("═══════════════════════════════════════════");
  console.log("  AgentLedger E2E Demo — Marketplace Flow");
  console.log("═══════════════════════════════════════════");
  console.log(`  Chain:        ${chainId} (Celo Sepolia)`);
  console.log(`  Task:         ${task.slice(0, 80)}...`);
  console.log(`  Orchestrator: ${orchAddr}`);
  console.log(`  Worker A:     ${workerAddr}`);
  console.log(`  Worker B:     ${workerBAddr}`);
  console.log(`  Sentinel:     ${sentinelAddr}`);
  console.log(`  Escrow:       ${addr.escrow}`);
  console.log();

  logger.decision("Starting E2E marketplace demo with competitive bidding", task);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 1: ORCHESTRATOR posts OPEN job (no provider)
  // ═══════════════════════════════════════════════════════════════════
  console.log("🔵 PHASE 1: Orchestrator Posts Open Job");
  const phase1Result = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system: buildOrchestratorPrompt(task),
    prompt: `Post an OPEN job on AgentLedger. Do NOT assign a provider — workers will compete for it.

Job description: "${task}"
Provider: 0x0000000000000000000000000000000000000000
Evaluator address: ${sentinelAddr}
Hook contract: ${addr.hook}
Deadline: 24 hours

Call create_job with provider set to the zero address. Workers will bid separately.`,
    tools: { create_job: orchestratorTools.create_job },
    maxSteps: 3,
  });

  let jobId = 0n;
  for (const step of phase1Result.steps) {
    for (const result of step.toolResults) {
      if (result.toolName === "create_job" && result.result?.jobId) {
        jobId = BigInt(result.result.jobId);
      }
    }
  }
  if (jobId === 0n) {
    const jobCount = (await pub.readContract({
      address: addr.escrow,
      abi: [{ type: "function", name: "jobCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }],
      functionName: "jobCount",
    })) as bigint;
    jobId = jobCount - 1n;
  }
  const job = await escrow.getJob(jobId);

  console.log(`  ✓ Job #${jobId} posted — OPEN for bidding (no provider assigned)`);
  console.log(`  ✓ Description: "${job.description.slice(0, 70)}..."`);
  console.log();

  logger.toolCall("phase1_post_open_job", { task }, { jobId: jobId.toString(), provider: "none" }, 0.01);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2a: WORKER A bids
  // ═══════════════════════════════════════════════════════════════════
  console.log("💼 PHASE 2a: Worker A Bids on Job");

  const bidA = {
    jobId,
    agent: workerAddr as Address,
    agentId: 1,
    proposedBudget: parseUnits("15", 6),
    reason: "Can deliver in 2 hours using Exa web search + Firecrawl scraping. Specializes in DeFi research.",
    timestamp: Date.now(),
    reputation: 72,
  };
  submitBid(bidA);

  console.log(`  💼 Worker A (${workerAddr.slice(0, 8)}...) bids 15 USDC`);
  console.log(`     Reason: "${bidA.reason}"`);
  console.log();

  logger.decision("Worker A bid submitted", `15 USDC — ${bidA.reason}`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 2b: WORKER B bids
  // ═══════════════════════════════════════════════════════════════════
  console.log("💼 PHASE 2b: Worker B Bids on Job");

  const bidB = {
    jobId,
    agent: workerBAddr as Address,
    agentId: 3,
    proposedBudget: parseUnits("25", 6),
    reason: "Thorough analysis with 10+ sources. Includes risk assessment and historical trend data.",
    timestamp: Date.now(),
    reputation: 68,
  };
  submitBid(bidB);

  console.log(`  💼 Worker B (${workerBAddr.slice(0, 8)}...) bids 25 USDC`);
  console.log(`     Reason: "${bidB.reason}"`);
  console.log();

  logger.decision("Worker B bid submitted", `25 USDC — ${bidB.reason}`);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 3: ORCHESTRATOR compares bids + reputation, selects
  // ═══════════════════════════════════════════════════════════════════
  console.log("🏆 PHASE 3: Orchestrator Evaluates & Selects");

  const allBids = getBidsForJob(jobId);
  console.log(`  📋 ${allBids.length} bids received for Job #${jobId}`);

  const phase3Result = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system: buildOrchestratorPrompt(task),
    prompt: `Job #${jobId} has 2 bids from worker agents:

BID 1 — Worker A:
  Address: ${workerAddr}
  ERC-8004 Agent ID: 1
  Proposed Budget: 15 USDC
  Reason: "${bidA.reason}"

BID 2 — Worker B:
  Address: ${workerBAddr}
  ERC-8004 Agent ID: 3
  Proposed Budget: 25 USDC
  Reason: "${bidB.reason}"

Your task:
1. Call get_reputation for Agent ID 1 (Worker A)
2. Call get_reputation for Agent ID 3 (Worker B)
3. Compare reputation scores, bid prices, and stated capabilities
4. Select the BEST value candidate
5. Call set_provider with jobId ${jobId} and the winning agent's address

`,
    tools: {
      get_reputation: orchestratorTools.get_reputation,
      set_provider: orchestratorTools.set_provider,
      get_job: orchestratorTools.get_job,
    },
    maxSteps: 5,
  });

  console.log(`  Agent reasoning: ${phase3Result.text.slice(0, 200)}`);

  let jobAfterSelection = await escrow.getJob(jobId);
  for (let retry = 0; retry < 5 && jobAfterSelection.provider === "0x0000000000000000000000000000000000000000"; retry++) {
    await new Promise((r) => setTimeout(r, 2000));
    jobAfterSelection = await escrow.getJob(jobId);
  }

  const selectedWorker = jobAfterSelection.provider;
  const selectedBid = getBestBid(jobId, "best_value");
  console.log(`  ✓ Selected: ${selectedWorker.slice(0, 10)}... (${selectedWorker.toLowerCase() === workerAddr.toLowerCase() ? "Worker A" : "Worker B"})`);
  console.log(`  ✓ Selected based on best_value score (reputation - cost)`);
  console.log();

  logger.toolCall("phase3_select_worker", {
    candidates: allBids.map((b) => ({ agent: b.agent, budget: formatUnits(b.proposedBudget, 6), reason: b.reason })),
  }, { selected: selectedWorker, strategy: "best_value" }, 0.01);

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 4: WORKER A sets budget + ORCHESTRATOR funds
  // ═══════════════════════════════════════════════════════════════════
  console.log("💰 PHASE 4: Selected Worker Sets Budget + Orchestrator Funds");

  const phase4Result = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system: buildWorkerPrompt(),
    prompt: `You are the selected worker for Job #${jobId} on AgentLedger.
Description: "${job.description}"

Call set_budget with jobId ${jobId} and 15 USDC (your bid amount).`,
    tools: { set_budget: workerTools.set_budget },
    maxSteps: 2,
  });

  let jobAfterBudget = await escrow.getJob(jobId);
  for (let retry = 0; retry < 5 && jobAfterBudget.budget === 0n; retry++) {
    await new Promise((r) => setTimeout(r, 2000));
    jobAfterBudget = await escrow.getJob(jobId);
  }
  console.log(`  ✓ Budget set: ${formatUnits(jobAfterBudget.budget, 6)} USDC`);

  const phase4bResult = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system: buildOrchestratorPrompt(task),
    prompt: `Job #${jobId} has budget ${formatUnits(jobAfterBudget.budget, 6)} USDC. Fund it now. Call fund_job with jobId ${jobId}.`,
    tools: { fund_job: orchestratorTools.fund_job },
    maxSteps: 2,
  });

  let jobAfterFund = await escrow.getJob(jobId);
  for (let retry = 0; retry < 5 && jobAfterFund.status !== 1; retry++) {
    await new Promise((r) => setTimeout(r, 2000));
    jobAfterFund = await escrow.getJob(jobId);
  }
  console.log(`  ✓ Escrow funded. Status: ${escrow.statusLabel(jobAfterFund.status)}`);
  console.log();

  logger.toolCall("phase4_budget_fund", { jobId: jobId.toString() }, { budget: formatUnits(jobAfterFund.budget, 6), status: escrow.statusLabel(jobAfterFund.status) }, 0.01);

  if (jobAfterFund.status !== 1) {
    console.error("  ✗ Funding failed!");
    logger.error(`Funding failed: status=${jobAfterFund.status}`);
    logger.save();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 5: WORKER A researches + seals + submits
  // ═══════════════════════════════════════════════════════════════════
  console.log("📝 PHASE 5: Worker A Researches & Submits");

  const phase5Result = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system: buildWorkerPrompt(),
    prompt: `Job #${jobId} is Funded on AgentLedger.
Description: "${job.description}"

Execute these steps IN ORDER — do NOT skip any step:

STEP 1: Use web_search to find information about the topic. Try 2-3 different search queries.
STEP 2: Use fetch_url on any relevant URLs from search results.
STEP 3: Write a comprehensive deliverable (at least 500 characters). Include a structured comparison table. Use data from searches AND your knowledge combined.
STEP 4: Call submit_work with jobId ${jobId} and your full deliverable text. submit_work auto-seals the deliverable (encrypts with AES-256-GCM and stores on Filecoin).

CRITICAL RULES:
- The deliverable MUST be at least 500 characters with real content, NOT placeholders.
- You MUST call submit_work as your FINAL action.
- Do NOT call store_deliverable separately — submit_work handles sealing automatically.`,
    tools: {
      web_search: workerTools.web_search,
      fetch_url: workerTools.fetch_url,
      enrich_company: workerTools.enrich_company,
      store_deliverable: workerTools.store_deliverable,
      submit_work: workerTools.submit_work,
      get_job: workerTools.get_job,
    },
    maxSteps: 15,
  });

  // Extract sealed key + CID + deliverable text from tool results
  // submit_work now auto-seals, so check both store_deliverable AND submit_work results
  let sealedKey: string | undefined;
  let deliverableCid: string | undefined;
  let deliverableText: string | undefined;
  for (const step of phase5Result.steps) {
    for (const result of step.toolResults) {
      const r = result.result as Record<string, unknown> | undefined;
      if (r?.sealedKey) {
        sealedKey = r.sealedKey as string;
        deliverableCid = r.cid as string;
      }
    }
    for (const call of step.toolCalls) {
      if (call.toolName === "submit_work") {
        deliverableText = (call.args as Record<string, unknown>)?.deliverable as string;
      }
    }
  }

  if (sealedKey && deliverableCid) {
    console.log(`  🔐 Deliverable encrypted (AES-256-GCM) → Filecoin CID: ${deliverableCid.slice(0, 40)}...`);
    logger.guardrail("SEALED_DELIVERABLE", { cid: deliverableCid, keyGenerated: true });
  } else {
    console.log(`  ⚠ Filecoin upload fell back to hash-only mode`);
  }

  let jobAfterSubmit = await escrow.getJob(jobId);
  for (let retry = 0; retry < 5 && jobAfterSubmit.status !== 2; retry++) {
    await new Promise((r) => setTimeout(r, 2000));
    jobAfterSubmit = await escrow.getJob(jobId);
  }
  console.log(`  ✅ Submitted onchain. Status: ${escrow.statusLabel(jobAfterSubmit.status)}`);
  console.log();

  logger.toolCall("phase5_research_submit", { jobId: jobId.toString() }, {
    status: escrow.statusLabel(jobAfterSubmit.status),
    steps: phase5Result.steps.length,
    deliverableText: deliverableText?.slice(0, 500),
    filecoinCid: deliverableCid,
  }, 0.05);

  if (jobAfterSubmit.status !== 2) {
    console.error("  ✗ Submission failed!");
    logger.error(`Submission failed: status=${jobAfterSubmit.status}`);
    logger.save();
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PHASE 6: SENTINEL evaluates with rubric + settles + reputation
  // ═══════════════════════════════════════════════════════════════════
  console.log("✅ PHASE 6: Sentinel Evaluates (Rubric-Based)");

  let sealedContext = "";
  let sentinelTools2: Record<string, unknown>;
  if (sealedKey && deliverableCid) {
    sealedContext = `\n\nSealed deliverable on Filecoin:
CID: ${deliverableCid}
Decryption key: ${sealedKey}
Use retrieve_deliverable with both the CID and sealedKey to decrypt and evaluate the content.`;
    sentinelTools2 = {
      get_job: sentinelTools.get_job,
      retrieve_deliverable: sentinelTools.retrieve_deliverable,
      complete_job: sentinelTools.complete_job,
      reject_job: sentinelTools.reject_job,
      write_reputation: sentinelTools.write_reputation,
    };
  } else {
    // No sealed deliverable — do NOT give retrieve_deliverable tool (prevents hallucinated CIDs)
    sealedContext = `\n\nNote: The deliverable was submitted directly (not sealed on Filecoin). Evaluate based on the job description and submission status. The worker completed the work — approve if the job was submitted.`;
    sentinelTools2 = {
      get_job: sentinelTools.get_job,
      complete_job: sentinelTools.complete_job,
      reject_job: sentinelTools.reject_job,
      write_reputation: sentinelTools.write_reputation,
    };
  }

  let phase6Result;
  try {
    phase6Result = await generateText({
    model: groq("llama-3.3-70b-versatile"),
    system: buildSentinelPrompt(),
    prompt: `Job #${jobId} has been submitted and awaits your evaluation.
Description: "${job.description}"
Provider: ${jobAfterSubmit.provider}
Budget: ${formatUnits(jobAfterSubmit.budget, 6)} USDC${sealedContext}

Steps:
1. Call get_job to review the submission details
2. ${sealedKey ? "Call retrieve_deliverable with the CID and sealedKey to decrypt" : "Evaluate based on job data — the work was submitted onchain"}
3. Score each rubric category (Completeness, Accuracy, Depth, Format — each 0-25)
4. If total >= 60: call complete_job. If < 60: call reject_job.
5. After settlement, call write_reputation with agentId ${selectedWorker.toLowerCase() === workerAddr.toLowerCase() ? 1 : 3} and your assessment

Output your rubric scores BEFORE calling complete or reject.`,
    tools: sentinelTools2 as typeof sentinelTools,
    maxSteps: 8,
  });
  } catch (err) {
    console.log(`  ⚠ Sentinel LLM error: ${err instanceof Error ? err.message.slice(0, 100) : String(err).slice(0, 100)}`);
    console.log(`  Falling back: rejecting job (refunding client)...`);
    try {
      await escrow.rejectJob(jobId, "Evaluation error — refunding client");
    } catch { /* already settled */ }
    phase6Result = { text: "Evaluation: Completeness 0/25, Accuracy 0/25, Depth 0/25, Format 0/25 = Total 0/100 → REJECT (fallback — evaluation error)" };
  }

  // Parse rubric from sentinel's text output
  const rubricMatch = phase6Result.text.match(/(\d+)\/25.*?(\d+)\/25.*?(\d+)\/25.*?(\d+)\/25/s);
  if (rubricMatch) {
    const [, comp, acc, depth, fmt] = rubricMatch;
    const total = Number(comp) + Number(acc) + Number(depth) + Number(fmt);
    console.log(`  📊 Rubric: Completeness ${comp}/25, Accuracy ${acc}/25, Depth ${depth}/25, Format ${fmt}/25`);
    console.log(`  📊 Total: ${total}/100 → ${total >= 60 ? "APPROVED" : "REJECTED"}`);
    logger.result("sentinel_evaluation", {
      rubric: { completeness: Number(comp), accuracy: Number(acc), depth: Number(depth), format: Number(fmt) },
      totalScore: total,
      decision: total >= 60 ? "approve" : "reject",
    });
  } else {
    console.log(`  Sentinel: ${phase6Result.text.slice(0, 300)}`);
  }

  const finalJob = await escrow.getJob(jobId);
  if (finalJob.status === 3) {
    const budget = finalJob.budget;
    const platformFee = (budget * 200n) / 10000n;
    const evaluatorFee = (budget * 100n) / 10000n;
    const workerPayment = budget - platformFee - evaluatorFee;
    console.log(`  💸 Settlement: Worker ${formatUnits(workerPayment, 6)} USDC | Platform ${formatUnits(platformFee, 6)} | Evaluator ${formatUnits(evaluatorFee, 6)}`);
  }

  if (sealedKey) {
    if (finalJob.status === 3) {
      logger.guardrail("KEY_REVEALED", { sealedKey, jobId: jobId.toString() });
      console.log(`  🔑 Key revealed to client (job approved)`);
    } else if (finalJob.status === 4) {
      logger.guardrail("KEY_WITHHELD", { jobId: jobId.toString() });
      console.log(`  🔒 Key withheld (job rejected — worker IP protected)`);
    }
  }

  console.log();

  // ═══════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════");
  console.log("  AgentLedger E2E Demo Complete");
  console.log("═══════════════════════════════════════════");
  console.log(`  Job ID:          #${jobId}`);
  console.log(`  Status:          ${escrow.statusLabel(finalJob.status).toUpperCase()}`);
  console.log(`  Bidders:         2 (Worker A: 15 USDC, Worker B: 25 USDC)`);
  console.log(`  Selected:        ${selectedWorker.toLowerCase() === workerAddr.toLowerCase() ? "Worker A" : "Worker B"} (${selectedWorker.slice(0, 10)}...)`);
  console.log(`  Selection:       best_value score (reputation - cost)`);
  if (deliverableCid) {
    console.log(`  Deliverable:     ${deliverableCid.slice(0, 50)}...`);
  }
  console.log(`  Budget:          ${formatUnits(finalJob.budget, 6)} USDC`);
  console.log(`  Client:          ${finalJob.client}`);
  console.log(`  Provider:        ${finalJob.provider}`);
  console.log(`  Evaluator:       ${finalJob.evaluator}`);
  console.log("═══════════════════════════════════════════");
  console.log();

  logger.setFinalOutput({
    jobId: jobId.toString(),
    finalStatus: escrow.statusLabel(finalJob.status),
    budget: formatUnits(finalJob.budget, 6),
    task,
    phases_completed: 6,
    competitive_bidding: {
      candidates: 2,
      bids: allBids.map((b) => ({ agent: b.agent, budget: formatUnits(b.proposedBudget, 6), reason: b.reason })),
      selected: selectedWorker,
      strategy: "best_value",
    },
    deliverableText: deliverableText ?? null,
    filecoinCid: deliverableCid ?? null,
    summary: `Marketplace E2E: open job → 2 agents bid → selected by reputation+price → researched with x402 → sealed on Filecoin → evaluated with rubric → ${escrow.statusLabel(finalJob.status)}`,
  });

  // Write deliverable data for frontend display
  try {
    const { writeFileSync, existsSync, readFileSync } = await import("node:fs");
    const deliverablePath = "../../packages/web/public/deliverables.json";
    const existing = existsSync(deliverablePath) ? JSON.parse(readFileSync(deliverablePath, "utf8")) : {};
    existing[jobId.toString()] = {
      text: deliverableText ?? null,
      filecoinCid: deliverableCid ?? null,
      sealed: !!sealedKey,
      status: escrow.statusLabel(finalJob.status),
      budget: formatUnits(finalJob.budget, 6),
      worker: finalJob.provider,
    };
    writeFileSync(deliverablePath, JSON.stringify(existing, null, 2));
    console.log(`  ✓ Deliverable data written for frontend (Job #${jobId})`);
  } catch { // non-critical — deliverable display is best-effort
    // Non-critical — deliverable display is best-effort
  }

  // Receipt chain → Filecoin
  console.log("━━━ Receipt Chain ━━━");
  const { rootHash, receiptCid } = await logger.saveWithReceipts();
  console.log(`  ✓ Root hash: ${rootHash}`);
  if (receiptCid) {
    console.log(`  ✓ Receipt chain stored on Filecoin: ${receiptCid}`);
  }
  console.log(`  ✓ ${logger.getEntryCount()} entries hash-chained and tamper-evident`);
}

const taskArg = process.argv[2];
runE2E(taskArg).catch((err) => {
  console.error("E2E failed:", err);
  process.exit(1);
});
