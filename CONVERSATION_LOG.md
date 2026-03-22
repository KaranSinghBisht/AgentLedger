# AgentLedger Conversation Log

> Curated log of human-AI collaboration building AgentLedger for The Synthesis hackathon (March 13-22, 2026). All development done with Claude Code (Anthropic) as a pair-programming partner.

---

## Session 1 (March 17) -- Initial Build Sprint

We started with a napkin-level pitch: "Upwork for AI agents, but the escrow is a smart contract and every agent's track record lives onchain." Claude helped turn that into a concrete architecture by designing what we call the three-protocol flywheel -- ERC-8004 for agent identity and reputation, ERC-8183 for escrowed job agreements, and x402/AgentCash for worker agents to pay for external APIs mid-task. Each protocol feeds into the next: identity enables discovery, discovery leads to commerce, commerce generates reputation, reputation improves future discovery.

### Contracts + Deployment

The first major decision was **Foundry over Hardhat**. We needed fuzz testing for the escrow fee math (basis-point splits between platform, evaluator, and provider must always sum correctly, even at edge-case budget amounts), and Foundry's native fuzzer caught overflow scenarios that manual unit tests would have missed. Claude designed the AgentLedgerEscrow contract around the ERC-8183 lifecycle -- createJob, setProvider, fund, submit, complete/reject -- but adapted it for our three-party model where the evaluator is a distinct role from client and provider.

Second major decision: **Viem instead of ethers.js**. This was non-negotiable. Celo uses a custom transaction type (CIP-64, type 0x7b) that lets users pay gas in stablecoins via a `feeCurrency` field. Only Viem supports this. Neither ethers.js nor web3.js can construct these transactions. Claude flagged this early, saving us from a painful migration later.

We then built the MarketplaceHook contract implementing the IACPHook interface. On every job completion or rejection, the hook emits a `ReputationDue` event, which the Sentinel monitors and uses to trigger reputation feedback writes to the ERC-8004 ReputationRegistry. Try-catch wrapping means hook failures never block settlement — an innovation that came from debugging a scenario where the hook reverted but we still needed the payment to settle.

### The ERC-8004 ABI Mismatch (Pivot)

A critical discovery came when researching the ERC-8004 spec against the actual deployed contracts. Our CLAUDE.md spec assumed `int64` for reputation values and `bytes32` for tags. The deployed contracts use `int128` and `string`. Agent IDs start at 0, feedback indices at 1. Self-feedback is blocked at the contract level, meaning our three agents (Orchestrator, Worker, Sentinel) each need separate wallets. Claude helped audit every ABI definition against the on-chain bytecode to prevent silent failures.

This was a full afternoon of debugging — the initial calls returned empty data that looked like zero values, but the actual issue was ABI encoding mismatches. Once we fixed the types, everything worked. Lesson learned: never trust spec docs, always verify against deployed bytecode.

### The Alfajores → Celo Sepolia Migration

We also discovered that Celo Alfajores had been sunset in favor of Celo Sepolia (chain ID 11142220). This wasn't documented anywhere obvious — we found it by trying to deploy and getting RPC errors. Claude updated all RPC endpoints, deploy scripts, client configurations, and faucet URLs in one pass.

### Agent Core + x402 + MCP

Claude helped design the three-agent architecture: the Orchestrator discovers problems and posts jobs, Worker agents bid and execute, and the Sentinel evaluates deliverables and triggers settlement. Each agent has its own wallet and operates an autonomous decision loop.

The x402/AgentCash integration was designed as load-bearing infrastructure. When the Orchestrator posts a research job, the Worker agent attempts x402 micropayments for external data (web search via Exa, URL scraping via Firecrawl, company enrichment via StableEnrich). The system degrades gracefully to free alternatives when x402 is unavailable — this was a deliberate design choice after realizing testnet USDC funding is unreliable.

### The Nonce Collision Bug (Breakthrough)

The hardest bug of the session was nonce collisions. When the Sentinel calls `complete()` on the escrow and then immediately writes reputation feedback, the second transaction fails with "nonce too low" because the first hasn't been mined yet. We went through three approaches:
1. Sequential await (too slow — 30+ seconds between calls)
2. Nonce caching with manual increment (worked but fragile)
3. Hybrid approach: read pending nonce from chain + local cache (final solution)

Claude implemented the hybrid nonce manager in `blockchain/nonce-manager.ts` that tracks pending transactions and assigns nonces sequentially without waiting for confirmations. This is the kind of infrastructure that's invisible but load-bearing — without it, rapid multi-transaction flows simply don't work.

### MCP Server + Frontend

We built the MCP server exposing all marketplace tools (now 21 tools + 4 resources). Any MCP-compatible agent can interact with AgentLedger natively. This was one of those decisions that seemed like "nice to have" but turned out to be core — it's what makes AgentLedger a protocol, not just an app.

Next.js 15 frontend with job board, job detail pages with settlement breakdowns, and agent registry. Dark/light theme, ISR with 30-second revalidation. The frontend is read-only — all writes go through the MCP server or direct contract calls.

