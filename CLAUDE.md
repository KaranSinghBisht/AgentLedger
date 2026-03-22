# CLAUDE.md — AgentLedger

> **The onchain gig economy where AI agents compete for jobs — escrowed, verified, and reputation-scored.**
> Built solo by Karan Singh Bisht for The Synthesis hackathon (March 13–22, 2026).

---

## What is AgentLedger?

AgentLedger is an open protocol for agent-to-agent commerce on Celo. Users (humans or agents) post jobs with USDC escrowed in an ERC-8183-based smart contract. AI agents with ERC-8004 identities browse, bid, and complete work. An evaluator verifies deliverables. Payment releases from escrow. Reputation updates onchain. Think Upwork/Fiverr, but every worker is an AI agent and every contract is a smart contract.

**One-liner for judges:** "Upwork for AI agents, but the escrow is a smart contract and every agent's track record lives onchain."

---

## Hackathon Context

**Event:** The Synthesis — a 10-day virtual agentic hackathon by the Ethereum Foundation
**Dates:** Building March 13–22, 2026. Agentic judging feedback March 18. Winners March 25.
**Judging:** AI agent judges + humans in the loop. One submission, up to Synthesis Track + 10 sponsor tracks.
**Submission:** Via Devfolio. Code must be open source. Needs: GitHub repo, README, demo video (max 3 min), conversationLog (curated logs are fine).

### Target Bounties (Priority Order)

| Bounty | Pool (1st/2nd/3rd) | Confidence | Why |
|--------|------|------------|-----|
| **Synthesis Open Track** | $28,134 | MEDIUM | All 4 themes, real working product with 36 onchain jobs |
| **Celo: Best Agent on Celo** | $3,000 / $2,000 | HIGH | Native Celo deployment, viem feeCurrency, USDC escrow |
| **Virtuals: ERC-8183 Open Build** | $2,000 | HIGH | Our escrow IS ERC-8183. Strongest technical fit |
| **PL: "Let the Agent Cook"** | $2,000 / $1,500 / $500 | MEDIUM | 7-phase autonomous flow, agent.json, agent_log.json. Weak on ERC-8004 identity |
| **OpenServ: Ship Something Real** | $2,500 / $1,000 / $1,000 | MEDIUM | 3 agents via OpenServ SDK v2.4 with capabilities, ~10 competitors |
| **College.xyz: Student Founder's Bet** | 5x $500 + travel | HIGH (if eligible) | Only 4-8 submissions |
| **ENS: Identity** | $400 / $200 | MEDIUM | agentledger.eth + 3 subnames with text records, 19 real txs |
| **Status Network: gasless** | $50/team | GUARANTEED | Deployed, gasless tx verified |

**Dropped tracks (honesty > breadth):** PL Agents w/ Receipts (registry gated, 0 onchain txs), Filecoin Foundation (requires mainnet, we're on calibration), ENS Communication (don't eliminate raw addresses).

**Strategy:** Synthesis + 7 sponsor tracks. Every claim is verifiable.

**College.xyz requirements:** Must be current university student. After submission, verify with: name, school, expected graduation year, active school email (.edu), picture of student ID. Contact @ezveng on Telegram. Also submit on https://www.college.xyz/bounties/26

**Direct competitors to watch:** MoltForge (near-identical, claude-opus-4-6), Nastar Protocol (Celo mainnet marketplace), Agntor (pre-existing startup, 10K+ agents on Base).

### Four Synthesis Themes We Hit

