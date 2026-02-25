import { Server as SocketIOServer } from "socket.io";
import { join } from "path";
import { existsSync, mkdirSync, cpSync } from "fs";
import { prisma } from "@forgeai/db";
import { Orchestrator, type SandboxInterface } from "@forgeai/agents";
import type { ReviewReport, DeployResult } from "@forgeai/agents";
import { sandboxManager } from "../sandbox/manager";
import type { AgentPlan, AgentStep, CodeChange } from "@forgeai/shared";

// Map of project ID → AbortController for stopping agent execution
export const agentAbortControllers = new Map<string, AbortController>();

function emit(io: SocketIOServer, room: string, type: string, data: any) {
  io.to(room).emit("event", { type, data });
}

async function createSnapshotAndNotify(
  io: SocketIOServer,
  room: string,
  projectId: string,
  label: string,
  sandboxId: string
) {
  const fileTree = await sandboxManager.getFileTree(sandboxId);

  // Read all file contents for full snapshot
  const fileContents: Record<string, string> = {};
  const walkTree = async (nodes: any[]) => {
    for (const node of nodes) {
      if (node.type === "file") {
        try {
          fileContents[node.path] = await sandboxManager.readFile(sandboxId, node.path);
        } catch { /* skip binary files */ }
      }
      if (node.children) await walkTree(node.children);
    }
  };
  await walkTree(fileTree);

  const snapshot = await prisma.snapshot.create({
    data: {
      projectId,
      label,
      files: fileContents,
    },
  });

  emit(io, room, "snapshot:created", {
    snapshot: {
      id: snapshot.id,
      projectId: snapshot.projectId,
      label: snapshot.label,
      createdAt: snapshot.createdAt.toISOString(),
    },
  });

  return snapshot;
}

export function getSandboxInterface(sandboxId: string): SandboxInterface {
  return {
    executeCommand: (cmd: string) => sandboxManager.executeCommand(sandboxId, cmd),
    writeFile: (path: string, content: string) => sandboxManager.writeFile(sandboxId, path, content),
    readFile: (path: string) => sandboxManager.readFile(sandboxId, path),
    deleteFile: (path: string) => sandboxManager.deleteFile(sandboxId, path),
    getFileTree: () => sandboxManager.getFileTree(sandboxId),
  };
}

export async function runAgent(
  projectId: string,
  userMessage: string,
  io: SocketIOServer
): Promise<void> {
  const room = `project:${projectId}`;
  const controller = new AbortController();
  agentAbortControllers.set(projectId, controller);

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found");

    let sandboxId = project.sandboxId;
    if (!sandboxId) {
      emit(io, room, "sandbox:status", { status: "creating" });

      const sandbox = await sandboxManager.createSandbox(projectId, project.framework);
      sandboxId = sandbox.containerId;

      await prisma.project.update({
        where: { id: projectId },
        data: { sandboxId },
      });

      // Stream dev server output via WebSocket
      sandboxManager.onDevServerOutput(projectId, (output: string) => {
        emit(io, room, "sandbox:terminal_output", { output });
      });

      emit(io, room, "sandbox:status", { status: "running" });
    } else {
      sandboxManager.resetTTL(projectId);
      // Ensure sandbox dev server is still running before proceeding
      await sandboxManager.ensureSandboxRunning(projectId);
    }

    // Build project context
    const fileTree = await sandboxManager.getFileTree(sandboxId);
    let projectContext = `Framework: ${project.framework}\n`;
    if (project.customInstructions) {
      projectContext += `\n--- Custom Instructions ---\n${project.customInstructions}\n--- End Custom Instructions ---\n\n`;
    }
    projectContext += `Project files:\n`;
    projectContext += JSON.stringify(fileTree, null, 2);

    for (const file of ["package.json", "src/App.tsx", "src/main.tsx"]) {
      try {
        const content = await sandboxManager.readFile(sandboxId, file);
        projectContext += `\n\n--- ${file} ---\n${content}`;
      } catch { /* skip */ }
    }

    const sandboxInterface = getSandboxInterface(sandboxId);

    // Create snapshot before changes
    await createSnapshotAndNotify(
      io, room, projectId,
      `Before: ${userMessage.slice(0, 50)}`,
      sandboxId
    );

    // Run orchestrator with all agent callbacks
    const orchestrator = new Orchestrator();
    const allCodeChanges: CodeChange[] = [];

    await orchestrator.run(
      userMessage,
      projectContext,
      sandboxInterface,
      {
        onThinking: (content) => emit(io, room, "agent:thinking", { content }),
        onPlan: (plan: AgentPlan) => emit(io, room, "agent:plan", { plan }),
        onStepStart: (step: AgentStep) => emit(io, room, "agent:step_start", { step }),
        onStepComplete: (step: AgentStep) => emit(io, room, "agent:step_complete", { step }),
        onStepMessage: (message: string) => {
          emit(io, room, "agent:step_message", { message });
        },
        onCodeChange: (change: CodeChange) => {
          allCodeChanges.push(change);
          emit(io, room, "agent:code_change", { change });
        },
        onFileChanged: (path: string) => emit(io, room, "sandbox:file_changed", { path }),
        onTerminalOutput: (output) => emit(io, room, "agent:terminal_output", { output }),
        onError: (message) => emit(io, room, "agent:error", { message }),
        onComplete: async (summary) => {
          await prisma.message.create({
            data: {
              projectId,
              role: "ASSISTANT",
              content: summary,
              codeChanges: JSON.stringify(allCodeChanges),
            },
          });
          emit(io, room, "agent:complete", { summary });
        },
        onPreviewReload: () => emit(io, room, "preview:reload", {}),
        onDesignerStart: () => emit(io, room, "agent:designer_start", {}),
        onDesignerComplete: () => emit(io, room, "agent:designer_complete", {}),
        onDebuggerStart: () => emit(io, room, "agent:debugger_start", {}),
        onDebuggerFix: (explanation) => emit(io, room, "agent:debugger_fix", { explanation }),
        onDebuggerFailed: (error) => emit(io, room, "agent:debugger_failed", { error }),
        onReviewerStart: () => emit(io, room, "agent:reviewer_start", {}),
        onReviewerReport: (report: ReviewReport) => emit(io, room, "agent:reviewer_report", { report }),
        onDeployStart: () => emit(io, room, "agent:deploy_start", {}),
        onDeployComplete: (result: DeployResult) => emit(io, room, "agent:deploy_complete", { url: result.url, buildTime: result.buildTime }),
        onDeployFailed: (error) => emit(io, room, "agent:deploy_failed", { error }),
      },
      controller.signal
    );
  } finally {
    agentAbortControllers.delete(projectId);
  }
}

