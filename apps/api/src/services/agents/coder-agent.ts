import { Orchestrator } from "@forgeai/agents";
import type { OrchestratorCallbacks, SandboxInterface } from "@forgeai/agents";
import type { CodeChange } from "@forgeai/shared";
import { prisma } from "@forgeai/db";
import { sandboxManager } from "../../sandbox/manager";
import { ProjectSandbox } from "../sandbox";
import { agentRegistry } from "../agent-registry";
import { BaseAgent, type AgentResult, type AgentContext } from "./base-agent";

// ══════════════════════════════════════════════════════════════════
// CODER AGENT — Uses the existing Orchestrator for full code gen
// ══════════════════════════════════════════════════════════════════

export class CoderAgentRunner extends BaseAgent {
  private agentOverlay?: "designer" | "qa";

  constructor(ctx: AgentContext, agentOverlay?: "designer" | "qa") {
    super(ctx);
    this.agentOverlay = agentOverlay;
  }

  getSystemPrompt(): string {
    return agentRegistry.getAgent("coder").systemPrompt;
  }

  /**
   * The coder agent overrides execute() entirely because it delegates
   * to the Orchestrator which has its own plan → code → design → debug loop.
   */
  async execute(): Promise<AgentResult> {
    this.startTime = Date.now();

    const project = await this.getProject();
    if (!project) throw new Error("Project not found");

    // Use ProjectSandbox for initialization
    const projectSandbox = new ProjectSandbox(this.ctx.projectId, this.ctx.io);

    let sandboxId = project.sandboxId;
    if (!sandboxId) {
      this.emitThinking("Creating sandbox environment...");
      sandboxId = await projectSandbox.init(project.framework);

      projectSandbox.onDevServerOutput((output: string) => {
        this.emit("engine:activity", {
          type: "terminal_cmd",
          content: { output },
        });
      });
    } else {
      projectSandbox.attach(sandboxId);
      sandboxManager.resetTTL(this.ctx.projectId);
      await sandboxManager.ensureSandboxRunning(this.ctx.projectId);
    }

    const sandboxInterface = this.buildSandboxInterface(sandboxId);

    // Build task prompt
    let taskPrompt = this.ctx.step.description;

    if (this.agentOverlay === "designer") {
      taskPrompt = `[MODO DISEÑADOR] Enfócate en aspectos visuales, UX/UI, estilos, y diseño.\n\n${taskPrompt}`;
    } else if (this.agentOverlay === "qa") {
      taskPrompt = `[MODO QA] Enfócate en testing, revisión de código, manejo de errores, y calidad.\n\n${taskPrompt}`;
    }

    taskPrompt += `\n\nOriginal user request: ${this.ctx.originalPrompt}`;
    if (this.ctx.dependencyContext) {
      taskPrompt += this.ctx.dependencyContext;
    }

    // Build project context
    const fileTree = await sandboxManager.getFileTree(sandboxId);
    let projectContext = `Framework: ${project.framework}\n`;
    if (project.customInstructions) {
      projectContext += `\n--- Custom Instructions ---\n${project.customInstructions}\n--- End Custom Instructions ---\n\n`;
    }
    projectContext += `Project files:\n${JSON.stringify(fileTree, null, 2)}`;

    for (const file of ["package.json", "src/App.tsx", "src/main.tsx"]) {
      const content = await this.readProjectFile(sandboxId, file);
      if (content) {
        projectContext += `\n\n--- ${file} ---\n${content}`;
      }
    }

    // Run Orchestrator
    const orchestrator = new Orchestrator();
    const callbacks = this.buildOrchestratorCallbacks();

    await orchestrator.run(taskPrompt, projectContext, sandboxInterface, callbacks, this.ctx.signal);

    return {
      thinking: `Coder agent completed: ${this.ctx.step.title}`,
      status: "completed",
    };
  }

  // These are required by the abstract class but not used since we override execute()
  async prepareContext() { return {}; }
  buildMessages() { return []; }
  async processResponse() { return { thinking: "", status: "completed" }; }

  // ── Helpers ─────────────────────────────────────────────────────

  private buildSandboxInterface(sandboxId: string): SandboxInterface {
    return {
      executeCommand: (cmd: string) => sandboxManager.executeCommand(sandboxId, cmd),
      writeFile: (path: string, content: string) => sandboxManager.writeFile(sandboxId, path, content),
      readFile: (path: string) => sandboxManager.readFile(sandboxId, path),
      deleteFile: (path: string) => sandboxManager.deleteFile(sandboxId, path),
      getFileTree: () => sandboxManager.getFileTree(sandboxId),
      getPreviewUrl: () => sandboxManager.getPreviewUrl(sandboxId),
    };
  }

  private buildOrchestratorCallbacks(): OrchestratorCallbacks {
    const { projectId, taskId, step, io } = this.ctx;

    return {
      onThinking: (content) => {
        this.emitActivity("thinking", { message: content });
      },
      onPlan: (plan) => {
        this.emit("engine:activity", {
          type: "plan_step",
          taskId,
          content: { plan },
        });
      },
      onStepStart: (agentStep) => {
        this.emit("engine:activity", {
          type: "plan_step",
          taskId,
          content: { step: agentStep.description, status: "running" },
        });
      },
      onStepComplete: (agentStep) => {
        this.emit("engine:activity", {
          type: "plan_step",
          taskId,
          content: { step: agentStep.description, status: "completed" },
        });
      },
      onStepMessage: (message) => {
        this.emitActivity("agent_message", { message });
      },
      onCodeChange: (change: CodeChange) => {
        this.emitActivity("file_change", {
          action: change.action,
          path: change.file,
          diff: change.diff,
        });
      },
      onFileChanged: (path) => {
        this.emit("sandbox:file_changed", { path });
        this.emit("sandbox:file_tree_update", { projectId });
      },
      onTerminalOutput: (output) => {
        this.emitActivity("terminal_cmd", { output: output.slice(0, 1000) });
      },
      onError: (message) => {
        this.emitActivity("error", { message });
      },
      onComplete: async (summary) => {
        await prisma.task.update({
          where: { id: taskId },
          data: { outputResult: { summary } },
        });
      },
      onPreviewReload: () => this.emit("preview:reload", {}),
      onDesignerStart: () => this.emit("engine:activity", { type: "agent_spawn", taskId, content: { agentType: "designer" } }),
      onDesignerComplete: () => this.emit("engine:activity", { type: "agent_complete", taskId, content: { agentType: "designer" } }),
      onDebuggerStart: () => this.emit("engine:activity", { type: "agent_spawn", taskId, content: { agentType: "debugger" } }),
      onDebuggerFix: (explanation) => this.emit("engine:activity", { type: "agent_message", taskId, content: { message: explanation, agentType: "debugger" } }),
      onDebuggerFailed: (error) => this.emit("engine:activity", { type: "error", taskId, content: { message: error, agentType: "debugger" } }),
      onReviewerStart: () => this.emit("engine:activity", { type: "agent_spawn", taskId, content: { agentType: "reviewer" } }),
      onReviewerReport: (report) => this.emit("engine:activity", { type: "agent_message", taskId, content: { report } }),
      onDeployStart: () => this.emit("engine:activity", { type: "agent_spawn", taskId, content: { agentType: "deployer" } }),
      onDeployComplete: (result) => this.emit("engine:activity", { type: "agent_complete", taskId, content: { url: result.url, buildTime: result.buildTime } }),
      onDeployFailed: (error) => this.emit("engine:activity", { type: "error", taskId, content: { message: error, agentType: "deployer" } }),
    };
  }
}