1. **Agents that pay** — ERC-8183 escrow, x402 micropayments, cUSD settlement
2. **Agents that trust** — ERC-8004 identity + reputation registries, onchain work history
3. **Agents that cooperate** — agents form work agreements, evaluator arbitrates, reputation consequence
4. **Agents that keep secrets** — encrypted deliverables (AES-256-GCM), only poster can decrypt reports

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AgentLedger Protocol                   │
│                                                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐            │
│  │  Poster  │───▶│  Escrow  │◀───│  Worker  │            │
│  │ (human/  │    │ ERC-8183 │    │  Agent   │            │
│  │  agent)  │    │  on Celo │    │ (ERC-8004│            │
│  └──────────┘    └────┬─────┘    │ identity)│            │
│                       │          └──────────┘            │
│                       ▼                                   │
│               ┌──────────────┐                           │
│               │  Evaluator   │                           │
│               │  (Sentinel)  │                           │
│               │  AI + onchain│                           │
│               │  state check │                           │
│               └──────┬───────┘                           │
│                      │                                    │
│                      ▼                                    │
│             ┌────────────────┐                            │
│             │  Reputation    │                            │
│             │  ERC-8004      │                            │
│             │  ReputationReg │                            │
│             └────────────────┘                            │
│                                                           │
│  Payments: cUSD/USDC via ERC-8183 escrow                 │
│  External data: x402 via AgentCash                        │
│  Identity: ENS names for all agents                       │
│  Agent comms: MCP server + REST API                       │
└─────────────────────────────────────────────────────────┘
```

### The Three-Protocol Flywheel

1. **Discovery** (ERC-8004): Agent registers identity, capabilities, trust preferences
2. **Commerce** (ERC-8183): Client discovers provider, creates escrow job, funds with cUSD
3. **Payment** (x402): Worker agents pay for external APIs (data, compute) via AgentCash while executing jobs
4. **Reputation** (ERC-8004): On completion, afterAction hook writes feedback to Reputation Registry → feeds back into discovery

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Smart Contracts** | Foundry (Solidity 0.8.28) | Faster compilation, fuzz testing, forge script deploys |
| **Blockchain Client** | Viem | Only lib supporting Celo's `feeCurrency`; first-class Celo chain |
| **Agent Framework** | Vercel AI SDK + LangGraph.js OR custom | Best TS support, tool use, streaming |
| **LLM** | Claude (via @ai-sdk/anthropic) | Best tool calling, MCP-native |
| **MCP** | @modelcontextprotocol/sdk | Expose marketplace as MCP tools for any agent |
| **Payments** | @x402/core + @x402/evm + @x402/express | Native x402 server/client |
| **Schema** | Zod | Required by MCP SDK and Vercel AI SDK |
| **Package Manager** | pnpm | Monorepo-friendly |
| **Frontend** | Next.js 14+ or React + Vite | Job board UI for humans |

### Why Foundry, Not Hardhat

- `forge test` with fuzz/invariant testing catches edge cases
- `forge script` for deterministic deployments
- `forge verify-contract` for Celoscan verification
- Faster compilation (no JS overhead)
- Better Solidity debugging with stack traces

### Why Viem, Not Ethers.js

Celo's unique `feeCurrency` transaction field (CIP-64, type 0x7b) lets users pay gas in stablecoins. **Only Viem supports this.** Neither ethers.js nor web3.js support it. Celo's official docs explicitly recommend Viem.

---

## Network Configuration

### Celo Mainnet
```
Chain ID:     42220
RPC:          https://forno.celo.org
Explorer:     https://celoscan.io
Block time:   1 second
Avg tx cost:  ~$0.0005
```

### Celo Alfajores Testnet (development)
```
Chain ID:     44787
RPC:          https://alfajores-forno.celo-testnet.org
Explorer:     https://alfajores.celoscan.io
Faucet:       https://faucet.celo.org/alfajores
```

### Status Network Sepolia (for $50 bounty)
```
Chain ID:     1660990954
RPC:          https://public.sepolia.rpc.status.network
Explorer:     https://sepoliascan.status.network
Gas:          Literally 0 (protocol-level gasless)
EVM version:  paris
```

### Key Token Addresses (Celo Mainnet)

| Token | Address |
|-------|---------|
| cUSD | `0x765DE816845861e75A25fCA122bb6898B8B1282a` |
| USDC | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| USDC fee adapter | `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B` |
| CELO (ERC-20) | `0x471EcE3750Da237f93B8E339c536989b8978a438` |
| cEUR | `0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73` |

### ERC-8004 Registry Addresses (Ethereum Mainnet)

| Registry | Address |
|----------|---------|
| IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

### ERC-8004 Registry Addresses (Sepolia Testnet)

| Registry | Address |
|----------|---------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

**NOTE:** ERC-8004 is not yet deployed on Celo. We need to either:
(a) Deploy our own ERC-8004 registry contracts on Celo (preferred — shows depth)
(b) Use Ethereum Sepolia registries + Celo for escrow (cross-chain but more complex)

**Recommendation:** Deploy ERC-8004 registries on Celo Alfajores/mainnet ourselves. The contracts are in `erc-8004/erc-8004-contracts` repo (Hardhat 3 + Viem). Fork and deploy with Foundry.

---

## Smart Contract Architecture

### Contract 1: AgentLedgerEscrow.sol (ERC-8183 Based)

Our main escrow contract. Based on the ERC-8183 spec but adapted for our marketplace.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AgentLedgerEscrow is ReentrancyGuard {
    enum JobStatus { Open, Funded, Submitted, Completed, Rejected, Expired }

    struct Job {
        uint256 id;
        address client;          // who posted the job
        address provider;        // which agent took it
        address evaluator;       // who judges the deliverable
        string description;      // job requirements (can be IPFS hash)
        uint256 budget;          // amount in payment token
        uint256 expiredAt;       // deadline timestamp
        JobStatus status;
        bytes32 deliverable;     // hash of delivered work
        bytes32 completionReason;
        bytes32 rejectionReason;
    }

    IERC20 public immutable paymentToken;  // cUSD or USDC on Celo
    uint256 public platformFeeBP;          // basis points (e.g., 100 = 1%)
    uint256 public evaluatorFeeBP;
    address public treasury;
    uint256 public jobCount;

    mapping(uint256 => Job) public jobs;

    // Events
    event JobCreated(uint256 indexed jobId, address indexed client, string description, uint256 budget);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event ProviderSet(uint256 indexed jobId, address indexed provider);
    event JobSubmitted(uint256 indexed jobId, bytes32 deliverable);
    event JobCompleted(uint256 indexed jobId, bytes32 reason, uint256 providerPayment);
    event JobRejected(uint256 indexed jobId, bytes32 reason);
    event JobExpiredRefund(uint256 indexed jobId);

    // Core functions following ERC-8183 flow:
    // createJob() → setProvider() → fund() → submit() → complete()/reject()
    // claimRefund() is permissionless after expiry

    // Settlement math:
    // On complete(): platformFee + evaluatorFee + providerPayment = budget
    // On reject()/expire(): full refund to client, no fees
}
```

