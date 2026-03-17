import { config } from "dotenv";
config({ path: "../../.env" });

import { parseUnits, formatUnits, type Address, keccak256, toHex } from "viem";
import { getPublicClient, getWalletClient } from "./blockchain/clients.js";
import { getAddresses } from "./blockchain/addresses.js";
import { escrowAbi, erc20Abi } from "./blockchain/abis.js";
import { AgentLogger } from "./logging/agent-logger.js";

async function demo() {
  const logger = new AgentLogger("demo-e2e");
  const pub = getPublicClient();
  const chainId = await pub.getChainId();
  const addr = getAddresses(chainId);

  const orchestrator = getWalletClient("orchestrator");
  const worker = getWalletClient("worker");
  const sentinel = getWalletClient("sentinel");

  const orchAddr = orchestrator.account!.address;
  const workerAddr = worker.account!.address;
  const sentinelAddr = sentinel.account!.address;

  console.log("=== AgentLedger E2E Demo ===");
  console.log(`Chain: ${chainId}`);
  console.log(`Orchestrator: ${orchAddr}`);
  console.log(`Worker: ${workerAddr}`);
  console.log(`Sentinel: ${sentinelAddr}`);
  console.log(`Escrow: ${addr.escrow}`);
  console.log();

  // Step 1: Create job
  console.log("1. Orchestrator creates job...");
  logger.decision("Creating new job", "Demo: orchestrator posts a research job");

  const expiredAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const createTx = await orchestrator.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "createJob",
    args: [workerAddr, sentinelAddr, expiredAt, "Research the top 5 DeFi protocols on Celo and produce a 500-word report", addr.hook],
  });
  const createReceipt = await pub.waitForTransactionReceipt({ hash: createTx });
  console.log(`   TX: ${createTx}`);
  logger.toolCall("createJob", { provider: workerAddr, evaluator: sentinelAddr }, { tx: createTx }, 0.0005);

  // Get job ID from events
  const jobId = 0n; // First job
  console.log(`   Job ID: ${jobId}`);
  console.log();

  // Step 2: Worker proposes budget
  console.log("2. Worker proposes budget (10 USDC)...");
  const budget = parseUnits("10", 6);
  const budgetTx = await worker.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "setBudget",
    args: [jobId, budget, "0x"],
  });
  await pub.waitForTransactionReceipt({ hash: budgetTx });
  console.log(`   TX: ${budgetTx}`);
  logger.toolCall("setBudget", { jobId: "0", amount: "10 USDC" }, { tx: budgetTx }, 0.0005);
  console.log();

  // Step 3: Orchestrator approves and funds
  console.log("3. Orchestrator approves USDC and funds job...");
  const approveTx = await orchestrator.writeContract({
    address: addr.paymentToken,
    abi: erc20Abi,
    functionName: "approve",
    args: [addr.escrow, budget],
  });
  await pub.waitForTransactionReceipt({ hash: approveTx });

  const fundTx = await orchestrator.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "fund",
    args: [jobId, "0x"],
  });
  await pub.waitForTransactionReceipt({ hash: fundTx });
  console.log(`   Approve TX: ${approveTx}`);
  console.log(`   Fund TX: ${fundTx}`);
  logger.toolCall("fund", { jobId: "0" }, { tx: fundTx }, 0.0005);
  console.log();

  // Step 4: Worker submits deliverable
  console.log("4. Worker executes and submits deliverable...");
  const deliverable = "Top 5 DeFi Protocols on Celo: 1. Ubeswap - Leading DEX with $50M TVL, native governance token UBE. 2. Moola Market - Lending/borrowing protocol forked from Aave, supports cUSD/CELO. 3. Mento - Stability protocol backing cUSD stablecoin with reserve assets. 4. Curve on Celo - StableSwap pools for efficient stablecoin trading. 5. Symmetric - Balancer fork enabling weighted liquidity pools. Each protocol leverages Celo's sub-cent transaction fees and mobile-first design philosophy.";
  const deliverableHash = keccak256(toHex(deliverable));
  const submitTx = await worker.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "submit",
    args: [jobId, deliverableHash, "0x"],
  });
  await pub.waitForTransactionReceipt({ hash: submitTx });
  console.log(`   TX: ${submitTx}`);
  console.log(`   Deliverable hash: ${deliverableHash}`);
  logger.toolCall("submit", { jobId: "0", hash: deliverableHash }, { tx: submitTx }, 0.0005);
  console.log();

  // Step 5: Sentinel evaluates
  console.log("5. Sentinel evaluates and completes job...");
  const reason = keccak256(toHex("Deliverable meets requirements: comprehensive coverage of 5 protocols with TVL data"));
  const completeTx = await sentinel.writeContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "complete",
    args: [jobId, reason, "0x"],
  });
  const completeReceipt = await pub.waitForTransactionReceipt({ hash: completeTx });
  console.log(`   TX: ${completeTx}`);
  logger.toolCall("complete", { jobId: "0", reason: "approved" }, { tx: completeTx }, 0.0005);
  console.log();

  // Step 6: Check final state
  console.log("6. Final state:");
  const finalJob = await pub.readContract({
    address: addr.escrow,
    abi: escrowAbi,
    functionName: "getJob",
    args: [jobId],
  }) as any;

  const statusLabels = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];
  console.log(`   Job status: ${statusLabels[Number(finalJob.status)]}`);
  console.log(`   Budget: ${formatUnits(finalJob.budget, 6)} USDC`);
  console.log();
  console.log("=== Demo Complete ===");

  logger.setFinalOutput({
    jobs_created: 1,
    jobs_completed: 1,
    total_spent_usdc: "10.00",
    summary: "E2E demo: orchestrator posted job, worker submitted, sentinel approved, payment settled",
  });
  logger.save();
}

demo().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