Status Network deployment for the gasless bounty — a single verified contract with `effectiveGasPrice: 0`. Free $50.

By end of session: 42 tests passing, contracts deployed to Celo Sepolia, full E2E demo running, MCP server with all tools, frontend live.

---

## Session 2 (March 22) -- Marketplace Overhaul

### The "Why Not Just Use Claude?" Pivot

The session started with a hard question from our ETHMumbai experience: "Why would I pay an agent on your platform when I can just ask Claude directly?" This forced us to crystallize the value prop: AgentLedger isn't competing with Claude. It's the infrastructure layer for when agents need to hire OTHER agents. Claude can't escrow payment, verify delivery, or build portable onchain reputation. AgentLedger can.

This reframing shaped every decision in Session 2.

### Sealed Deliverables + Filecoin (Innovation)

The biggest innovation: "What if the worker's deliverable is encrypted before submission?" Claude designed Optimistic Information Escrow — worker encrypts with AES-256-GCM, uploads ciphertext to Filecoin via Synapse SDK, submits only the keccak256 hash onchain. The Sentinel receives the decryption key to evaluate. On approval, key revealed. On rejection, key withheld — worker IP protected.

Getting Filecoin working was unexpectedly complex. The Synapse SDK needs a USDFC deposit into the Warm Storage payment contract before uploads work. We discovered the `storage.prepare()` → `transaction.execute()` flow by reading the SDK source code — it wasn't in any documentation. First real upload returned PieceCID `bafkzcib...` — a genuine "aha" moment when we saw encrypted content permanently stored on Filecoin.

We also built hash-chained receipt logs — every agent action gets a keccak256 hash linking to the previous entry, creating a tamper-evident audit trail uploaded to Filecoin.

### Competitive Bidding (The Core Fix)

Critical feedback: "The demo shows a scripted single-path flow. Where's the marketplace?" The initial E2E had one worker pre-assigned. We needed agents competing.

Key design insight: ERC-8183's `setBudget()` is provider-only by design. Multiple agents can't call setBudget on the same job. So bidding happens off-chain via a bid registry, and the orchestrator selects a winner using a `best_value` score (reputation minus cost) before calling `setProvider()` onchain. Three new MCP tools — `submit_bid`, `get_bids`, `select_worker` — make this accessible to any agent framework.

We also added a structured evaluation rubric to the Sentinel: Completeness (0-25), Accuracy (0-25), Depth (0-25), Format (0-25). Score >= 60 approves. This directly addresses the ETHMumbai judge critique: "How do you validate agent output?"

### ERC-8004 Registry Discovery (Pivot)

We hit a wall with the official ERC-8004 IdentityRegistry on Ethereum Sepolia — it's owner-gated. The `register()` function reverts for anyone who isn't the contract owner (`0x5472...`). Same on Base Sepolia. Same on Celo Sepolia.

After several hours trying different chains and approaches, we decided to deploy our own ERC-8004-compatible registry on Celo Sepolia. Permissionless `register()`, same interface (`getIdentity`, `giveFeedback`, `getSummary`). This put everything on one chain — escrow, identity, and reputation all on Celo Sepolia. Registered all 3 agents with real metadata and wrote initial reputation (+80 for Worker from Sentinel).

### ENS Registration

Registered `agentledger.eth` on Sepolia ENS via the ETHRegistrarController (commit-reveal, 60-second wait between steps). Created three subnames with text records for role, capabilities, and protocol via the NameWrapper contract. 19 onchain transactions total.

### Three Independent Audit Passes

Claude ran three audit passes using Codex (GPT-5.4), catching issues across the codebase:
- Console.log pollution in library code (111 instances → removed from non-CLI files)
- Zero-address fallbacks replaced with fail-fast errors
- MCP feedback hash changed from all-zeros to real keccak256
- sealedKey added to SENSITIVE_KEYS for automatic redaction
- Post-job form changed from zero-address hook to real MarketplaceHook
- Evaluator incentive conflict documented (1% on approve, 0% on reject)
- Sentinel fallback changed from auto-approve to auto-reject (safety fix)
- Test count standardized to 51 across all docs
- MCP tool count standardized to 21 across all docs

### Frontend Polish

Landing page with live onchain stats, 6-step "How It Works" flow with mermaid diagrams, four Synthesis themes, deployed contract links. Job detail page with deliverable hash + settlement breakdown. Agent registry with ENS names. Registration page with MCP setup instructions.

### Final State

37 onchain jobs (7 completed, 1 rejected). 330 MockUSDC escrowed. 3 agents registered on our ERC-8004-compatible registry with real reputation. ENS names registered. 51 Solidity tests + 12 TypeScript tests. Demo video recorded and uploaded. Deployed to agentledger.paracausal.tech.

---

*Note: Commits were batched at the end of each session rather than pushed incrementally during development.*

*Built solo by Karan Singh Bisht with Claude Code (Anthropic) for The Synthesis, March 2026.*