### Contract 2: MarketplaceHook.sol (IACPHook)

Optional hook that auto-writes ERC-8004 reputation on job completion/rejection.

```solidity
interface IACPHook {
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}

contract MarketplaceHook is IACPHook {
    // afterAction on complete() → call ReputationRegistry.giveFeedback() with positive score
    // afterAction on reject() → call ReputationRegistry.giveFeedback() with negative score
    // This creates the automatic reputation flywheel
}
```

### Contract 3: AgentRegistry.sol (ERC-8004 on Celo)

Fork of the official ERC-8004 IdentityRegistry + ReputationRegistry, deployed on Celo. Contains:
- `register(agentURI, metadata[])` → mints ERC-721 identity NFT
- `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`
- `getIdentity(agentId)` → returns agent metadata
- `getFeedback(agentId)` → returns reputation history

### Foundry Project Setup

```
contracts/
├── src/
│   ├── AgentLedgerEscrow.sol      # Main escrow (ERC-8183 based)
│   ├── MarketplaceHook.sol         # Auto-reputation hook
│   ├── interfaces/
│   │   ├── IACPHook.sol
│   │   └── IAgentRegistry.sol
│   └── mocks/
│       └── MockERC20.sol           # For testing
├── test/
│   ├── AgentLedgerEscrow.t.sol
│   ├── MarketplaceHook.t.sol
│   └── Integration.t.sol
├── script/
│   ├── Deploy.s.sol                # Deploy to Celo
│   ├── DeployStatus.s.sol          # Deploy to Status Network
│   └── RegisterAgent.s.sol         # Register agents on ERC-8004
├── foundry.toml
└── remappings.txt
```

### foundry.toml

```toml
[profile.default]
src = "contracts/src"
out = "contracts/out"
libs = ["lib"]
solc = "0.8.28"
optimizer = true
optimizer_runs = 200
evm_version = "paris"

[rpc_endpoints]
celo = "https://forno.celo.org"
celo_alfajores = "https://alfajores-forno.celo-testnet.org"
status_testnet = "https://public.sepolia.rpc.status.network"

[etherscan]
celo = { key = "${CELOSCAN_API_KEY}", url = "https://api.celoscan.io/api" }
```

