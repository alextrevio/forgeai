import { Server as SocketIOServer } from "socket.io";
import { prisma, Prisma } from "@forgeai/db";
import { logger } from "../../lib/logger";
import { modelRouter } from "../model-router";
import { sandboxManager } from "../../sandbox/manager";
import { ProjectSandbox } from "../sandbox";

// ══════════════════════════════════════════════════════════════════
// SHARED TYPES
// ══════════════════════════════════════════════════════════════════

export interface AgentAction {
  type: "create_file" | "modify_file" | "terminal" | "message" | "config_file" | "design_spec";
  path?: string;
  content?: string;
  search?: string;
  replace?: string;
  command?: string;
  text?: string;
  component?: string;
  spec?: Record<string, unknown>;
}

export interface AgentResult {
  thinking: string;
  actions?: AgentAction[];
  status: string;
  outputData?: Record<string, unknown>;
  /** Structured summary for display in frontend */
  resultSummary?: ResultSummary;
}

export interface ResultSummary {
  /** One-line human-readable summary */
  oneLiner: string;
  /** Key metrics: "5 findings", "3 files created", etc. */
  metrics?: Array<{ label: string; value: string | number }>;
  /** Type of result for frontend rendering */
  type: "research" | "code" | "design" | "analysis" | "content" | "deploy" | "qa" | "generic";
}

export interface DependencyResult {
  taskId: string;
  agentType: string;
  title: string;
  outputData: Record<string, unknown>;
  resultSummary?: ResultSummary;
}

export interface PlanStep {
  order: number;
  title: string;
  description: string;
  agentType: string;
  dependsOn: number[];
  estimatedDuration: string;
  priority?: "critical" | "high" | "medium" | "low";
  inputContext?: string;
}

export interface AgentContext {
  projectId: string;
  taskId: string;
  step: PlanStep;
  originalPrompt: string;
  dependencyContext: string;
  io: SocketIOServer;
  signal: AbortSignal;
  userId?: string;
}

// ══════════════════════════════════════════════════════════════════
// BASE AGENT — Template method pattern
// ══════════════════════════════════════════════════════════════════

export abstract class BaseAgent {
  protected ctx: AgentContext;
  protected startTime: number = 0;

  constructor(ctx: AgentContext) {
    this.ctx = ctx;
  }

  // ── Template Method ─────────────────────────────────────────────

  async execute(): Promise<AgentResult> {
    this.startTime = Date.now();

    try {
      // 1. Prepare context
      this.emitThinking(`Preparing: ${this.ctx.step.title}...`);
      const context = await this.prepareContext();

      // 2. Build messages
      const messages = this.buildMessages(context);

      // 3. Call LLM via ModelRouter
      const { parsed, text, model } = await modelRouter.callModelForJSON<Record<string, unknown>>(
        this.ctx.step.agentType,
        this.getSystemPrompt(),
        messages,
        this.ctx.signal,
        this.ctx.userId
      );

      if (this.ctx.signal.aborted) {
        return { thinking: "Aborted", status: "cancelled" };
      }

      // 4. Track token usage
      const userText = messages.map((m) => m.content).join("");
      const estimatedTokens = Math.ceil((userText.length + (text?.length || 0)) / 4);
      await this.updateTokenUsage(estimatedTokens);

      // 5. Process response
      const result = await this.processResponse(parsed, text);

      // 6. Execute actions (subclass may override)
      if (result.actions && result.actions.length > 0) {
        await this.executeActions(result.actions);
      }

      // 7. Store output
      await this.storeOutput(result, model);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitError(message);
      throw error;
    }
  }

  // ── Abstract methods for subclasses ─────────────────────────────

  abstract getSystemPrompt(): string;
  abstract prepareContext(): Promise<Record<string, unknown>>;
  abstract buildMessages(context: Record<string, unknown>): Array<{ role: "user" | "assistant"; content: string }>;
  abstract processResponse(parsed: Record<string, unknown> | null, rawText: string): Promise<AgentResult>;

  // ── Action Execution ────────────────────────────────────────────

  protected async executeActions(actions: AgentAction[]): Promise<void> {
    const sandboxId = await this.getSandboxId();
    let fileTreeChanged = false;

    for (const action of actions) {
      if (this.ctx.signal.aborted) return;

      switch (action.type) {
        case "create_file":
        case "config_file":
          if (action.path && action.content && sandboxId) {
            await sandboxManager.writeFile(sandboxId, action.path, action.content);
            this.emitFileChange("create", action.path);
            fileTreeChanged = true;
          }
          break;

        case "modify_file":
          if (action.path && action.search && action.replace && sandboxId) {
            try {
              const existing = await sandboxManager.readFile(sandboxId, action.path);
              const modified = existing.replace(action.search, action.replace);
              await sandboxManager.writeFile(sandboxId, action.path, modified);
              this.emitFileChange("modify", action.path);
            } catch (err) {
              logger.warn({ err, file: action.path }, "BaseAgent: modify_file failed");
            }
          }
          break;

        case "terminal":
          if (action.command && sandboxId) {
            const output = await this.runCommand(sandboxId, action.command);
            this.emitTerminal(action.command, output);
          }
          break;

        case "message":
          if (action.text) {
            this.emitMessage(action.text);
          }
          break;
      }
    }

    // Emit a single file tree update after all actions complete
    if (fileTreeChanged) {
      this.emit("sandbox:file_tree_update", { projectId: this.ctx.projectId });
    }
  }

  // ── Shared Utilities ────────────────────────────────────────────

  protected async getSandboxId(): Promise<string | null> {
    const project = await prisma.project.findUnique({
      where: { id: this.ctx.projectId },
      select: { sandboxId: true },
    });
    return project?.sandboxId || null;
  }