export async function runDeploy(
  projectId: string,
  io: SocketIOServer
): Promise<{ url: string | null; success: boolean }> {
  const room = `project:${projectId}`;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || !project.sandboxId) throw new Error("Project or sandbox not found");

  const sandboxInterface = getSandboxInterface(project.sandboxId);
  const orchestrator = new Orchestrator();

  const result = await orchestrator.deploy(sandboxInterface, projectId, {
    onThinking: (content) => emit(io, room, "agent:thinking", { content }),
    onPlan: () => {},
    onStepStart: () => {},
    onStepComplete: () => {},
    onStepMessage: () => {},
    onCodeChange: () => {},
    onFileChanged: () => {},
    onTerminalOutput: (output) => emit(io, room, "agent:terminal_output", { output }),
    onError: (message) => emit(io, room, "agent:error", { message }),
    onComplete: () => {},
    onPreviewReload: () => {},
    onDesignerStart: () => {},
    onDesignerComplete: () => {},
    onDebuggerStart: () => {},
    onDebuggerFix: () => {},
    onDebuggerFailed: () => {},
    onReviewerStart: () => {},
    onReviewerReport: () => {},
    onDeployStart: () => emit(io, room, "agent:deploy_start", {}),
    onDeployComplete: (r: DeployResult) => emit(io, room, "agent:deploy_complete", { url: r.url, buildTime: r.buildTime }),
    onDeployFailed: (error) => emit(io, room, "agent:deploy_failed", { error }),
  });

  if (result.success) {
    // Copy dist/ from sandbox workspace to deploys directory
    const workspaceDir = sandboxManager.getWorkspaceDir(project.sandboxId);
    if (workspaceDir) {
      const distDir = join(workspaceDir, "dist");
      const projectDeployDir = join(process.cwd(), "deploys", projectId);

      if (existsSync(distDir)) {
        if (!existsSync(projectDeployDir)) {
          mkdirSync(projectDeployDir, { recursive: true });
        }
        cpSync(distDir, projectDeployDir, { recursive: true });
      }
    }

    const baseUrl = process.env.API_URL || process.env.APP_URL || `http://localhost:${process.env.PORT || 8000}`;
    const deployUrl = `${baseUrl}/preview/${projectId}/`;
    const subdomain = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "DEPLOYED", deployUrl, subdomain },
    });

    return { url: deployUrl, success: true };
  }

  return { url: result.url, success: result.success };
}