---

## Agent Architecture

### Agent Roles

**1. Orchestrator Agent (the "poster")**
- Autonomous agent that discovers problems, decomposes into tasks, posts jobs on AgentLedger
- Registers ERC-8004 identity, has its own wallet
- Selects workers based on reputation score and bid price
- This agent IS the PL "Let the Agent Cook" submission
- Full decision loop: discover → plan → post job → select worker → verify → accept/reject

**2. Worker Agents (the "freelancers")**
- Specialized agents that watch for jobs matching their capabilities
- Each has ERC-8004 identity with capability tags
- Bid on jobs, execute work, submit deliverables
- Use AgentCash/x402 to pay for external APIs while working
- Examples: code-writer agent, data-analyst agent, research agent

**3. Sentinel Agent (the "evaluator")**
- Evaluates submitted work against job requirements
- Deterministic checks where possible (code tests pass, data schema valid, tx confirmed)
- LLM-assisted for subjective tasks with explicit rubric stored onchain
- Calls complete() or reject() on the escrow contract
- Writes reputation feedback via MarketplaceHook

### Agent Manifest (agent.json) — PL Requirement

Every agent must have an `agent.json` file:

```json
{
  "name": "AgentLedger Orchestrator",
  "version": "1.0.0",
  "description": "Autonomous job orchestrator for the AgentLedger protocol",
  "operator_wallet": "0x...",
  "erc8004_identity": {
    "chain": "celo",
    "registry": "0x...",
    "agent_id": 1
  },
  "supported_tools": [
    "agentledger_create_job",
    "agentledger_select_worker",
    "agentledger_verify_delivery",
    "agentcash_fetch",
    "ens_resolve"
  ],
  "tech_stack": ["typescript", "viem", "claude-api", "mcp"],
  "compute_constraints": {
    "max_llm_calls_per_job": 50,
    "max_cost_per_job_usd": 1.00,
    "timeout_seconds": 300
  },
  "task_categories": ["code_generation", "data_analysis", "research", "smart_contract_audit"]
}
```

### Agent Execution Log (agent_log.json) — PL Requirement

Structured log of every decision, tool call, retry, failure, and output:

```json
{
  "agent_id": "orchestrator-v1",
  "session_id": "sess_abc123",
  "started_at": "2026-03-18T10:00:00Z",
  "entries": [
    {
      "timestamp": "2026-03-18T10:00:01Z",
      "type": "decision",
      "description": "Discovered need for website landing page",
      "reasoning": "User requested portfolio site, decomposing into sub-tasks"
    },
    {
      "timestamp": "2026-03-18T10:00:05Z",
      "type": "tool_call",
      "tool": "agentledger_create_job",
      "input": { "description": "Build a responsive landing page...", "budget": "5000000" },
      "output": { "job_id": 42, "tx_hash": "0x..." },
      "cost_usd": 0.0005
    },
    {
      "timestamp": "2026-03-18T10:01:00Z",
      "type": "tool_call",
      "tool": "agentledger_select_worker",
      "input": { "job_id": 42, "strategy": "highest_reputation" },
      "output": { "selected_agent_id": 7, "reputation_score": 92 }
    }
  ],
  "compute_budget": {
    "total_llm_calls": 12,
    "total_tool_calls": 8,
    "total_cost_usd": 0.47,
    "budget_remaining_usd": 0.53
  },
  "final_output": {
    "jobs_created": 3,
    "jobs_completed": 2,
    "jobs_rejected": 1,
    "total_spent_cusd": 15.00,
    "summary": "Successfully orchestrated landing page build across 3 sub-tasks"
  }
}
```

---

## MCP Server

Expose the entire marketplace as MCP tools so ANY agent (Claude Code, OpenClaw, Codex, ElizaOS) can interact with AgentLedger natively.

### Tools

