import { Server as SocketIOServer } from "socket.io";
import { prisma, Prisma } from "@forgeai/db";
import { logger } from "../lib/logger";
import { modelRouter } from "./model-router";
import { AgentFactory } from "./agents/agent-factory";
import type { AgentContext, PlanStep } from "./agents/base-agent";

// ══════════════════════════════════════════════════════════════════
// ENHANCED PLANNER PROMPT
// ══════════════════════════════════════════════════════════════════

const ENHANCED_PLANNER_PROMPT = `Eres el Orchestrator de Arya AI, una plataforma de agentes autónomos enterprise-grade.

Tu trabajo es analizar el objetivo del usuario y crear un plan de ejecución ÓPTIMO.

AGENTES DISPONIBLES:
- coder: Escribe/edita código, crea apps, APIs, componentes. Usa terminal y filesystem.
- research: Investiga temas, analiza competidores, genera reportes con datos.
- designer: Diseña UI/UX, crea design systems, genera CSS/estilos.
- analyst: Analiza datos, crea visualizaciones, genera insights estadísticos.
- writer: Redacta contenido profesional, blog posts, emails, docs. Bilingüe ES/EN.
- deploy: Despliega apps, configura hosting, CI/CD, SSL, DNS.
- qa: Testing, code review, auditoría de seguridad, linting.

REGLAS DE PLANIFICACIÓN:
1. Identifica qué agentes se necesitan (no uses agentes innecesarios)
2. Minimiza el número de pasos (3-8 máximo)
3. PARALELIZA: pasos sin dependencias entre sí deben tener dependsOn vacío para ejecutarse en paralelo
4. Research SIEMPRE va primero si se necesita contexto
5. QA SIEMPRE va al final si hay código
6. Deploy SIEMPRE es el último paso
7. Un agente puede recibir los resultados de agentes previos como contexto
8. Sé ESPECÍFICO en las descripciones — el agente necesita saber exactamente qué hacer

RESPONDE SOLO con JSON válido:
{
  "analysis": "Análisis de 2-3 líneas de lo que el usuario quiere",
  "complexity": "low|medium|high",
  "estimatedTime": "5min|15min|30min|1hr|2hr",
  "steps": [
    {
      "order": 1,
      "title": "Título corto y claro",
      "description": "Descripción detallada de exactamente qué debe hacer el agente",
      "agentType": "coder|research|designer|analyst|writer|deploy|qa",
      "dependsOn": [],
      "estimatedDuration": "2min",
      "priority": "critical|high|medium|low",
      "inputContext": "Qué información necesita este paso de pasos anteriores"
    }
  ]
}`;

// ══════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════

interface PlannerResponse {
  analysis: string;
  complexity?: string;
  estimatedTime?: string;
  steps: Array<PlanStep>;
}

interface TaskRecord {
  id: string;
  title: string;
  agentType: string;
  status: string;
  order: number;
}

export interface PlanResult {
  analysis: string;
  complexity: string;
  estimatedTime: string;
  planSteps: PlanStep[];
  tasks: TaskRecord[];
}

// ══════════════════════════════════════════════════════════════════
// ORCHESTRATOR — Smart planning + parallel execution
// ══════════════════════════════════════════════════════════════════

export class EngineOrchestrator {
  private projectId: string;
  private io: SocketIOServer;
  private signal: AbortSignal;
  private originalPrompt: string = "";

  constructor(projectId: string, io: SocketIOServer, signal: AbortSignal) {
    this.projectId = projectId;
    this.io = io;
    this.signal = signal;
  }

  // ── Phase 1: Plan ──────────────────────────────────────────────

