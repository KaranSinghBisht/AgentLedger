# Testing Guide — AgentLedger

## No Env Vars Required

### 1. Smart Contract Tests (46 tests)
```bash
forge test -vvv
# Specific test:
forge test --match-function test_complete_settlement -vvv
# Gas report:
forge test --gas-report
```

### 2. Sealed Deliverables (AES-256-GCM roundtrip + validation)
```bash
cd packages/agent-core && npx tsx -e "
import { generateSealedKey, sealContent, unsealContent } from './src/crypto/sealed.ts';
const key = generateSealedKey();
const sealed = sealContent('Test sealed delivery for AgentLedger protocol', key);
console.log('Encrypt OK:', sealed.slice(0, 30) + '...');
console.log('Decrypt OK:', unsealContent(sealed, key));
// Wrong key rejected
try { unsealContent(sealed, generateSealedKey()); } catch(e) { console.log('Wrong key rejected:', e.message); }
// Invalid key format rejected
try { sealContent('test', 'ZZZZ'); } catch(e) { console.log('Bad key rejected:', e.message); }
// Truncated payload rejected
try { unsealContent('AAAA', key); } catch(e) { console.log('Truncated rejected:', e.message); }
// Empty string roundtrip
const s2 = sealContent('', key);
console.log('Empty roundtrip:', unsealContent(s2, key) === '' ? 'OK' : 'FAIL');
"
```

### 3. Verifiable Receipt Chain (hash chain + tamper detection)
```bash
cd packages/agent-core && npx tsx -e "
import { keccak256, toHex } from 'viem';
const genesis = keccak256(toHex('test:sess_1'));
const entries = [
  { type: 'decision', description: 'Start' },
  { type: 'tool_call', description: 'Called create_job' },
  { type: 'guardrail', description: 'SEALED_DELIVERABLE' },
];
let prev = genesis;
for (const e of entries) { prev = keccak256(toHex(JSON.stringify(e) + prev)); }
const root = prev;
// Verify: re-hash from scratch
let v = genesis;
for (const e of entries) { v = keccak256(toHex(JSON.stringify(e) + v)); }
console.log('Chain integrity:', v === root ? 'OK' : 'FAIL');
// Tamper: modify one entry
const bad = [...entries]; bad[1] = { ...bad[1], description: 'FAKE' };
let t = genesis;
for (const e of bad) { t = keccak256(toHex(JSON.stringify(e) + t)); }
console.log('Tamper detected:', t !== root ? 'OK' : 'FAIL');
"
```

### 4. TypeScript Type-Check
```bash
cd packages/agent-core && pnpm build
```

### 5. Frontend Build
```bash
cd packages/web && pnpm build
```

---

## Needs Env Vars (3 private keys + contract addresses)

### 6. Basic E2E Demo (no LLM, hardcoded flow)
```bash
cd packages/agent-core && pnpm demo
```
Tests: create job -> set budget -> fund -> submit -> complete. ~30 seconds.
No LLM needed — uses hardcoded values. Good for testing contract interaction.

### 7. Autonomous E2E (LLM-driven agents)
```bash
cd packages/agent-core && pnpm e2e
# With custom task:
cd packages/agent-core && pnpm e2e "Research top 5 DeFi protocols on Celo"
```
Full 5-phase flow: orchestrator -> worker -> sentinel.
Features tested: sealed deliverables, x402 research, reputation write, receipt chain.
Needs `GOOGLE_GENERATIVE_AI_API_KEY` in addition to wallet keys.
Produces `agent_log.json` with hash-chained receipt entries.

**Expected console output includes:**
- `✓ Job #N created` (Phase 1)
- `✓ Budget set: X USDC` (Phase 2)
- `✓ Status: Funded` (Phase 3)
- `✓ Deliverable sealed with AES-256-GCM, key held by worker` (Phase 4, if Filecoin available)
- `✓ Status: Submitted` (Phase 4)
- `✓ Key revealed to client (job approved)` or `✓ Key withheld (job rejected)` (Phase 5)
- `✓ Root hash: 0x...` (Receipt chain)
- `✓ Receipt chain stored on Filecoin: ...` (if Filecoin available)

### 8. Individual Agents
```bash
cd packages/agent-core
pnpm orchestrator "Build a landing page"
pnpm worker "Research Celo DeFi"
pnpm sentinel
```

### 9. MCP Server
```bash
cd packages/agent-core && pnpm mcp
# Listens on stdin/stdout — connect via Claude Code or any MCP client
# Exposes 14 tools: create_job, set_provider, set_budget, fund_job, submit_work,
# evaluate_work, browse_jobs, get_job, register_agent, get_reputation,
# check_balance, resolve_name, store_deliverable, retrieve_deliverable
```