  protected async getProject() {
    return prisma.project.findUnique({ where: { id: this.ctx.projectId } });
  }

  /**
   * Get a ProjectSandbox instance for the current project.
   * Automatically attaches to existing sandbox if present.
   */
  protected async getProjectSandbox(): Promise<ProjectSandbox> {
    const sandbox = new ProjectSandbox(this.ctx.projectId, this.ctx.io);
    const project = await prisma.project.findUnique({
      where: { id: this.ctx.projectId },
      select: { sandboxId: true },
    });
    if (project?.sandboxId) {
      sandbox.attach(project.sandboxId);
    }
    return sandbox;
  }

  protected async runCommand(sandboxId: string, command: string): Promise<string> {
    try {
      const result = await sandboxManager.executeCommand(sandboxId, command);
      return result.stdout || result.stderr || "";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ err, command }, "BaseAgent: command failed");
      return `Error: ${msg}`;
    }
  }

  protected async getProjectFileTree(sandboxId: string) {
    return sandboxManager.getFileTree(sandboxId);
  }

  protected async readProjectFile(sandboxId: string, path: string): Promise<string | null> {
    try {
      return await sandboxManager.readFile(sandboxId, path);
    } catch {
      return null;
    }
  }

  /**
   * Returns the raw dependency context string passed by the orchestrator.
   */
  protected getDependencyContextRaw(): string {
    return this.ctx.dependencyContext;
  }

  /**
   * Parses structured dependency results from the dependency context.
   * The orchestrator stores JSON blocks in a known format.
   */
  protected parseDependencyResults(): DependencyResult[] {
    if (!this.ctx.dependencyContext) return [];

    const results: DependencyResult[] = [];
    // The orchestrator wraps each result with markers
    const blocks = this.ctx.dependencyContext.split(/---\s*Resultado de "/).slice(1);

    for (const block of blocks) {
      try {
        const titleMatch = block.match(/^(.+?)"\s*\((\w+)\)\s*---\n([\s\S]*)/);
        if (!titleMatch) continue;

        const [, title, agentType, jsonStr] = titleMatch;
        const outputData = JSON.parse(jsonStr.trim());
        results.push({
          taskId: "",
          agentType: agentType.trim(),
          title: title.trim(),
          outputData,
          resultSummary: outputData.resultSummary,
        });
      } catch {
        // Skip malformed blocks
      }
    }

    return results;
  }

  /**
   * Builds a formatted context string from previous agent results,
   * suitable for including in LLM prompts.
   */
  protected buildDependencyPromptSection(): string {
    if (!this.ctx.dependencyContext) return "";
    return this.ctx.dependencyContext;
  }

  protected buildUserMessage(): string {
    let msg = `Tarea: ${this.ctx.step.description}\n\nSolicitud original del usuario: ${this.ctx.originalPrompt}`;

    // Include step-specific input context from the planner
    if (this.ctx.step.inputContext) {
      msg += `\n\nContexto requerido: ${this.ctx.step.inputContext}`;
    }

    // Append dependency results
    if (this.ctx.dependencyContext) {
      msg += this.ctx.dependencyContext;
    }

    return msg;
  }

  // ── DB Updates ──────────────────────────────────────────────────

  protected async updateTokenUsage(tokensUsed: number): Promise<void> {
    if (tokensUsed <= 0) return;
    await prisma.task.update({
      where: { id: this.ctx.taskId },
      data: { tokensUsed },
    });
    await prisma.project.update({
      where: { id: this.ctx.projectId },
      data: { totalTokensUsed: { increment: tokensUsed } },
    });
  }

  protected async storeOutput(result: AgentResult, model: string): Promise<void> {
    const outputData = result.outputData || { thinking: result.thinking, status: result.status };

    // Attach resultSummary into the stored output for later retrieval
    if (result.resultSummary) {
      (outputData as Record<string, unknown>).resultSummary = result.resultSummary;
    }

    await prisma.task.update({
      where: { id: this.ctx.taskId },
      data: {
        outputResult: outputData as unknown as Prisma.InputJsonValue,
        modelUsed: model,
      },
    });

    // Emit result summary via WebSocket so frontend can show it immediately
    if (result.resultSummary) {
      this.emitActivity("task_result", {
        summary: result.resultSummary.oneLiner,
        metrics: result.resultSummary.metrics || [],
        type: result.resultSummary.type,
      });
    }
  }

  // ── WebSocket / Activity Emitters ───────────────────────────────

  protected emit(type: string, data: unknown): void {
    this.ctx.io.to(`project:${this.ctx.projectId}`).emit("event", { type, data });
  }

  protected emitThinking(message: string): void {
    this.emitActivity("thinking", { message });
  }

  protected emitMessage(message: string): void {
    this.emitActivity("agent_message", { message });
  }

  protected emitError(message: string): void {
    this.emitActivity("error", { message });
  }

  protected emitFileChange(action: string, path: string): void {
    this.emitActivity("file_change", { action, path });
    this.emit("sandbox:file_changed", { path });
  }

  protected emitTerminal(command: string, output: string): void {
    this.emitActivity("terminal_cmd", { command, output: output.slice(0, 1000) });
  }

  protected emitActivity(type: string, content: Record<string, unknown>): void {
    this.emit("engine:activity", {
      type,
      taskId: this.ctx.taskId,
      agentType: this.ctx.step.agentType,
      content,
    });

    // Fire-and-forget DB log
    prisma.activityLog.create({
      data: {
        projectId: this.ctx.projectId,
        taskId: this.ctx.taskId,
        type,
        agentType: this.ctx.step.agentType,
        content: content as Prisma.InputJsonValue,
      },
    }).catch(() => {});
  }
}