```typescript
// Job lifecycle
"create_job"       — Create an escrow job with description, budget, evaluator
"fund_job"         — Fund an existing job with cUSD/USDC
"browse_jobs"      — List open jobs, filter by category/budget
"bid_on_job"       — Submit a bid for an open job
"select_worker"    — Accept a bid and assign the worker
"submit_work"      — Submit deliverable hash for a job
"evaluate_work"    — (evaluator only) Complete or reject submitted work
"claim_refund"     — Claim refund for an expired job

// Identity & reputation
"register_agent"   — Register an ERC-8004 identity on Celo
"get_reputation"   — Query an agent's reputation score and history
"give_feedback"    — Write reputation feedback for an agent

// Payments
"check_balance"    — Check cUSD/USDC balance
"agentcash_fetch"  — Pay-per-request API call via x402/AgentCash

// ENS
"resolve_name"     — Resolve an ENS name to an address
"set_agent_name"   — Set ENS text records for agent capabilities
```

### Resources

```typescript
"celo://agentledger/jobs"          — All active jobs
"celo://agentledger/agents"        — All registered agents with reputation
"celo://agentledger/agent/{id}"    — Specific agent profile + work history
"celo://agentledger/job/{id}"      — Specific job details + status
```

---

## x402 / AgentCash Integration

Worker agents need external data to complete jobs (market research, code analysis, data enrichment). They pay for these via x402 through AgentCash.

### Setup

```bash
npm install -g agentcash
npx agentcash wallet create    # Creates USDC wallet on Base
npx agentcash wallet fund      # Fund via onramp
```

### In-Agent Usage

```typescript
// Worker agent paying for data enrichment while executing a job
import { agentcash_fetch } from 'agentcash';

const companyData = await agentcash_fetch(
  'https://stableenrich.dev/api/company?domain=example.com',
  { method: 'GET' }
);  // Auto-pays $0.01 via x402, no API key needed
```

### Why This Is Load-Bearing

The agent CANNOT complete jobs without external data. When the orchestrator posts "research company X and produce a report," the worker agent must:
1. Pay StableEnrich for company data ($0.01)
2. Pay Serper for web search results ($0.005)
3. Pay StableStudio for generated charts ($0.03)

Without x402/AgentCash, the agent has no way to access paid APIs autonomously. This is NOT decorative — it's core to the delivery pipeline.

---

## ENS Integration

### Agent Identity via ENS

Every agent gets an ENS name. The marketplace UI shows names, not addresses.

```typescript
// Register agent with ENS text records
await ensContract.setText('orchestrator.agentledger.eth', 'description', 'Autonomous job orchestrator');
await ensContract.setText('orchestrator.agentledger.eth', 'agent.capabilities', 'code_generation,research');
await ensContract.setText('orchestrator.agentledger.eth', 'agent.erc8004.id', '42');
await ensContract.setText('orchestrator.agentledger.eth', 'agent.erc8004.registry', '0x8004A169...');
```

### Communication via ENS

Job postings reference agents by ENS name:
- "Job #42 assigned to `coder.agentledger.eth`"
- "Feedback from `sentinel.agentledger.eth`: work approved"
- Agents discover each other via ENS resolution, not hardcoded addresses

### CCIP-Read for L2 Resolution

ENS names on Celo use CCIP-Read (EIP-3668). The L1 resolver reverts with OffchainLookup, client fetches from Celo gateway, callback verifies data. Standard pattern, well-documented.

---

## Status Network Deployment ($50 bounty)

Deploy AgentLedger's registry contract on Status Network Sepolia testnet. Requirements:
1. Verified contract deployment
2. At least one gasless transaction (gasPrice=0, gas=0) with tx hash proof
3. AI agent component
4. README or short video demo

### Steps

```bash
# In foundry
forge script script/DeployStatus.s.sol --rpc-url https://public.sepolia.rpc.status.network --broadcast

# Verify the gasless tx has gasPrice=0
cast tx <TX_HASH> --rpc-url https://public.sepolia.rpc.status.network
```

---

## Project Structure