  async plan(prompt: string): Promise<PlanResult> {
    this.originalPrompt = prompt;

    // Update status to planning
    await prisma.project.update({
      where: { id: this.projectId },
      data: { engineStatus: "planning" },
    });

    this.emit("engine:started", { projectId: this.projectId, status: "planning" });
    this.emitActivity("thinking", { message: "Analyzing request and creating execution plan..." });

    // Build planner input with project context
    const plannerInput = await this.buildPlannerInput(prompt);

    // Call LLM planner
    const { parsed, parseError } = await modelRouter.callModelForJSON<PlannerResponse>(
      "planner",
      ENHANCED_PLANNER_PROMPT,
      [{ role: "user", content: plannerInput }],
      this.signal
    );

    if (this.signal.aborted) {
      throw new Error("Engine was stopped");
    }

    // Parse and validate the plan
    let planSteps: PlanStep[];
    let analysis: string;
    let complexity: string;
    let estimatedTime: string;

    if (parsed && parsed.steps && parsed.steps.length > 0) {
      planSteps = this.validatePlan(parsed.steps);
      analysis = parsed.analysis || "Plan created";
      complexity = parsed.complexity || "medium";
      estimatedTime = parsed.estimatedTime || "15min";
    } else {
      logger.warn({ parseError }, "Planner: falling back to default plan");
      planSteps = this.getDefaultPlan(prompt);
      analysis = "Plan created (default)";
      complexity = "medium";
      estimatedTime = "15min";
    }

    // Create task records in DB
    const tasks = await this.createTasks(planSteps, prompt);

    // Store plan in project
    await prisma.project.update({
      where: { id: this.projectId },
      data: { planSteps: planSteps as unknown as Prisma.InputJsonValue },
    });

    this.emit("engine:plan_update", {
      planSteps,
      tasks,
      analysis,
      complexity,
      estimatedTime,
    });

    return { analysis, complexity, estimatedTime, planSteps, tasks };
  }

  // ── Phase 2: Execute ───────────────────────────────────────────

