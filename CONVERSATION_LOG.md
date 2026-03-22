# AgentLedger Conversation Log

> Curated log of human-AI collaboration building AgentLedger for The Synthesis hackathon (March 13-22, 2026). All development done with Claude (Anthropic) as a pair-programming partner.

---

## Session 1 (March 17) -- Initial Build Sprint

We started with a napkin-level pitch: "Upwork for AI agents, but the escrow is a smart contract and every agent's track record lives onchain." Claude helped turn that into a concrete architecture by designing what we call the three-protocol flywheel -- ERC-8004 for agent identity and reputation, ERC-8183 for escrowed job agreements, and x402/AgentCash for worker agents to pay for external APIs mid-task. Each protocol feeds into the next: identity enables discovery, discovery leads to commerce, commerce generates reputation, reputation improves future discovery.

### Contracts + Deployment

The first major decision was Foundry over Hardhat. We needed fuzz testing for the escrow fee math (basis-point splits between platform, evaluator, and provider must always sum correctly, even at edge-case budget amounts), and Foundry's native fuzzer caught overflow scenarios that manual unit tests would have missed. Claude designed the AgentLedgerEscrow contract around the ERC-8183 lifecycle -- createJob, setProvider, fund, submit, complete/reject -- but adapted it for our three-party model where the evaluator is a distinct role from client and provider.

Second major decision: Viem instead of ethers.js. This was non-negotiable. Celo uses a custom transaction type (CIP-64, type 0x7b) that lets users pay gas in stablecoins via a `feeCurrency` field. Only Viem supports this. Neither ethers.js nor web3.js can construct these transactions. Claude flagged this early, saving us from a painful migration later.

We then built the MarketplaceHook contract implementing the IACPHook interface. On every job completion or rejection, the hook automatically emits a ReputationDue event, which the Sentinel monitors and uses to write reputation feedback to the ERC-8004 ReputationRegistry. This creates the flywheel -- agents build track records without any manual intervention.

A critical discovery came when researching the ERC-8004 spec against the actual deployed contracts. The CLAUDE.md spec assumed `int64` for reputation values and `bytes32` for tags. The deployed contracts use `int128` and `string`. Agent IDs start at 0, feedback indices at 1. Self-feedback is blocked at the contract level, meaning our three agents (Orchestrator, Worker, Sentinel) each need separate wallets. Claude helped audit every ABI definition against the on-chain bytecode to prevent silent failures.

We also learned that Celo Alfajores had been sunset in favor of Celo Sepolia (chain ID 11142220). Claude updated all RPC endpoints, deploy scripts, and client configurations accordingly.

### Agent Core + x402 + MCP

Claude helped design the three-agent architecture: the Orchestrator discovers problems and posts jobs, Worker agents bid and execute, and the Sentinel evaluates deliverables and triggers settlement. Each agent has its own ERC-8004 identity registered on-chain and runs an autonomous decision loop. The Orchestrator operates a full cycle of discover, plan, post, select, verify, and accept/reject without human intervention.

The x402/AgentCash integration turned out to be load-bearing, not decorative. When the Orchestrator posts a research job, the Worker agent must pay for real external data -- company enrichment via StableEnrich, web search via Serper, chart generation via StableStudio. Without x402, the agent literally cannot complete the task. Claude built the payment wrapper to handle the base64 JSON headers and eip155:CHAINID format that x402 v2 uses.

The hardest bug of the session was nonce collisions. When the Sentinel calls `complete()` on the escrow and then immediately writes reputation feedback, the second transaction fails with "nonce too low" because the first hasn't been mined yet. Claude implemented a nonce manager (`blockchain/nonce-manager.ts`) that tracks pending transactions and assigns nonces sequentially without waiting for confirmations.

We also built the MCP server exposing all marketplace tools -- create_job, fund_job, browse_jobs, bid_on_job, submit_work, evaluate_work, register_agent, get_reputation, and more. Any MCP-compatible agent (Claude Code, Codex, ElizaOS) can interact with AgentLedger natively through this server.

### Frontend + Docs + Status Network

Claude helped build a Next.js 15 frontend with three views: a job board listing all open/active jobs, a job detail page showing escrow status and history, and an agent leaderboard ranked by reputation score. The frontend pulls data from Celo Sepolia for escrow state and from the ERC-8004 registries for agent identity and reputation. Dark theme, ISR with 30-second revalidation for jobs and 60-second for the leaderboard.

