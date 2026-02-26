import { Server as SocketIOServer } from "socket.io";
import { prisma, Prisma } from "@forgeai/db";
import {
  Orchestrator,
  PlannerAgent,
  callLLMForJSON,
} from "@forgeai/agents";
import type { OrchestratorCallbacks, SandboxInterface } from "@forgeai/agents";
import type { AgentPlan, AgentStep, CodeChange } from "@forgeai/shared";
import { sandboxManager } from "../sandbox/manager";
import { logger } from "../lib/logger";

// ── Planner System Prompt (Arya Engine) ──────────────────────────

const ENGINE_PLANNER_PROMPT = `Eres el Planner de Arya AI, una plataforma de agentes autónomos.
Tu trabajo es analizar lo que el usuario quiere lograr y crear un plan de ejecución estructurado.

Debes responder SOLO con un JSON válido con esta estructura:
{
  "analysis": "Breve análisis de lo que el usuario quiere",
  "steps": [
    {
      "order": 1,
      "title": "Título del paso",
      "description": "Qué debe hacer este paso",
      "agentType": "coder|research|designer|analyst|writer|deploy|qa",
      "dependsOn": [],
      "estimatedDuration": "2min|5min|10min|30min|1hr"
    }
  ]
}

Tipos de agente disponibles:
- coder: Escribe, edita y debuggea código. Crea apps, APIs, componentes.
- research: Busca información en la web, analiza competidores, genera reportes.
- designer: Crea mockups, sugiere diseños, genera assets visuales.
- analyst: Analiza datos, crea visualizaciones, genera insights.
- writer: Redacta contenido, emails, documentos, blog posts.
- deploy: Configura hosting, deploya apps, gestiona infraestructura.
- qa: Revisa código, ejecuta tests, audita seguridad.

Reglas:
1. Genera entre 3 y 8 pasos máximo
2. Identifica correctamente las dependencias (un paso puede depender de otro)
3. Pasos sin dependencias se ejecutarán en paralelo
4. Sé específico en la descripción de cada paso
5. El primer paso suele ser research o planning
6. El último paso suele ser deploy o qa
`;

// ── Types ────────────────────────────────────────────────────────

interface PlannerResult {
  analysis: string;
  steps: Array<{
    order: number;
    title: string;
    description: string;
    agentType: string;
    dependsOn: number[];
    estimatedDuration: string;
  }>;
}

// ── AbortControllers for running engines ──────────────────────────

export const engineAbortControllers = new Map<string, AbortController>();

// ── Helpers ──────────────────────────────────────────────────────

function emit(io: SocketIOServer, projectId: string, type: string, data: unknown) {
  io.to(`project:${projectId}`).emit("event", { type, data });
}

async function logActivity(
  projectId: string,
  type: string,
  content: Record<string, unknown>,
  opts?: { taskId?: string; agentType?: string }
) {
  return prisma.activityLog.create({
    data: {
      projectId,
      taskId: opts?.taskId,
      type,
      agentType: opts?.agentType,
      content: content as Prisma.InputJsonValue,
    },
  });
}

function getSandboxInterface(sandboxId: string): SandboxInterface {
  return {
    executeCommand: (cmd: string) => sandboxManager.executeCommand(sandboxId, cmd),
    writeFile: (path: string, content: string) => sandboxManager.writeFile(sandboxId, path, content),
    readFile: (path: string) => sandboxManager.readFile(sandboxId, path),
    deleteFile: (path: string) => sandboxManager.deleteFile(sandboxId, path),
    getFileTree: () => sandboxManager.getFileTree(sandboxId),
    getPreviewUrl: () => sandboxManager.getPreviewUrl(sandboxId),
  };
}

// ═══════════════════════════════════════════════════════════════════
// START ENGINE — Plan + Create Tasks + Execute
// ═══════════════════════════════════════════════════════════════════

