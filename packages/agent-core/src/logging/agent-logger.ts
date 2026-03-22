import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { keccak256, toHex } from "viem";
import { uploadToFilecoin } from "../tools/filecoin.js";

const SENSITIVE_KEYS = new Set([
  "privateKey", "private_key", "secret", "password", "token",
  "apiKey", "api_key", "mnemonic", "seed", "sealedKey",
]);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      clean[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.startsWith("0x") && value.length === 66) {
      clean[key] = "[REDACTED_KEY]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      clean[key] = sanitize(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export interface LogEntry {
  timestamp: string;
  type: "decision" | "tool_call" | "error" | "result" | "guardrail";
  description: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  cost_usd?: number;
  reasoning?: string;
  previousHash?: string;
  hash?: string;
}

export interface AgentLog {
  agent_id: string;
  session_id: string;
  started_at: string;
  entries: LogEntry[];
  compute_budget: {
    total_llm_calls: number;
    total_tool_calls: number;
    total_cost_usd: number;
    budget_remaining_usd: number;
  };
  final_output?: Record<string, unknown>;
  receipt_chain?: {
    root_hash: string;
    genesis_hash: string;
    entry_count: number;
    filecoin_cid?: string;
  };
}

const LOG_PATH = "../../agent_log.json";
export const MAX_BUDGET_USD = 1.0;

export class AgentLogger {
  private log: AgentLog;

  constructor(agentId: string) {
    this.log = {
      agent_id: agentId,
      session_id: `sess_${Date.now().toString(36)}`,
      started_at: new Date().toISOString(),
      entries: [],
      compute_budget: {
        total_llm_calls: 0,
        total_tool_calls: 0,
        total_cost_usd: 0,
        budget_remaining_usd: MAX_BUDGET_USD,
      },
    };
  }

  decision(description: string, reasoning?: string): void {
    this.addEntry({ type: "decision", description, reasoning });
    this.log.compute_budget.total_llm_calls++;
  }

  toolCall(
    tool: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    costUsd = 0
  ): void {
    this.addEntry({ type: "tool_call", description: `Called ${tool}`, tool, input: sanitize(input), output: sanitize(output), cost_usd: costUsd });
    this.log.compute_budget.total_tool_calls++;
    this.log.compute_budget.total_cost_usd += costUsd;
    this.log.compute_budget.budget_remaining_usd -= costUsd;
  }

  guardrail(description: string, details?: Record<string, unknown>): void {
    this.addEntry({ type: "guardrail", description, output: details });
  }

  error(description: string): void {
    this.addEntry({ type: "error", description });
  }

  result(description: string, output: Record<string, unknown>): void {
    this.addEntry({ type: "result", description, output });
  }

  setFinalOutput(output: Record<string, unknown>): void {
    this.log.final_output = output;
  }

  getEntryCount(): number {
    return this.log.entries.length;
  }

  /** Compute hash chain over all entries. Mutates entries in place. */
  private computeReceiptChain(): { genesisHash: string; rootHash: string } {
    const genesisHash = keccak256(
      toHex(`${this.log.agent_id}:${this.log.session_id}`),
    );
    let prevHash: `0x${string}` = genesisHash;

    for (const entry of this.log.entries) {
      entry.previousHash = prevHash;
      const { hash: _h, previousHash: _p, ...body } = entry;
      const payload = JSON.stringify(body) + prevHash;
      const entryHash = keccak256(toHex(payload));
      entry.hash = entryHash;
      prevHash = entryHash;
    }

    return { genesisHash, rootHash: prevHash };
  }

  save(): void {
    const { genesisHash, rootHash } = this.computeReceiptChain();
    this.log.receipt_chain = {
      root_hash: rootHash,
      genesis_hash: genesisHash,
      entry_count: this.log.entries.length,
    };

    const path = LOG_PATH;
    let existing: AgentLog[] = [];

    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        existing = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        existing = [];
      }
    }

    existing.push(this.log);
    writeFileSync(path, JSON.stringify(existing, null, 2));
  }

  /** Save locally, compute receipt chain, upload to Filecoin. */
  async saveWithReceipts(): Promise<{
    rootHash: string;
    receiptCid?: string;
  }> {
    const { genesisHash, rootHash } = this.computeReceiptChain();
    this.log.receipt_chain = {
      root_hash: rootHash,
      genesis_hash: genesisHash,
      entry_count: this.log.entries.length,
    };

    // Upload receipt chain to Filecoin
    let receiptCid: string | undefined;
    try {
      const chainJson = JSON.stringify({
        agent_id: this.log.agent_id,
        session_id: this.log.session_id,
        genesis_hash: genesisHash,
        root_hash: rootHash,
        entries: this.log.entries,
      });
      const result = await uploadToFilecoin(chainJson);
      receiptCid = result.cid;
      this.log.receipt_chain.filecoin_cid = receiptCid;
    } catch {
      // Filecoin upload is best-effort for receipt chain
    }

    // Write local file
    const path = LOG_PATH;
    let existing: AgentLog[] = [];
    if (existsSync(path)) {
      try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        existing = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        existing = [];
      }
    }
    existing.push(this.log);
    writeFileSync(path, JSON.stringify(existing, null, 2));

    return { rootHash, receiptCid };
  }

  private addEntry(entry: Omit<LogEntry, "timestamp">): void {
    this.log.entries.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }
}