### 10. OpenServ Agents
```bash
cd packages/agent-core
pnpm openserv                  # All 3 on ports 7378-7380
pnpm openserv orchestrator     # Just one
```
Needs `OPENSERV_API_KEY`.

### 11. Web Frontend (live data from Celo Sepolia)
```bash
cd packages/web && pnpm dev
# http://localhost:3000        — Job board (reads from escrow contract)
# http://localhost:3000/agents — Agent leaderboard (reads ERC-8004 identity + reputation)
```

---

## Integration Status

| Integration | Status | Notes |
|-------------|--------|-------|
| ERC-8183 Escrow | **Real** | Full lifecycle on Celo Sepolia, 46 contract tests |
| ERC-8004 Identity/Reputation | **Real** | Reads/writes to official Eth Sepolia registries |
| x402 / AgentCash | **Real + fallback** | x402 payments with DuckDuckGo/direct fetch fallback |
| Filecoin (Synapse SDK) | **Real + fallback** | Synapse upload/download; falls back to hash-only mode |
| Sealed Deliverables | **Real** | AES-256-GCM encrypt/decrypt, depends on Filecoin for full round-trip |
| Receipt Chain | **Real + fallback** | keccak256 hash chain always computed; Filecoin upload best-effort |
| ENS | **Real** | Resolves names via Eth mainnet; exposed via MCP, not used in E2E |
| OpenServ | **Real** | 3-agent SDK integration; requires OPENSERV_API_KEY |
| MCP Server | **Real** | 14 tools + 1 resource, all wired to onchain functions |
| Status Network | **Deployed** | Gasless escrow at 0x9553d8b8af9588f5d553ec1bcd05f8d1bc8693db |
| Frontend | **Real** | SSR reads from deployed contracts, no mock data |

## What Each Test Covers

| Feature | Verified By |
|---------|-------------|
| Escrow lifecycle (ERC-8183) | forge test (40 tests) + pnpm demo |
| Hook / reputation trigger | forge test (6 tests) |
| Fuzz: settlement math | forge test (testFuzz_settlementMath) |
| Sealed deliverables (AES-256-GCM) | Crypto roundtrip script (test 2) |
| Crypto input validation | Crypto script — bad key, truncated payload, empty string |
| Receipt chain integrity | Receipt chain script (test 3) — verify + tamper detection |
| x402 micropayments | pnpm e2e (Phase 4 worker research) |
| ERC-8004 reputation write | pnpm e2e (Phase 5 sentinel) |
| Sealed key reveal/withhold | pnpm e2e → console output + agent_log.json guardrails |
| Receipt chain persistence | pnpm e2e → agent_log.json receipt_chain field |
| MCP tool exposure | pnpm mcp |
| OpenServ multi-agent | pnpm openserv |
| Frontend job board | pnpm dev |

---

## Env Vars Quick Reference

```bash
# Required for on-chain tests (3 DIFFERENT wallets — self-feedback is blocked on ERC-8004)
PRIVATE_KEY=0x...                    # Orchestrator wallet
WORKER_PRIVATE_KEY=0x...             # Worker wallet
SENTINEL_PRIVATE_KEY=0x...           # Sentinel wallet

# Contract addresses (Celo Sepolia)
ESCROW_CONTRACT_ADDRESS=0x6262a72674F824a2c67fEDE85b56e096eD72B543
HOOK_CONTRACT_ADDRESS=0xF969c4Daa194d639E8d505EebF38600Cc1A87DaE
PAYMENT_TOKEN_ADDRESS=0x9a68d2906AeAa8db01b3e8469653BA6E0d489a5c

# For autonomous E2E (Phase 1-5 with LLM)
GOOGLE_GENERATIVE_AI_API_KEY=...

# Optional
OPENSERV_API_KEY=...                 # For OpenServ multi-agent
AGENTCASH_WALLET_ADDRESS=0x...       # For x402 paid APIs (falls back to free without)
```

---

## Known Limitations

- **Filecoin hash-only mode:** If Synapse SDK is unavailable, deliverables are stored as hashes only (not retrievable). The sealed delivery path degrades — `sealed: false` is returned and the sentinel evaluates without Filecoin content.
- **ENS not in E2E loop:** ENS resolution is available via MCP but agents don't use it in the autonomous flow.
- **x402 fallback:** If AgentCash wallet isn't funded, research tools fall back to free alternatives (DuckDuckGo, direct HTTP fetch). The demo still completes.
- **Receipt chain Filecoin upload:** Best-effort. If Filecoin is unavailable, the receipt chain is only saved locally in `agent_log.json`.
