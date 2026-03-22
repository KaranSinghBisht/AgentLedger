import { generateText, type CoreTool } from "ai";
import { groq } from "@ai-sdk/groq";
import { AgentLogger, MAX_BUDGET_USD } from "../logging/agent-logger.js";

const COST_PER_1K_TOKENS = 0.00015;

export interface AgentConfig {
  id: string;
  role: string;
  systemPrompt: string;
  tools: Record<string, CoreTool>;
  maxIterations?: number;
}

const MIN_CONTENT_LENGTH = 150;
const PLACEHOLDER_PATTERNS = [
  /\[INSERT\b/i,
  /\{TODO\b/i,
  /placeholder/i,
  /lorem ipsum/i,
  /TBD\b/,
];

export function validateContent(content: string): { valid: boolean; reason?: string } {
  if (content.length < MIN_CONTENT_LENGTH) {
    return { valid: false, reason: `Content too short (${content.length} chars, min ${MIN_CONTENT_LENGTH})` };
  }
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(content)) {
      return { valid: false, reason: `Placeholder detected: ${pattern.source}` };
    }
  }
  return { valid: true };
}

export interface PhaseConfig extends AgentConfig {
  phasePrompt: string;
}

export async function runAgent(config: AgentConfig): Promise<string> {
  return runAgentPhase({
    ...config,
    phasePrompt: `You are the ${config.role} agent. Begin your work loop now.`,
  });
}

export async function runAgentPhase(config: PhaseConfig): Promise<string> {
  const logger = new AgentLogger(config.id);
  const maxIter = config.maxIterations ?? 10;
  const controller = new AbortController();
  let runningCost = 0;

  logger.decision(`Starting ${config.role} agent`, config.phasePrompt.slice(0, 200));

  try {
    const result = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      system: config.systemPrompt,
      prompt: config.phasePrompt,
      tools: config.tools,
      maxSteps: maxIter,
      abortSignal: controller.signal,
      onStepFinish(step) {
        const stepCost = (step.usage.totalTokens / 1000) * COST_PER_1K_TOKENS;
        runningCost += stepCost;
        for (const call of step.toolCalls) {
          logger.toolCall(call.toolName, call.args as Record<string, unknown>, {}, stepCost / Math.max(1, step.toolCalls.length));
        }
        if (runningCost > MAX_BUDGET_USD) {
          logger.guardrail("BUDGET_EXCEEDED", { spent: runningCost, limit: MAX_BUDGET_USD });
          controller.abort();
        }
      },
    });

    const output = result.text;
    logger.result(`Agent completed after ${result.steps.length} steps`, {
      text: output.slice(0, 500),
      steps: result.steps.length,
      totalCost: runningCost,
    });

    logger.setFinalOutput({ text: output, steps: result.steps.length, totalCost: runningCost });
    logger.save();

    return output;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.guardrail("BUDGET_ABORT", { spent: runningCost, limit: MAX_BUDGET_USD });
      logger.setFinalOutput({ aborted: true, reason: "budget_exceeded", spent: runningCost });
      logger.save();
      return `[Budget exceeded: $${runningCost.toFixed(4)} of $${MAX_BUDGET_USD} limit]`;
    }
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(msg);
    logger.save();
    throw err;
  }
}
