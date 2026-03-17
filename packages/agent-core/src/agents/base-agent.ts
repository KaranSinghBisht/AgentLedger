import { generateText, type CoreTool } from "ai";
import { google } from "@ai-sdk/google";
import { AgentLogger } from "../logging/agent-logger.js";

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

  logger.decision(`Starting ${config.role} agent`, config.phasePrompt.slice(0, 200));

  try {
    const result = await generateText({
      model: google("gemini-2.0-flash"),
      system: config.systemPrompt,
      prompt: config.phasePrompt,
      tools: config.tools,
      maxSteps: maxIter,
    });

    const output = result.text;
    logger.result(`Agent completed after ${result.steps.length} steps`, {
      text: output.slice(0, 500),
      steps: result.steps.length,
    });

    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        logger.toolCall(call.toolName, call.args as Record<string, unknown>, {});
      }
    }

    logger.setFinalOutput({ text: output, steps: result.steps.length });
    logger.save();

    return output;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(msg);
    logger.save();
    throw err;
  }
}
