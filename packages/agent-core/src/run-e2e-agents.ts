import { config } from "dotenv";
config({ path: "../../.env" });

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { formatUnits, type Address } from "viem";
import { getPublicClient, getWalletClient } from "./blockchain/clients.js";
import { getAddresses } from "./blockchain/addresses.js";
import { getEnv } from "./config/env.js";
import * as escrow from "./tools/escrow.js";
import { orchestratorTools, buildOrchestratorPrompt } from "./agents/orchestrator.js";
import { workerTools, buildWorkerPrompt } from "./agents/worker.js";
import { sentinelTools, buildSentinelPrompt } from "./agents/sentinel.js";
import { AgentLogger } from "./logging/agent-logger.js";

const DEFAULT_TASK =
  "Research the top 5 DeFi protocols on Celo and write a 500-word analytical report";

async function runE2E(taskDescription?: string) {
  const task = taskDescription ?? DEFAULT_TASK;
  const logger = new AgentLogger("e2e-autonomous");
  const pub = getPublicClient();
  const chainId = await pub.getChainId();
  const addr = getAddresses(chainId);
  const env = getEnv();

  const orchestratorWallet = getWalletClient("orchestrator");
  const workerWallet = getWalletClient("worker");
  const sentinelWallet = getWalletClient("sentinel");

  const orchAddr = orchestratorWallet.account.address;
  const workerAddr = workerWallet.account.address;
  const sentinelAddr = sentinelWallet.account.address;

  console.log("=== AgentLedger Autonomous E2E Demo ===");
  console.log(`Chain: ${chainId}`);
  console.log(`Task: ${task}`);
  console.log(`Orchestrator: ${orchAddr}`);
  console.log(`Worker:       ${workerAddr}`);
  console.log(`Sentinel:     ${sentinelAddr}`);
  console.log(`Escrow:       ${addr.escrow}`);
  console.log(`Hook:         ${addr.hook}`);
  console.log();

  logger.decision("Starting E2E autonomous demo", task);

  // ── Phase 1: ORCHESTRATOR creates job ──
  console.log("━━━ Phase 1: Orchestrator Creates Job ━━━");
  const phase1Result = await generateText({
    model: google("gemini-2.0-flash"),
    system: buildOrchestratorPrompt(task),
    prompt: `Post a job on AgentLedger now.

Job description: "${task}"
Worker address: ${workerAddr}
Evaluator address: ${sentinelAddr}
Hook contract: ${addr.hook}
Deadline: 24 hours

Call create_job with these exact parameters. Do NOT set a budget — the worker will propose one.`,
    tools: { create_job: orchestratorTools.create_job },
    maxSteps: 3,
  });

  console.log(`  Agent: ${phase1Result.text.slice(0, 200)}`);

  // Read on-chain to get job ID
  const jobCount = (await pub.readContract({
    address: addr.escrow,
    abi: [{ type: "function", name: "jobCount", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" }],
    functionName: "jobCount",
  })) as bigint;
  const jobId = jobCount - 1n;
  const job = await escrow.getJob(jobId);

  console.log(`  ✓ Job #${jobId} created: "${job.description.slice(0, 60)}..."`);
  console.log(`  ✓ Status: ${escrow.statusLabel(job.status)}`);
  console.log();

  logger.toolCall("phase1_create_job", { task }, { jobId: jobId.toString() }, 0.01);

  // ── Phase 2: WORKER proposes budget ──
  console.log("━━━ Phase 2: Worker Proposes Budget ━━━");
  const phase2Result = await generateText({
    model: google("gemini-2.0-flash"),
    system: buildWorkerPrompt(),
    prompt: `Job #${jobId} has been created on AgentLedger:
- Description: "${job.description}"
- You are the assigned provider.

Propose a fair USDC budget for this work. Consider the complexity:
- Simple research tasks: 5-10 USDC
- Complex analysis: 10-25 USDC
- Large projects: 25-50 USDC

Call set_budget with the job ID ${jobId} and your proposed amount.`,
    tools: { set_budget: workerTools.set_budget, get_job: workerTools.get_job },
    maxSteps: 3,
  });

  console.log(`  Agent: ${phase2Result.text.slice(0, 200)}`);

  // Read on-chain to confirm budget
  const jobAfterBudget = await escrow.getJob(jobId);
  console.log(`  ✓ Budget set: ${formatUnits(jobAfterBudget.budget, 6)} USDC`);
  console.log();

  logger.toolCall("phase2_set_budget", { jobId: jobId.toString() }, { budget: jobAfterBudget.budget.toString() }, 0.01);

  // ── Phase 3: ORCHESTRATOR funds job ──
  console.log("━━━ Phase 3: Orchestrator Funds Job ━━━");
  const phase3Result = await generateText({
    model: google("gemini-2.0-flash"),
    system: buildOrchestratorPrompt(task),
    prompt: `Job #${jobId} now has a budget of ${formatUnits(jobAfterBudget.budget, 6)} USDC proposed by the worker.

Review and fund this job. Call fund_job with jobId ${jobId}.`,
    tools: { fund_job: orchestratorTools.fund_job, get_job: orchestratorTools.get_job },
    maxSteps: 3,
  });

  console.log(`  Agent: ${phase3Result.text.slice(0, 200)}`);

  const jobAfterFund = await escrow.getJob(jobId);
  console.log(`  ✓ Status: ${escrow.statusLabel(jobAfterFund.status)}`);
  console.log();

  logger.toolCall("phase3_fund_job", { jobId: jobId.toString() }, { status: escrow.statusLabel(jobAfterFund.status) }, 0.01);

  if (jobAfterFund.status !== 1) {
    console.error("  ✗ Job not funded! Expected status Funded (1), got:", jobAfterFund.status);
    logger.error(`Funding failed: status=${jobAfterFund.status}`);
    logger.save();
    process.exit(1);
  }

  // ── Phase 4: WORKER researches and submits ──
  console.log("━━━ Phase 4: Worker Researches & Submits ━━━");
  const phase4Result = await generateText({
    model: google("gemini-2.0-flash"),
    system: buildWorkerPrompt(),
    prompt: `Job #${jobId} is now Funded on AgentLedger.
Description: "${job.description}"

Your task:
1. Use web_search to find real, current data about the topic
2. Optionally use fetch_url to get details from relevant pages
3. Compose a comprehensive deliverable (at least 150 characters, no placeholders)
4. Call submit_work with the jobId ${jobId} and your completed deliverable

Important:
- The deliverable must be substantive and address the job description
- Include specific data points, names, and facts from your research
- Do NOT use placeholder text like [INSERT] or {TODO}`,
    tools: {
      web_search: workerTools.web_search,
      fetch_url: workerTools.fetch_url,
      enrich_company: workerTools.enrich_company,
      submit_work: workerTools.submit_work,
      get_job: workerTools.get_job,
    },
    maxSteps: 15,
  });

  console.log(`  Agent: ${phase4Result.text.slice(0, 300)}`);

  const jobAfterSubmit = await escrow.getJob(jobId);
  console.log(`  ✓ Status: ${escrow.statusLabel(jobAfterSubmit.status)}`);
  console.log();

  logger.toolCall(
    "phase4_research_submit",
    { jobId: jobId.toString() },
    { status: escrow.statusLabel(jobAfterSubmit.status), steps: phase4Result.steps.length },
    0.05,
  );

  if (jobAfterSubmit.status !== 2) {
    console.error("  ✗ Work not submitted! Expected status Submitted (2), got:", jobAfterSubmit.status);
    logger.error(`Submission failed: status=${jobAfterSubmit.status}`);
    logger.save();
    process.exit(1);
  }

  // ── Phase 5: SENTINEL evaluates & writes reputation ──
  console.log("━━━ Phase 5: Sentinel Evaluates & Writes Reputation ━━━");
  const phase5Result = await generateText({
    model: google("gemini-2.0-flash"),
    system: buildSentinelPrompt(),
    prompt: `Job #${jobId} has been submitted and awaits your evaluation.
Description: "${job.description}"
Provider: ${jobAfterSubmit.provider}
Budget: ${formatUnits(jobAfterSubmit.budget, 6)} USDC

Steps:
1. Call get_job to review the submission details
2. Evaluate whether the deliverable meets the job requirements
3. Call complete_job (if quality is acceptable) or reject_job (if not)
4. After settlement, call write_reputation with agentId 1 (the worker's ERC-8004 ID) and your assessment

Be fair but thorough in your evaluation.`,
    tools: {
      get_job: sentinelTools.get_job,
      browse_submitted: sentinelTools.browse_submitted,
      complete_job: sentinelTools.complete_job,
      reject_job: sentinelTools.reject_job,
      write_reputation: sentinelTools.write_reputation,
    },
    maxSteps: 8,
  });

  console.log(`  Agent: ${phase5Result.text.slice(0, 300)}`);

  // Final state
  const finalJob = await escrow.getJob(jobId);
  console.log();
  console.log("━━━ Final State ━━━");
  console.log(`  Job #${jobId}: ${escrow.statusLabel(finalJob.status)}`);
  console.log(`  Budget: ${formatUnits(finalJob.budget, 6)} USDC`);
  console.log(`  Client: ${finalJob.client}`);
  console.log(`  Provider: ${finalJob.provider}`);
  console.log(`  Evaluator: ${finalJob.evaluator}`);
  console.log();
  console.log("=== E2E Demo Complete ===");

  logger.setFinalOutput({
    jobId: jobId.toString(),
    finalStatus: escrow.statusLabel(finalJob.status),
    budget: formatUnits(finalJob.budget, 6),
    task,
    phases_completed: 5,
    summary: `Autonomous E2E: orchestrator posted job → worker researched & submitted → sentinel evaluated → ${escrow.statusLabel(finalJob.status)}`,
  });
  logger.save();
}

const taskArg = process.argv[2];
runE2E(taskArg).catch((err) => {
  console.error("E2E failed:", err);
  process.exit(1);
});