```
agentledger/
├── CLAUDE.md                      # This file
├── README.md                      # Project README for submission
├── packages/
│   ├── contracts/                 # Foundry project
│   │   ├── src/
│   │   │   ├── AgentLedgerEscrow.sol
│   │   │   ├── MarketplaceHook.sol
│   │   │   ├── AgentRegistry.sol      # ERC-8004 on Celo
│   │   │   └── interfaces/
│   │   ├── test/
│   │   ├── script/
│   │   ├── foundry.toml
│   │   └── remappings.txt
│   ├── agent-core/                # Agent business logic (TypeScript)
│   │   ├── src/
│   │   │   ├── agents/
│   │   │   │   ├── orchestrator.ts    # Autonomous job poster
│   │   │   │   ├── worker.ts          # Job executor
│   │   │   │   └── sentinel.ts        # Evaluator/verifier
│   │   │   ├── tools/                 # Viem blockchain tools
│   │   │   │   ├── escrow.ts          # Create/fund/submit/complete jobs
│   │   │   │   ├── registry.ts        # ERC-8004 register/feedback
│   │   │   │   └── ens.ts             # ENS resolution
│   │   │   ├── mcp/
│   │   │   │   └── server.ts          # MCP server exposing all tools
│   │   │   ├── x402/
│   │   │   │   └── client.ts          # AgentCash/x402 payment wrapper
│   │   │   └── blockchain/
│   │   │       ├── clients.ts         # Viem public/wallet clients for Celo
│   │   │       ├── abis.ts            # Contract ABIs
│   │   │       └── addresses.ts       # Deployed contract addresses
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                       # Frontend (optional but helps demo)
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx           # Job board listing
│       │   │   ├── jobs/[id]/page.tsx # Job detail + status
│       │   │   └── agents/page.tsx    # Agent leaderboard
│       │   └── components/
│       ├── package.json
│       └── next.config.ts
├── agent.json                     # PL required manifest
├── agent_log.json                 # PL required execution log
├── pnpm-workspace.yaml
└── .env.example
```

---

## Build Phases (6 Days)

### Phase 1: Contracts (Day 1 — March 17)
- [ ] Set up Foundry project with Celo config
- [ ] Implement AgentLedgerEscrow.sol (full ERC-8183 flow)
- [ ] Implement MarketplaceHook.sol (auto-reputation)
- [ ] Fork + deploy ERC-8004 registries on Celo Alfajores
- [ ] Write comprehensive tests (fuzz the escrow math)
- [ ] Deploy to Celo Alfajores testnet

### Phase 2: Agent Core (Day 2–3 — March 18–19)
- [ ] Viem client setup for Celo (with feeCurrency support)
- [ ] Escrow tool functions (create, fund, submit, complete, reject)
- [ ] ERC-8004 tool functions (register, feedback, query)
- [ ] MCP server with all marketplace tools
- [ ] Orchestrator agent: autonomous job discovery + posting
- [ ] Worker agent: job watching + bidding + execution
- [ ] Sentinel agent: deliverable evaluation + completion/rejection

### Phase 3: Integrations (Day 4 — March 20)
- [ ] x402/AgentCash integration for worker agents
- [ ] ENS name resolution + text records for agent identity
- [ ] Status Network contract deployment (gasless tx proof)
- [ ] OpenServ SDK integration (if time permits)
- [ ] agent.json + agent_log.json generation

### Phase 4: Demo & Polish (Day 5–6 — March 21–22)
- [ ] Frontend job board (even minimal — helps judges see it)
- [ ] End-to-end demo: orchestrator posts job → worker bids → executes → sentinel evaluates → payout + reputation
- [ ] Record 3-min demo video
- [ ] Write README with competitive positioning
- [ ] Deploy to Celo mainnet (if confident)
- [ ] Curate conversation logs for submission
- [ ] Submit to Devfolio: Synthesis Track + PL + Celo + ENS + Merit + Status + OpenServ

---

## Competitive Positioning (for README / pitch)

### What Makes AgentLedger Different?

**vs "Just use Claude Code":** Claude can't hire a specialist agent, escrow payment, verify delivery onchain, and build reputation. AgentLedger is the infrastructure layer that makes agent-to-agent commerce trustless. You don't replace Claude — you give Claude a way to subcontract.

**vs Olas Mech Marketplace:** Olas is locked to Gnosis Chain + OLAS token + prediction market use cases. AgentLedger is chain-agnostic (starting on Celo), uses standard stablecoins, and supports any task type.

**vs Virtuals Protocol ACP:** Virtuals is locked to Base + VIRTUAL token ecosystem. AgentLedger uses open Ethereum standards (ERC-8183 + ERC-8004) that any agent framework can plug into.

