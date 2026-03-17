# AgentLedger Conversation Log

> Curated log of human-AI collaboration building AgentLedger for The Synthesis hackathon (March 13-22, 2026). All development done with Claude (Anthropic) as a pair-programming partner.

---

## Day 1 (March 17) -- Architecture, Contracts, and Deployment

We started with a napkin-level pitch: "Upwork for AI agents, but the escrow is a smart contract and every agent's track record lives onchain." Claude helped turn that into a concrete architecture by designing what we call the three-protocol flywheel -- ERC-8004 for agent identity and reputation, ERC-8183 for escrowed job agreements, and x402/AgentCash for worker agents to pay for external APIs mid-task. Each protocol feeds into the next: identity enables discovery, discovery leads to commerce, commerce generates reputation, reputation improves future discovery.

The first major decision was Foundry over Hardhat. We needed fuzz testing for the escrow fee math (basis-point splits between platform, evaluator, and provider must always sum correctly, even at edge-case budget amounts), and Foundry's native fuzzer caught overflow scenarios that manual unit tests would have missed. Claude designed the AgentLedgerEscrow contract around the ERC-8183 lifecycle -- createJob, setProvider, fund, submit, complete/reject -- but adapted it for our three-party model where the evaluator is a distinct role from client and provider.

Second major decision: Viem instead of ethers.js. This was non-negotiable. Celo uses a custom transaction type (CIP-64, type 0x7b) that lets users pay gas in stablecoins via a `feeCurrency` field. Only Viem supports this. Neither ethers.js nor web3.js can construct these transactions. Claude flagged this early, saving us from a painful migration later.

We then built the MarketplaceHook contract implementing the IACPHook interface. On every job completion or rejection, the hook automatically writes reputation feedback to the ERC-8004 ReputationRegistry. This creates the flywheel -- agents build track records without any manual intervention.

A critical discovery came when researching the ERC-8004 spec against the actual deployed contracts. The CLAUDE.md spec assumed `int64` for reputation values and `bytes32` for tags. The deployed contracts use `int128` and `string`. Agent IDs start at 0, feedback indices at 1. Self-feedback is blocked at the contract level, meaning our three agents (Orchestrator, Worker, Sentinel) each need separate wallets. Claude helped audit every ABI definition against the on-chain bytecode to prevent silent failures.

We also learned that Celo Alfajores had been sunset in favor of Celo Sepolia (chain ID 11142220). Claude updated all RPC endpoints, deploy scripts, and client configurations accordingly.

By end of day: 42 tests passing (including fuzz tests for fee distribution), contracts deployed to Celo Sepolia, and a clean Foundry project with deploy scripts for both Celo and Status Network.

## Day 2 (March 18) -- Agent Core, x402 Integration, and E2E

Day 2 was about bringing the contracts to life with autonomous agents. Claude helped design the three-agent architecture: the Orchestrator discovers problems and posts jobs, Worker agents bid and execute, and the Sentinel evaluates deliverables and triggers settlement.

Each agent has its own ERC-8004 identity registered on-chain and runs an autonomous decision loop. The Orchestrator is our submission for the "Let the Agent Cook" bounty -- it operates a full cycle of discover, plan, post, select, verify, and accept/reject without human intervention.

The x402/AgentCash integration turned out to be load-bearing, not decorative. When the Orchestrator posts a research job, the Worker agent must pay for real external data -- company enrichment via StableEnrich, web search via Serper, chart generation via StableStudio. Without x402, the agent literally cannot complete the task. Claude built the payment wrapper in `packages/agent-core/src/x402/client.ts` to handle the base64 JSON headers and eip155:CHAINID format that x402 v2 uses.

The hardest bug of the day was nonce collisions. When the Sentinel calls `complete()` on the escrow and then immediately writes reputation feedback, the second transaction fails with "nonce too low" because the first hasn't been mined yet. Claude implemented a nonce manager (`blockchain/nonce-manager.ts`) that tracks pending transactions and assigns nonces sequentially without waiting for confirmations.

We also built the MCP server exposing all marketplace tools -- create_job, fund_job, browse_jobs, bid_on_job, submit_work, evaluate_work, register_agent, get_reputation, and more. Any MCP-compatible agent (Claude Code, Codex, ElizaOS) can interact with AgentLedger natively through this server.

By end of day: full E2E demo running. Job creation through escrow funding, worker assignment, work submission, sentinel evaluation, payment settlement, and reputation update -- all autonomous, all on-chain.

## Day 3 (March 19) -- Frontend, Polish, and Submission Prep

Final build day focused on making the demo visible to judges. Claude helped build a Next.js 15 frontend with three views: a job board listing all open/active jobs, a job detail page showing escrow status and history, and an agent leaderboard ranked by reputation score.

The frontend is read-only -- it pulls data from Celo Sepolia for escrow state and from the ERC-8004 registries for agent identity and reputation. Dark theme, ISR with 30-second revalidation for jobs and 60-second for the leaderboard. Nothing fancy, but it gives judges a visual anchor for the demo video.

Claude helped prepare the submission artifacts: the agent.json manifest documenting capabilities, compute constraints, and supported tools; the agent_log.json structured execution log showing every decision, tool call, cost, and outcome; and this conversation log. We also verified the Status Network deployment for the $50 gasless bounty -- a single verified contract deployment with proof of gasPrice=0.

Remaining tasks: record the 3-minute demo video, finalize the README with competitive positioning, and submit to Devfolio targeting the Synthesis Open Track plus seven sponsor bounties.

---

*Built by Paracausal Labs with Claude (Anthropic) for The Synthesis, March 2026.*
