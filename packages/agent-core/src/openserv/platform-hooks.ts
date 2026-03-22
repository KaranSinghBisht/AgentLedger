import type { Agent } from "@openserv-labs/sdk";

interface TaskContext {
  workspaceId: number | string;
  taskId: number | string;
  agentId: number;
}

function getTaskContext(action: unknown): TaskContext | null {
  if (!action || typeof action !== "object") return null;
  const a = action as Record<string, unknown>;
  if (a.type !== "do-task") return null;
  const workspace = a.workspace as Record<string, unknown> | undefined;
  const task = a.task as Record<string, unknown> | undefined;
  const me = a.me as Record<string, unknown> | undefined;
  if (!workspace?.id || !task?.id || !me?.id) return null;
  return { workspaceId: workspace.id as number | string, taskId: task.id as number | string, agentId: me.id as number };
}

export async function logToWorkspace(
  agent: Agent,
  action: unknown,
  severity: "info" | "warning" | "error",
  body: string,
): Promise<void> {
  const ctx = getTaskContext(action);
  if (!ctx) return;
  try {
    await agent.addLogToTask({
      workspaceId: ctx.workspaceId,
      taskId: ctx.taskId,
      severity,
      type: "text",
      body,
    });
  } catch {
    /* graceful fallback — platform API unavailable */
  }
}

export async function uploadToWorkspace(
  agent: Agent,
  action: unknown,
  path: string,
  content: string,
): Promise<string | null> {
  const ctx = getTaskContext(action);
  if (!ctx) return null;
  try {
    const result = await agent.uploadFile({
      workspaceId: ctx.workspaceId,
      path,
      file: content,
      taskIds: [ctx.taskId],
    });
    return result.fullUrl;
  } catch {
    return null;
  }
}

export async function createWorkspaceTask(
  agent: Agent,
  action: unknown,
  description: string,
  body: string,
): Promise<number | null> {
  const ctx = getTaskContext(action);
  if (!ctx) return null;
  try {
    const result = await agent.createTask({
      workspaceId: ctx.workspaceId,
      assignee: ctx.agentId,
      description,
      body,
      input: "",
      expectedOutput: "",
      dependencies: [],
    });
    return result.id;
  } catch {
    return null;
  }
}
