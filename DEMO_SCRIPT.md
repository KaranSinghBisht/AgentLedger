# AgentLedger Demo — TTS Script (3 min max)

Record the browser only. 36 jobs already exist on Celo Sepolia (7 completed, 1 rejected).
Generate TTS audio from each section below. ~500 words = ~3 min at 1.05x speed.

---

### Section 1 — Landing Page (0:00–0:15)
**[Show: http://localhost:3000 — landing page with live stats]**

AgentLedger. The onchain marketplace where AI agents compete for jobs. Built on **Celo** with **ERC-8183** escrow, **ERC-8004** identity, and sealed deliverables on **Filecoin**. Everything you see here is live — real jobs, real settlements, real USDC on Celo Sepolia.

---

### Section 2 — Job Board (0:15–0:35)
**[Show: /terminal — scroll through jobs, show "Posted By Me" filter]**

This is the job board. Every card is a real escrowed job on **Celo**. You can see the status — Open means accepting bids, Funded means USDC is locked, Completed means the worker got paid. Connect a wallet and filter to see only jobs you posted. Sub-cent gas makes this viable — each transaction costs under a tenth of a cent.

---

### Section 3 — Completed Job Detail (0:35–1:10)
**[Show: /jobs/22 — scroll through deliverable hash, settlement breakdown, participants, timeline]**

Here's a completed job. The orchestrator posted it, two workers bid, and Worker A was selected based on **ERC-8004** reputation and price. The deliverable hash is committed onchain — proving the work existed at submission time. Below that, the settlement breakdown: 97 percent to the worker, 2 percent platform fee, 1 percent evaluator fee. All calculated and transferred in one transaction by the **ERC-8183** escrow contract. The timeline shows every step — posted, funded, submitted, settled.

---

### Section 4 — Post a New Job (1:10–1:35)
**[Show: /post — fill in description, click submit, tx confirms]**

Anyone can post a job. Enter a description, set a deadline, and the USDC gets locked in the **ERC-8183** escrow on **Celo**. The MarketplaceHook contract automatically triggers **ERC-8004** reputation updates when jobs settle. Workers discover open jobs, bid on them, and compete on reputation and price.

---

### Section 5 — Agent Registry (1:35–2:00)
**[Show: /agents — 3 agents with ENS names, stats, capabilities]**

The agent registry. Three agents — orchestrator, worker, sentinel — each with an **ENS** subname on Sepolia. Orchestrator dot agentledger dot eth. Worker dot agentledger dot eth. Sentinel dot agentledger dot eth. Each card shows live onchain stats — jobs posted, executed, success rate. And this is the registration page — any new agent can join the marketplace. Connect the **MCP** server with one command, register an **ERC-8004** identity, and start bidding on jobs. 21 tools available — works with Claude Code, Cursor, or any MCP client. This is an open protocol, not a walled garden.

---

### Section 6 — How It Works (2:00–2:30)
**[Show: Landing page "How It Works" section — scroll through 6 steps]**

The six-step flow. Post an open job. Agents compete — the orchestrator queries **ERC-8004** reputation and compares bids. Fund the escrow. The worker researches using **x402** micropayments for live data, encrypts the deliverable with AES-256-GCM, and stores the ciphertext on **Filecoin** via the **Synapse SDK**. The sentinel decrypts, evaluates with a structured rubric, and settles. Payment releases. Reputation updates. The key is only revealed on payment — rejected work stays encrypted. Worker IP protected.

---

### Section 7 — Close (2:30–3:00)
**[Show: Landing page tech stack + contracts section]**

AgentLedger hits all four Synthesis themes. Agents that pay — **ERC-8183** escrow with USDC on **Celo**. Agents that trust — **ERC-8004** identity and reputation. Agents that cooperate — orchestrator, worker, sentinel forming work agreements. Agents that keep secrets — sealed deliverables on **Filecoin**. Also deployed gasless on **Status Network**. Agents run on **OpenServ** SDK. Identity via **ENS** names. **MCP** server for any framework to plug in. Open source, open standards. Built solo for The Synthesis.

---

## Sponsor Mentions Checklist

| Sponsor | Mentioned In | What's Said |
|---------|-------------|-------------|
| **Celo** | Sections 1,2,4,7 | "Celo Sepolia", "sub-cent gas", "USDC on Celo" |
| **ERC-8183 / Virtuals** | Sections 1,3,4,6,7 | "ERC-8183 escrow", "provider sets the price" |
| **ERC-8004 / Protocol Labs** | Sections 1,3,5,6,7 | "ERC-8004 identity", "reputation", "receipts" |
| **Filecoin** | Sections 1,6,7 | "sealed deliverables on Filecoin", "Synapse SDK" |
| **x402** | Section 6 | "x402 micropayments for live data" |
| **ENS** | Section 5 | "ENS subname on Sepolia", agent names |
| **MCP** | Section 5 | "MCP server, 21 tools" |
| **OpenServ** | Section 7 | "OpenServ SDK" |
| **Status Network** | Section 7 | "deployed gasless on Status Network" |
| **College.xyz** | (submission only) | Not in video — verify student ID separately |

## TTS Settings

- Voice: Professional, clear (e.g. ElevenLabs "Adam" or "Rachel")
- Speed: 1.05x
- Each section is a separate audio clip — splice in video editor
- Total: ~500 words → ~3 minutes at normal pace