export async function startEngine(
  projectId: string,
  prompt: string,
  io: SocketIOServer
): Promise<{ planSteps: PlannerResult["steps"]; tasks: Array<{ id: string; title: string; agentType: string; status: string; order: number }> }> {
  const controller = new AbortController();
  engineAbortControllers.set(projectId, controller);

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found");

    // ── Phase 1: Planning ───────────────────────────────────────

    await prisma.project.update({
      where: { id: projectId },
      data: { engineStatus: "planning" },
    });

    emit(io, projectId, "engine:started", { projectId, status: "planning" });

    await logActivity(projectId, "thinking", {
      message: "Analyzing request and creating execution plan...",
    });

    emit(io, projectId, "engine:activity", {
      type: "thinking",
      content: { message: "Analyzing request and creating execution plan..." },
    });

    // Call LLM to generate plan
    const { parsed, parseError } = await callLLMForJSON<PlannerResult>(
      "planner",
      ENGINE_PLANNER_PROMPT,
      [{ role: "user", content: prompt }],
      controller.signal
    );

    if (controller.signal.aborted) {
      throw new Error("Engine was stopped");
    }

    let planSteps: PlannerResult["steps"];

    if (parsed && parsed.steps && parsed.steps.length > 0) {
      planSteps = parsed.steps.slice(0, 8); // Max 8 steps
    } else {
      logger.warn({ parseError }, "Planner: falling back to default plan");
      // Fallback plan: use the existing PlannerAgent which has robust fallbacks
      planSteps = [
        { order: 1, title: "Analyze requirements", description: `Analyze: ${prompt.slice(0, 100)}`, agentType: "coder", dependsOn: [], estimatedDuration: "2min" },
        { order: 2, title: "Setup project structure", description: "Install dependencies and create project structure", agentType: "coder", dependsOn: [1], estimatedDuration: "5min" },
        { order: 3, title: "Build core features", description: "Implement the main functionality and components", agentType: "coder", dependsOn: [2], estimatedDuration: "10min" },
        { order: 4, title: "Polish and review", description: "Add styling, error handling, and review code quality", agentType: "qa", dependsOn: [3], estimatedDuration: "5min" },
      ];
    }

    // ── Phase 2: Create Tasks ───────────────────────────────────

    await prisma.project.update({
      where: { id: projectId },
      data: { planSteps: planSteps as unknown as Prisma.InputJsonValue },
    });

    const tasks = [];
    for (const step of planSteps) {
      const task = await prisma.task.create({
        data: {
          projectId,
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

      await logActivity(projectId, "agent_spawn", {
        taskTitle: step.title,
        agentType: step.agentType,
        order: step.order,
      }, { taskId: task.id, agentType: step.agentType });
    }

    emit(io, projectId, "engine:plan_update", {
      planSteps,
      tasks,
      analysis: parsed?.analysis || "Plan created",
    });

    // ── Phase 3: Start execution ────────────────────────────────

    await prisma.project.update({
      where: { id: projectId },
      data: {
        engineStatus: "running",
        activeAgents: tasks
          .filter((t) => t.order === 1 || planSteps.find((s) => s.order === t.order)?.dependsOn.length === 0)
          .map((t) => ({ type: t.agentType, taskId: t.id })) as unknown as Prisma.InputJsonValue,
      },
    });

    emit(io, projectId, "engine:status_change", { status: "running" });

    // Fire-and-forget: execute tasks in dependency order
    executeTasksInOrder(projectId, planSteps, tasks, prompt, io, controller.signal).catch((err) => {
      logger.error(err, "Engine execution error");
      emit(io, projectId, "engine:failed", { projectId, error: String(err) });
    });

    return { planSteps, tasks };

  } catch (err) {
    engineAbortControllers.delete(projectId);
    const message = err instanceof Error ? err.message : String(err);

    await prisma.project.update({
      where: { id: projectId },
      data: { engineStatus: "failed" },
    }).catch(() => {});

    await logActivity(projectId, "error", { message }).catch(() => {});
    emit(io, projectId, "engine:failed", { projectId, error: message });

    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXECUTE TASKS IN DEPENDENCY ORDER
// ═══════════════════════════════════════════════════════════════════

async function executeTasksInOrder(
  projectId: string,
  planSteps: PlannerResult["steps"],
  tasks: Array<{ id: string; title: string; agentType: string; status: string; order: number }>,
  originalPrompt: string,
  io: SocketIOServer,
  signal: AbortSignal
) {
  try {
    // Group tasks by dependency layers
    const taskMap = new Map(tasks.map((t) => [t.order, t]));
    const stepMap = new Map(planSteps.map((s) => [s.order, s]));

    const completed = new Set<number>();
    let remaining = [...planSteps];

    while (remaining.length > 0) {
      if (signal.aborted) {
        await prisma.project.update({
          where: { id: projectId },
          data: { engineStatus: "idle", activeAgents: Prisma.DbNull },
        });
        return;
      }

      // Check if paused
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { engineStatus: true },
      });
      if (project?.engineStatus === "paused") {
        // Wait and poll for resume
        await new Promise<void>((resolve) => {
          const check = setInterval(async () => {
            if (signal.aborted) {
              clearInterval(check);
              resolve();
              return;
            }
            const p = await prisma.project.findUnique({
              where: { id: projectId },
              select: { engineStatus: true },
            });
            if (p?.engineStatus !== "paused") {
              clearInterval(check);
              resolve();
            }
          }, 2000);
        });
        continue;
      }

      // Find steps whose dependencies are satisfied
      const ready = remaining.filter((step) =>
        step.dependsOn.every((dep) => completed.has(dep))
      );

      if (ready.length === 0) {
        // Safety: avoid infinite loop
        remaining.forEach((s) => completed.add(s.order));
        break;
      }

      // Update active agents
      const activeAgents = ready.map((s) => ({
        type: s.agentType,
        taskId: taskMap.get(s.order)?.id,
      }));
      await prisma.project.update({
        where: { id: projectId },
        data: { activeAgents: activeAgents as unknown as Prisma.InputJsonValue },
      });

      // Execute ready tasks in parallel
      await Promise.all(
        ready.map((step) => {
          const task = taskMap.get(step.order);
          if (!task) return Promise.resolve();
          return executeTask(projectId, task.id, step, originalPrompt, io, signal);
        })
      );

      for (const step of ready) {
        completed.add(step.order);
      }
      remaining = remaining.filter((s) => !completed.has(s.order));
    }

    // ── All tasks done ──────────────────────────────────────────
    if (!signal.aborted) {
      await prisma.project.update({
        where: { id: projectId },
        data: { engineStatus: "completed", activeAgents: Prisma.DbNull },
      });

      await logActivity(projectId, "agent_complete", {
        message: "All tasks completed",
      });

      emit(io, projectId, "engine:completed", { projectId });
      emit(io, projectId, "engine:status_change", { status: "completed" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(err, "Engine task execution error");

    await prisma.project.update({
      where: { id: projectId },
      data: { engineStatus: "failed", activeAgents: Prisma.DbNull },
    }).catch(() => {});

    await logActivity(projectId, "error", { message }).catch(() => {});
    emit(io, projectId, "engine:failed", { projectId, error: message });
  } finally {
    engineAbortControllers.delete(projectId);
  }
}

// ═══════════════════════════════════════════════════════════════════
// EXECUTE SINGLE TASK — Uses existing Orchestrator for coder agent
// ═══════════════════════════════════════════════════════════════════

async function executeTask(
  projectId: string,
  taskId: string,
  step: PlannerResult["steps"][number],
  originalPrompt: string,
  io: SocketIOServer,
  signal: AbortSignal
) {
  const startTime = Date.now();

  try {
    // Mark task as running
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date() },
    });

    emit(io, projectId, "engine:task:started", {
      projectId,
      taskId,
      agentType: step.agentType,
      title: step.title,
    });

    await logActivity(projectId, "plan_step", {
      step: step.title,
      status: "running",
    }, { taskId, agentType: step.agentType });

    // For Phase 1: only coder agent is fully implemented
    // Other agents log their intent and complete as "simulated"
    if (step.agentType === "coder" || step.agentType === "qa" || step.agentType === "designer") {
      await executeCoderTask(projectId, taskId, step, originalPrompt, io, signal);
    } else {
      // Phase 2 agents: log and mark as completed with a note
      await logActivity(projectId, "agent_message", {
        message: `Agent "${step.agentType}" task queued: ${step.description}. Full agent implementation coming in Phase 2.`,
      }, { taskId, agentType: step.agentType });
    }

    // Mark task as completed
    const durationMs = Date.now() - startTime;
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "completed",
        completedAt: new Date(),
        durationMs,
      },
    });

    emit(io, projectId, "engine:task:completed", { projectId, taskId });

    await logActivity(projectId, "agent_complete", {
      taskTitle: step.title,
      durationMs,
    }, { taskId, agentType: step.agentType });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;

    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "failed",
        completedAt: new Date(),
        durationMs,
        errorMessage: message,
      },
    });

    emit(io, projectId, "engine:task:failed", { projectId, taskId, error: message });

    await logActivity(projectId, "error", {
      taskTitle: step.title,
      error: message,
    }, { taskId, agentType: step.agentType });
  }
}