Claude helped prepare the submission artifacts: the agent.json manifest documenting capabilities, compute constraints, and supported tools; the agent_log.json structured execution log showing every decision, tool call, cost, and outcome. We also verified the Status Network deployment for the $50 gasless bounty -- a single verified contract deployment with proof of gasPrice=0.

By end of session: 42 tests passing (including fuzz tests), contracts deployed to Celo Sepolia, full E2E demo running (job creation through settlement and reputation), MCP server with all tools, frontend live.

---

## Session 2 (March 22) -- Marketplace Overhaul

### Sealed Deliverables + Filecoin

The biggest innovation came from a question: "What if the worker's deliverable is encrypted before submission?" Claude designed what we call Optimistic Information Escrow -- worker encrypts with AES-256-GCM, uploads ciphertext to Filecoin via the Synapse SDK, submits only the keccak256 hash onchain. The Sentinel receives the decryption key to evaluate. On approval, key revealed to client. On rejection, key withheld -- worker IP stays protected. No other agent marketplace does this.

Getting Filecoin working required funding the worker wallet with tFIL (gas) and tUSDFC (storage payments) on Filecoin Calibration testnet. The Synapse SDK needs a USDFC deposit into the Warm Storage payment contract before uploads work. Claude discovered the `storage.prepare()` -> `transaction.execute()` flow to auto-deposit. First real upload returned PieceCID `bafkzcib...` -- content permanently stored on Filecoin, encrypted, and retrievable.

We also built hash-chained receipt logs -- every agent action (decision, tool call, error, guardrail) gets a keccak256 hash linking it to the previous entry, creating a tamper-evident audit trail. The full chain is uploaded to Filecoin. This directly strengthens the PL "Agents With Receipts" bounty.

### Competitive Bidding

Critical feedback: "The demo shows a scripted single-path flow. Where's the marketplace?" The E2E had one worker pre-assigned to every job. We needed agents competing.

Claude rewrote the E2E from 5 phases to 7: (1) Orchestrator posts an OPEN job with no provider, (2a) Worker A bids 15 USDC, (2b) Worker B bids 25 USDC, (3) Orchestrator queries ERC-8004 reputation for both, compares scores + prices, selects Worker A, calls setProvider onchain, (4) Budget + funding, (5) Research with x402 + sealed Filecoin upload, (6) Rubric-based evaluation + settlement + reputation.

The key design insight: ERC-8183's setBudget() is provider-only by design. Multiple agents can't call setBudget on the same job. So bidding happens off-chain via a bid registry (`marketplace/bid-registry.ts`), and the orchestrator selects a winner before the budget goes onchain. Three new MCP tools -- `submit_bid`, `get_bids`, `select_worker` -- make this accessible to any agent framework.

We also added a structured evaluation rubric to the Sentinel: Completeness (0-25), Accuracy (0-25), Depth (0-25), Format (0-25). Score >= 60 approves. This addresses the ETHMumbai judge critique: "How do you validate agent output?"

### ENS Registration

Registered `agentledger.eth` on Sepolia ENS via the ETHRegistrarController (commit-reveal process). Created three subnames -- `orchestrator.agentledger.eth`, `worker.agentledger.eth`, `sentinel.agentledger.eth` -- each with text records for role, capabilities, and protocol via the NameWrapper contract. 19 onchain transactions total for ENS alone.

### Audit Fixes + Frontend Polish

Claude ran three independent audit passes, catching and fixing: console.log pollution in library code, zero-address fallbacks replaced with fail-fast errors, phantom `@ai-sdk/google` dependency removed, MCP feedback hash changed from all-zeros to real keccak256, deploy script renamed from alfajores to celo-sepolia, post-job form now passes real MarketplaceHook address instead of zero address.

Frontend improvements: landing page now shows live onchain stats (job count, completed, total escrowed USDC), 6-step "How It Works" flow, four Synthesis themes, tech stack grid, deployed contract links. Job detail page shows deliverable hash + settlement breakdown (worker/platform/evaluator splits). Agent registry shows all 3 agents with ENS names and onchain stats. Register page explains how any agent can join via MCP.

Final E2E dry run: Job #22, all 7 phases completed, real Filecoin CID returned, rubric evaluation 60/100 approved, settlement 14.55/0.30/0.15 USDC, receipt chain uploaded to Filecoin. Ship it.

---

*Note: Commits were batched at the end of each session rather than pushed incrementally during development. The git history reflects commit timing, not development timing.*

*Built solo by Karan Singh Bisht with Claude Code (Anthropic) for The Synthesis, March 2026.*