  async execute(planSteps: PlanStep[], tasks: TaskRecord[]): Promise<void> {
    const taskMap = new Map(tasks.map((t) => [t.order, t]));
    const completed = new Set<number>();
    const failed = new Set<number>();
    let remaining = [...planSteps];

    // Update active agents for initial parallel batch
    const initialReady = remaining.filter((s) => s.dependsOn.length === 0);
    await prisma.project.update({
      where: { id: this.projectId },
      data: {
        engineStatus: "running",
        activeAgents: initialReady.map((s) => ({
          type: s.agentType,
          taskId: taskMap.get(s.order)?.id,
        })) as unknown as Prisma.InputJsonValue,
      },
    });

    this.emit("engine:status_change", { status: "running" });

    try {
      while (remaining.length > 0) {
        if (this.signal.aborted) {
          await this.setEngineStatus("idle");
          return;
        }

        // Check if paused
        await this.waitIfPaused();
        if (this.signal.aborted) return;

        // Find steps whose dependencies are all satisfied
        const ready = remaining.filter((step) =>
          step.dependsOn.every((dep) => completed.has(dep)) &&
          !failed.has(step.order)
        );

        if (ready.length === 0) {
          // Check for unsatisfiable dependencies (dep failed → cancel dependents)
          const blocked = remaining.filter((step) =>
            step.dependsOn.some((dep) => failed.has(dep))
          );

          if (blocked.length > 0) {
            // Cancel tasks blocked by failures
            for (const step of blocked) {
              const task = taskMap.get(step.order);
              if (task) {
                await this.cancelTask(task.id, "Dependency failed");
                failed.add(step.order);
              }
            }
            remaining = remaining.filter((s) => !failed.has(s.order) && !completed.has(s.order));
            continue;
          }

          // Deadlock protection — force-complete remaining
          remaining.forEach((s) => completed.add(s.order));
          break;
        }

        // Update active agents display
        await prisma.project.update({
          where: { id: this.projectId },
          data: {
            activeAgents: ready.map((s) => ({
              type: s.agentType,
              taskId: taskMap.get(s.order)?.id,
            })) as unknown as Prisma.InputJsonValue,
          },
        });

        // Execute ready tasks IN PARALLEL
        const results = await Promise.allSettled(
          ready.map(async (step) => {
            const task = taskMap.get(step.order);
            if (!task) return;

            try {
              await this.executeTask(task.id, step);
              completed.add(step.order);
            } catch (err) {
              failed.add(step.order);
              const isCritical = step.priority === "critical";
              if (isCritical) {
                logger.error({ err, step: step.title }, "Critical task failed — cancelling dependents");
              }
            }
          })
        );

        remaining = remaining.filter((s) => !completed.has(s.order) && !failed.has(s.order));
      }

      // ── Determine final status ───────────────────────────────
      if (!this.signal.aborted) {
        const finalStatus = failed.size > 0 ? "completed" : "completed";
        await prisma.project.update({
          where: { id: this.projectId },
          data: { engineStatus: finalStatus, activeAgents: Prisma.DbNull },
        });

        await this.logActivity("agent_complete", {
          message: failed.size > 0
            ? `Completed with ${failed.size} failed task(s)`
            : "All tasks completed",
          completedCount: completed.size,
          failedCount: failed.size,
        });

        this.emit("engine:completed", { projectId: this.projectId, failed: failed.size });
        this.emit("engine:status_change", { status: "completed" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(err, "Engine execution error");

      await prisma.project.update({
        where: { id: this.projectId },
        data: { engineStatus: "failed", activeAgents: Prisma.DbNull },
      }).catch(() => {});

      await this.logActivity("error", { message }).catch(() => {});
      this.emit("engine:failed", { projectId: this.projectId, error: message });
    }
  }

  // ── Execute Single Task ────────────────────────────────────────

  private async executeTask(taskId: string, step: PlanStep): Promise<void> {
    const startTime = Date.now();

    try {
      // Mark as running
      const taskModel = modelRouter.getModelName(step.agentType);
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "running", startedAt: new Date(), modelUsed: taskModel },
      });

      this.emit("engine:task:started", {
        projectId: this.projectId,
        taskId,
        agentType: step.agentType,
        title: step.title,
      });

      await this.logActivity("plan_step", {
        step: step.title,
        status: "running",
      }, { taskId, agentType: step.agentType });

      // Gather dependency results
      const dependencyContext = await this.gatherDependencyResults(step);

      // Create agent context and execute
      const agentCtx: AgentContext = {
        projectId: this.projectId,
        taskId,
        step,
        originalPrompt: this.originalPrompt,
        dependencyContext,
        io: this.io,
        signal: this.signal,
      };

      const agent = AgentFactory.create(step.agentType, agentCtx);
      const agentResult = await agent.execute();

      // Mark completed
      const durationMs = Date.now() - startTime;
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "completed", completedAt: new Date(), durationMs },
      });

      // Include resultSummary in completion event for the frontend
      this.emit("engine:task:completed", {
        projectId: this.projectId,
        taskId,
        durationMs,
        resultSummary: agentResult.resultSummary || null,
      });

      await this.logActivity("agent_complete", {
        taskTitle: step.title,
        durationMs,
        resultSummary: agentResult.resultSummary || null,
      }, { taskId, agentType: step.agentType });

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startTime;

      await prisma.task.update({
        where: { id: taskId },
        data: { status: "failed", completedAt: new Date(), durationMs, errorMessage: message },
      });

      this.emit("engine:task:failed", { projectId: this.projectId, taskId, error: message });

      await this.logActivity("error", {
        taskTitle: step.title,
        error: message,
      }, { taskId, agentType: step.agentType });

      throw err;
    }
  }

  // ── Dependency Result Passing ──────────────────────────────────

  private async gatherDependencyResults(step: PlanStep): Promise<string> {
    if (!step.dependsOn || step.dependsOn.length === 0) return "";

    const results: string[] = [];

    // Find tasks matching the dependency orders
    const depTasks = await prisma.task.findMany({
      where: {
        projectId: this.projectId,
        order: { in: step.dependsOn },
        status: "completed",
      },
      select: { title: true, agentType: true, outputResult: true, order: true },
    });

    for (const task of depTasks) {
      if (!task.outputResult) continue;

      const output = typeof task.outputResult === "string"
        ? task.outputResult
        : JSON.stringify(task.outputResult, null, 2);

      results.push(`--- Resultado de "${task.title}" (${task.agentType}) ---\n${output}`);
    }

    return results.length > 0
      ? `\n\nResultado de tareas previas:\n${results.join("\n\n")}`
      : "";
  }

  // ── Plan Helpers ───────────────────────────────────────────────

  private async buildPlannerInput(prompt: string): Promise<string> {
    // Include project context if available
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      select: { framework: true, customInstructions: true, sandboxId: true },
    });

    let input = prompt;

    if (project?.framework) {
      input += `\n\n[Contexto del proyecto: Framework=${project.framework}]`;
    }
    if (project?.customInstructions) {
      input += `\n[Instrucciones custom: ${project.customInstructions}]`;
    }
    if (project?.sandboxId) {
      input += `\n[Proyecto existente con sandbox activo — puede ser una iteración]`;
    }

    return input;
  }

  private validatePlan(steps: PlanStep[]): PlanStep[] {
    // Cap at 8 steps
    const capped = steps.slice(0, 8);

    // Ensure orders are sequential
    const validated = capped.map((step, i) => ({
      ...step,
      order: step.order || i + 1,
      dependsOn: step.dependsOn || [],
      estimatedDuration: step.estimatedDuration || "5min",
      priority: step.priority || "medium" as const,
    }));

    // Validate agent types
    const validTypes = new Set(["coder", "research", "designer", "analyst", "writer", "deploy", "qa"]);
    for (const step of validated) {
      if (!validTypes.has(step.agentType)) {
        step.agentType = "coder"; // fallback
      }
    }

    // Validate dependencies exist
    const orderSet = new Set(validated.map((s) => s.order));
    for (const step of validated) {
      step.dependsOn = step.dependsOn.filter((dep) => orderSet.has(dep) && dep !== step.order);
    }

    return validated;
  }

  private getDefaultPlan(prompt: string): PlanStep[] {
    return [
      { order: 1, title: "Analyze requirements", description: `Analyze: ${prompt.slice(0, 200)}`, agentType: "coder", dependsOn: [], estimatedDuration: "2min", priority: "critical" },
      { order: 2, title: "Setup project structure", description: "Install dependencies and create project structure", agentType: "coder", dependsOn: [1], estimatedDuration: "5min", priority: "high" },
      { order: 3, title: "Build core features", description: "Implement the main functionality and components", agentType: "coder", dependsOn: [2], estimatedDuration: "10min", priority: "high" },
      { order: 4, title: "Polish and review", description: "Add styling, error handling, and review code quality", agentType: "qa", dependsOn: [3], estimatedDuration: "5min", priority: "medium" },
    ];
  }

  private async createTasks(planSteps: PlanStep[], prompt: string): Promise<TaskRecord[]> {
    const tasks: TaskRecord[] = [];

    for (const step of planSteps) {
      const task = await prisma.task.create({
        data: {
          projectId: this.projectId,
          agentType: step.agentType,
          title: step.title,
          description: step.description,
          inputPrompt: prompt,
          order: step.order,
          status: "pending",
        },
      });

      tasks.push({
        id: task.id,
        title: task.title,
        agentType: task.agentType,
        status: task.status,
        order: task.order,
      });

      await this.logActivity("agent_spawn", {
        taskTitle: step.title,
        agentType: step.agentType,
        order: step.order,
        priority: step.priority,
      }, { taskId: task.id, agentType: step.agentType });
    }

    return tasks;
  }

  // ── Execution Helpers ──────────────────────────────────────────

  private async waitIfPaused(): Promise<void> {
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      select: { engineStatus: true },
    });

    if (project?.engineStatus !== "paused") return;

    await new Promise<void>((resolve) => {
      const check = setInterval(async () => {
        if (this.signal.aborted) {
          clearInterval(check);
          resolve();
          return;
        }
        const p = await prisma.project.findUnique({
          where: { id: this.projectId },
          select: { engineStatus: true },
        });
        if (p?.engineStatus !== "paused") {
          clearInterval(check);
          resolve();
        }
      }, 2000);
    });
  }

  private async cancelTask(taskId: string, reason: string): Promise<void> {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "cancelled", errorMessage: reason },
    });
    this.emit("engine:task:failed", { projectId: this.projectId, taskId, error: reason });
  }

  private async setEngineStatus(status: string): Promise<void> {
    await prisma.project.update({
      where: { id: this.projectId },
      data: { engineStatus: status, activeAgents: Prisma.DbNull },
    });
  }

  // ── Event Helpers ──────────────────────────────────────────────

  private emit(type: string, data: unknown): void {
    this.io.to(`project:${this.projectId}`).emit("event", { type, data });
  }

  private emitActivity(type: string, content: Record<string, unknown>): void {
    this.emit("engine:activity", { type, content });
    this.logActivity(type, content).catch(() => {});
  }

  private async logActivity(
    type: string,
    content: Record<string, unknown>,
    opts?: { taskId?: string; agentType?: string }
  ): Promise<void> {
    await prisma.activityLog.create({
      data: {
        projectId: this.projectId,
        taskId: opts?.taskId,
        type,
        agentType: opts?.agentType,
        content: content as Prisma.InputJsonValue,
      },
    });
  }
}
