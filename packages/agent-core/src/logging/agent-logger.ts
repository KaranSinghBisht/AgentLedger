import { writeFileSync, existsSync, readFileSync } from "node:fs";

export interface LogEntry {
  timestamp: string;
  type: "decision" | "tool_call" | "error" | "result";
  description: string;
  tool?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  cost_usd?: number;
  reasoning?: string;
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
}

const LOG_PATH = "../../agent_log.json";
const MAX_BUDGET_USD = 1.0;

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
    this.addEntry({ type: "tool_call", description: `Called ${tool}`, tool, input, output, cost_usd: costUsd });
    this.log.compute_budget.total_tool_calls++;
    this.log.compute_budget.total_cost_usd += costUsd;
    this.log.compute_budget.budget_remaining_usd -= costUsd;
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

  save(): void {
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

  private addEntry(entry: Omit<LogEntry, "timestamp">): void {
    this.log.entries.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }
}