// ── Execute coder task using existing Orchestrator ───────────────

async function executeCoderTask(
  projectId: string,
  taskId: string,
  step: PlannerResult["steps"][number],
  originalPrompt: string,
  io: SocketIOServer,
  signal: AbortSignal
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  let sandboxId = project.sandboxId;
  if (!sandboxId) {
    emit(io, projectId, "engine:activity", {
      type: "thinking",
      content: { message: "Creating sandbox environment..." },
    });

    const sandbox = await sandboxManager.createSandbox(projectId, project.framework);
    sandboxId = sandbox.containerId;

    await prisma.project.update({
      where: { id: projectId },
      data: { sandboxId },
    });

    sandboxManager.onDevServerOutput(projectId, (output: string) => {
      emit(io, projectId, "engine:activity", {
        type: "terminal_cmd",
        content: { output },
      });
    });
  } else {
    sandboxManager.resetTTL(projectId);
    await sandboxManager.ensureSandboxRunning(projectId);
  }

  const sandboxInterface = getSandboxInterface(sandboxId);

  // Build context for this specific task
  const taskPrompt = `${step.description}\n\nOriginal user request: ${originalPrompt}`;
  const fileTree = await sandboxManager.getFileTree(sandboxId);
  let projectContext = `Framework: ${project.framework}\n`;
  if (project.customInstructions) {
    projectContext += `\n--- Custom Instructions ---\n${project.customInstructions}\n--- End Custom Instructions ---\n\n`;
  }
  projectContext += `Project files:\n${JSON.stringify(fileTree, null, 2)}`;

  for (const file of ["package.json", "src/App.tsx", "src/main.tsx"]) {
    try {
      const content = await sandboxManager.readFile(sandboxId, file);
      projectContext += `\n\n--- ${file} ---\n${content}`;
    } catch { /* skip */ }
  }

  // Use the existing Orchestrator to run this step
  const orchestrator = new Orchestrator();
  let totalTokens = 0;

  const callbacks: OrchestratorCallbacks = {
    onThinking: (content) => {
      emit(io, projectId, "engine:activity", {
        type: "thinking",
        agentType: step.agentType,
        taskId,
        content: { message: content },
      });
      logActivity(projectId, "thinking", { message: content }, { taskId, agentType: step.agentType }).catch(() => {});
    },
    onPlan: (plan) => {
      emit(io, projectId, "engine:activity", {
        type: "plan_step",
        taskId,
        content: { plan },
      });
    },
    onStepStart: (agentStep) => {
      emit(io, projectId, "engine:activity", {
        type: "plan_step",
        taskId,
        content: { step: agentStep.description, status: "running" },
      });
    },
    onStepComplete: (agentStep) => {
      emit(io, projectId, "engine:activity", {
        type: "plan_step",
        taskId,
        content: { step: agentStep.description, status: "completed" },
      });
    },
    onStepMessage: (message) => {
      emit(io, projectId, "engine:activity", {
        type: "agent_message",
        taskId,
        content: { message },
      });
    },
    onCodeChange: (change: CodeChange) => {
      emit(io, projectId, "engine:activity", {
        type: "file_change",
        taskId,
        agentType: step.agentType,
        content: { action: change.action, path: change.file, diff: change.diff },
      });
      logActivity(projectId, "file_change", {
        action: change.action,
        path: change.file,
      }, { taskId, agentType: step.agentType }).catch(() => {});
    },
    onFileChanged: (path) => {
      emit(io, projectId, "sandbox:file_changed", { path });
    },
    onTerminalOutput: (output) => {
      emit(io, projectId, "engine:activity", {
        type: "terminal_cmd",
        taskId,
        content: { output },
      });
      logActivity(projectId, "terminal_cmd", { output: output.slice(0, 1000) }, { taskId }).catch(() => {});
    },
    onError: (message) => {
      emit(io, projectId, "engine:activity", {
        type: "error",
        taskId,
        content: { message },
      });
      logActivity(projectId, "error", { message }, { taskId }).catch(() => {});
    },
    onComplete: async (summary) => {
      await prisma.task.update({
        where: { id: taskId },
        data: { outputResult: { summary } },
      });
    },
    onPreviewReload: () => emit(io, projectId, "preview:reload", {}),
    onDesignerStart: () => emit(io, projectId, "engine:activity", { type: "agent_spawn", taskId, content: { agentType: "designer" } }),
    onDesignerComplete: () => emit(io, projectId, "engine:activity", { type: "agent_complete", taskId, content: { agentType: "designer" } }),
    onDebuggerStart: () => emit(io, projectId, "engine:activity", { type: "agent_spawn", taskId, content: { agentType: "debugger" } }),
    onDebuggerFix: (explanation) => emit(io, projectId, "engine:activity", { type: "agent_message", taskId, content: { message: explanation, agentType: "debugger" } }),
    onDebuggerFailed: (error) => emit(io, projectId, "engine:activity", { type: "error", taskId, content: { message: error, agentType: "debugger" } }),
    onReviewerStart: () => emit(io, projectId, "engine:activity", { type: "agent_spawn", taskId, content: { agentType: "reviewer" } }),
    onReviewerReport: (report) => emit(io, projectId, "engine:activity", { type: "agent_message", taskId, content: { report } }),
    onDeployStart: () => emit(io, projectId, "engine:activity", { type: "agent_spawn", taskId, content: { agentType: "deployer" } }),
    onDeployComplete: (result) => emit(io, projectId, "engine:activity", { type: "agent_complete", taskId, content: { url: result.url, buildTime: result.buildTime } }),
    onDeployFailed: (error) => emit(io, projectId, "engine:activity", { type: "error", taskId, content: { message: error, agentType: "deployer" } }),
  };

  await orchestrator.run(taskPrompt, projectContext, sandboxInterface, callbacks, signal);
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE CONTROL — Pause, Resume, Cancel, Retry
// ═══════════════════════════════════════════════════════════════════

export async function controlEngine(
  projectId: string,
  action: "pause" | "resume" | "cancel" | "retry",
  io: SocketIOServer,
  taskId?: string
): Promise<{ engineStatus: string; message: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { engineStatus: true },
  });
  if (!project) throw new Error("Project not found");

  switch (action) {
    case "pause": {
      if (project.engineStatus !== "running" && project.engineStatus !== "planning") {
        throw new Error("Engine is not running");
      }
      await prisma.project.update({
        where: { id: projectId },
        data: { engineStatus: "paused" },
      });
      await logActivity(projectId, "plan_step", { step: "Engine paused", status: "paused" });
      emit(io, projectId, "engine:status_change", { status: "paused" });
      return { engineStatus: "paused", message: "Engine paused" };
    }

    case "resume": {
      if (project.engineStatus !== "paused") {
        throw new Error("Engine is not paused");
      }
      await prisma.project.update({
        where: { id: projectId },
        data: { engineStatus: "running" },
      });
      await logActivity(projectId, "plan_step", { step: "Engine resumed", status: "running" });
      emit(io, projectId, "engine:status_change", { status: "running" });
      return { engineStatus: "running", message: "Engine resumed" };
    }

    case "cancel": {
      if (project.engineStatus === "idle" || project.engineStatus === "completed") {
        throw new Error("Engine is not active");
      }

      // Abort the running controller
      const controller = engineAbortControllers.get(projectId);
      if (controller) {
        controller.abort();
        engineAbortControllers.delete(projectId);
      }

      // Cancel pending/running tasks
      await prisma.task.updateMany({
        where: { projectId, status: { in: ["running", "pending"] } },
        data: { status: "cancelled" },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { engineStatus: "idle", activeAgents: Prisma.DbNull },
      });

      await logActivity(projectId, "agent_complete", { message: "Engine cancelled by user" });
      emit(io, projectId, "engine:status_change", { status: "idle" });
      return { engineStatus: "idle", message: "Engine cancelled" };
    }

    case "retry": {
      if (!taskId) throw new Error("taskId is required for retry action");

      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId },
      });
      if (!task) throw new Error("Task not found");
      if (task.status !== "failed") throw new Error("Can only retry failed tasks");

      // Reset the task
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "pending",
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
          outputResult: Prisma.DbNull,
        },
      });

      await logActivity(projectId, "plan_step", {
        step: `Retrying: ${task.title}`,
        status: "pending",
      }, { taskId, agentType: task.agentType });

      emit(io, projectId, "engine:task_updated", {
        taskId,
        status: "pending",
        message: "Task queued for retry",
      });

      // If engine is not running, restart it to pick up the retried task
      if (project.engineStatus !== "running") {
        await prisma.project.update({
          where: { id: projectId },
          data: { engineStatus: "running" },
        });
        emit(io, projectId, "engine:status_change", { status: "running" });

        // Re-execute just this task
        const step: PlannerResult["steps"][number] = {
          order: task.order,
          title: task.title,
          description: task.description || task.title,
          agentType: task.agentType,
          dependsOn: [],
          estimatedDuration: "5min",
        };

        const retryController = new AbortController();
        engineAbortControllers.set(projectId, retryController);

        executeTasksInOrder(
          projectId,
          [step],
          [{ id: taskId, title: task.title, agentType: task.agentType, status: "pending", order: task.order }],
          task.inputPrompt || task.title,
          io,
          retryController.signal
        ).catch((err) => {
          logger.error(err, "Retry execution error");
        });
      }

      return { engineStatus: "running", message: "Task retry started" };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