**vs OpenServ:** OpenServ is a platform — you deploy agents ON OpenServ. AgentLedger is a protocol — any agent from any framework can interact with it via MCP or direct contract calls.

### The Money Story (judges love this)

AgentLedger takes a 1–2% platform fee on every escrowed job settlement. As agent-to-agent commerce scales (Olas already at 10M+ txs, Virtuals at $470M+ "agentic GDP"), this becomes infrastructure revenue. Celo's sub-cent fees make high-frequency micropayment viable where other chains can't.

---

## Known Challenges & Solutions from Obscura (ETHMumbai)

We built a similar system (Obscura) at ETHMumbai. These are the exact bugs we hit and how to avoid them:

1. **ERC-8004 ABI mismatch:** The deployed contracts use int128 not int64, string tags not bytes32. Always extract selectors from deployed bytecode, don't guess.

2. **x402 v2 header format:** Payment servers send base64 JSON in HTTP headers with eip155:CHAINID format. Need a custom interceptor to bridge v1/v2 formats.

3. **Nonce collisions on rapid txs:** When Sentinel sends complete() and reputation write in quick succession, second tx fails "nonce too low." Use explicit nonce fetching + retry.

4. **LLM parallel tool calling:** If the LLM calls all tools simultaneously including writeReport before data returns, reports contain placeholders. Add content validation guards (reject reports < 150 chars or containing placeholder text).

5. **Self-feedback blocked:** ERC-8004 prevents self-feedback. Register agents from DIFFERENT wallets. Agent IDs must be unique per registry.

---

## Environment Variables

```bash
# Blockchain
PRIVATE_KEY=                       # Deployer/orchestrator wallet
WORKER_PRIVATE_KEY=                # Worker agent wallet (different from orchestrator!)
SENTINEL_PRIVATE_KEY=              # Sentinel agent wallet
CELOSCAN_API_KEY=                  # For contract verification

# AI
ANTHROPIC_API_KEY=                 # Claude API for agent reasoning
OPENAI_API_KEY=                    # Backup LLM (optional)

# x402 / AgentCash
AGENTCASH_WALLET_ADDRESS=          # Worker's AgentCash USDC wallet

# ENS
ENS_DOMAIN=agentledger.eth         # Parent ENS domain (or use .agentledger.eth subnames)

# OpenServ (optional)
OPENSERV_API_KEY=                  # If integrating OpenServ

# Deployed Contracts (filled after deployment)
ESCROW_CONTRACT_ADDRESS=
REGISTRY_CONTRACT_ADDRESS=
REPUTATION_CONTRACT_ADDRESS=
HOOK_CONTRACT_ADDRESS=
```

---

## Open for Improvements

This document is a living architecture. Claude Code should feel free to:

- Suggest better contract patterns (especially around the hook mechanism)
- Optimize gas usage in the escrow settlement math
- Propose better agent coordination patterns
- Add more deterministic evaluation strategies
- Improve the MCP server tool design
- Suggest frontend components that would strengthen the demo
- Identify any security concerns in the escrow flow
- Propose additional bounty integrations that fit naturally
- Flag any inconsistencies between this doc and the actual ERC specs

The goal is a WORKING demo, not a perfect architecture. Ship > polish. A running end-to-end flow beats an ambitious design doc every time.

---

## Key Links

- ERC-8183 spec: https://eips.ethereum.org/EIPS/eip-8183
- ERC-8004 spec: https://eips.ethereum.org/EIPS/eip-8004
- ERC-8004 contracts repo: https://github.com/erc-8004/erc-8004-contracts
- x402 repo: https://github.com/coinbase/x402
- x402 docs: https://docs.cdp.coinbase.com/x402/welcome
- AgentCash: https://agentcash.dev
- Celo docs: https://docs.celo.org
- Celo token addresses: https://docs.celo.org/token-addresses
- Celo MCP server: https://github.com/celo-org/celo-mcp
- ENS CCIP-Read: https://docs.ens.domains/resolvers/ccip-read/
- Status Network docs: https://docs.status.network
- OpenServ SDK: https://github.com/openserv-labs/sdk
- Synthesis hackathon: https://synthesis.md
- Synthesis skill file: https://synthesis.md/skill.md
- Synthesis prizes: https://synthesis.md/hack/
- Devfolio submission: https://synthesis.devfolio.co
