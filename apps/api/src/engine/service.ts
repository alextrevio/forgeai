import { Server as SocketIOServer } from "socket.io";
import { prisma, Prisma } from "@forgeai/db";
import {
  Orchestrator,
  PlannerAgent,
} from "@forgeai/agents";
import type { OrchestratorCallbacks, SandboxInterface } from "@forgeai/agents";
import type { AgentPlan, AgentStep, CodeChange } from "@forgeai/shared";
import { sandboxManager } from "../sandbox/manager";
import { logger } from "../lib/logger";
import { modelRouter } from "../services/model-router";

// ══════════════════════════════════════════════════════════════════
// AGENT SYSTEM PROMPTS
// ══════════════════════════════════════════════════════════════════

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

const RESEARCH_AGENT_PROMPT = `Eres un agente de investigación de Arya AI.
Tu trabajo es investigar, analizar y generar un reporte estructurado basado en la solicitud.

Utiliza tu conocimiento para:
- Analizar el dominio del problema
- Identificar mejores prácticas y patrones relevantes
- Sugerir tecnologías, librerías y enfoques apropiados
- Identificar riesgos y consideraciones importantes

Responde SOLO con un JSON válido:
{
  "summary": "Resumen ejecutivo de la investigación",
  "findings": [
    {
      "topic": "Nombre del hallazgo",
      "description": "Descripción detallada",
      "relevance": "high|medium|low"
    }
  ],
  "recommendations": [
    "Recomendación 1",
    "Recomendación 2"
  ],
  "techStack": {
    "suggested": ["tech1", "tech2"],
    "reasoning": "Por qué estas tecnologías"
  },
  "risks": [
    {
      "risk": "Descripción del riesgo",
      "mitigation": "Cómo mitigarlo"
    }
  ]
}`;

const ANALYST_AGENT_PROMPT = `Eres un agente analista de Arya AI.
Tu trabajo es analizar datos, estructuras y requerimientos para generar insights accionables.

Responde SOLO con un JSON válido:
{
  "summary": "Resumen del análisis",
  "dataModel": {
    "entities": [
      {
        "name": "EntityName",
        "fields": ["field1: type", "field2: type"],
        "relationships": ["relates to EntityB via fieldX"]
      }
    ]
  },
  "insights": [
    {
      "insight": "Descripción del insight",
      "impact": "high|medium|low",
      "actionable": true
    }
  ],
  "metrics": [
    {
      "name": "Métrica clave",
      "description": "Qué mide y por qué importa"
    }
  ],
  "recommendations": ["Recomendación 1", "Recomendación 2"]
}`;

const WRITER_AGENT_PROMPT = `Eres un agente redactor de Arya AI.
Tu trabajo es crear contenido profesional, claro y bien estructurado.

Puedes crear: documentación técnica, copy de UI, emails, blog posts, README files, guías de usuario.

Responde SOLO con un JSON válido:
{
  "summary": "Resumen del contenido creado",
  "content": [
    {
      "title": "Título de la sección o documento",
      "type": "readme|docs|copy|email|blog|guide",
      "body": "Contenido completo en markdown",
      "targetFile": "path/to/file.md (opcional, si debe guardarse)"
    }
  ],
  "metadata": {
    "tone": "professional|casual|technical",
    "audience": "developers|users|stakeholders",
    "wordCount": 500
  }
}`;

const DEPLOY_AGENT_PROMPT = `Eres un agente de deployment de Arya AI.
Tu trabajo es configurar y preparar el proyecto para deployment.

Analiza el proyecto y genera los comandos y configuraciones necesarias.

Responde SOLO con un JSON válido:
{
  "summary": "Resumen de la estrategia de deployment",
  "platform": "vercel|netlify|docker|custom",
  "steps": [
    {
      "description": "Qué hacer",
      "commands": ["comando1", "comando2"],
      "configFiles": [
        {
          "path": "archivo.config",
          "content": "contenido del archivo"
        }
      ]
    }
  ],
  "envVars": [
    {
      "name": "VAR_NAME",
      "description": "Para qué se usa",
      "required": true
    }
  ],
  "checks": ["verificación 1", "verificación 2"]
}`;

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

interface ResearchResult {
  summary: string;
  findings: Array<{ topic: string; description: string; relevance: string }>;
  recommendations: string[];
  techStack?: { suggested: string[]; reasoning: string };
  risks?: Array<{ risk: string; mitigation: string }>;
}

interface AnalystResult {
  summary: string;
  dataModel?: { entities: Array<{ name: string; fields: string[]; relationships: string[] }> };
  insights: Array<{ insight: string; impact: string; actionable: boolean }>;
  metrics?: Array<{ name: string; description: string }>;
  recommendations: string[];
}

interface WriterResult {
  summary: string;
  content: Array<{ title: string; type: string; body: string; targetFile?: string }>;
  metadata?: { tone: string; audience: string; wordCount: number };
}

interface DeployResult {
  summary: string;
  platform: string;
  steps: Array<{ description: string; commands: string[]; configFiles?: Array<{ path: string; content: string }> }>;
  envVars?: Array<{ name: string; description: string; required: boolean }>;
  checks?: string[];
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

function emitActivity(
  io: SocketIOServer,
  projectId: string,
  type: string,
  content: Record<string, unknown>,
  opts?: { taskId?: string; agentType?: string }
) {
  emit(io, projectId, "engine:activity", {
    type,
    taskId: opts?.taskId,
    agentType: opts?.agentType,
    content,
  });
  logActivity(projectId, type, content, opts).catch(() => {});
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

async function updateTokenUsage(projectId: string, taskId: string, tokensUsed: number) {
  if (tokensUsed <= 0) return;
  await prisma.task.update({
    where: { id: taskId },
    data: { tokensUsed },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { totalTokensUsed: { increment: tokensUsed } },
  });
}

/**
 * Gather output results from completed dependency tasks to pass as context.
 */
async function gatherDependencyResults(
  projectId: string,
  step: PlannerResult["steps"][number],
  taskMap: Map<number, { id: string; title: string; agentType: string }>
): Promise<string> {
  if (!step.dependsOn || step.dependsOn.length === 0) return "";

  const results: string[] = [];
  for (const depOrder of step.dependsOn) {
    const depTask = taskMap.get(depOrder);
    if (!depTask) continue;

    const task = await prisma.task.findUnique({
      where: { id: depTask.id },
      select: { title: true, agentType: true, outputResult: true },
    });
    if (!task?.outputResult) continue;

    const output = typeof task.outputResult === "string"
      ? task.outputResult
      : JSON.stringify(task.outputResult, null, 2);

    results.push(`--- Resultado de "${task.title}" (${task.agentType}) ---\n${output}`);
  }

  return results.length > 0
    ? `\n\nResultado de tareas previas:\n${results.join("\n\n")}`
    : "";
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

    emitActivity(io, projectId, "thinking", {
      message: "Analyzing request and creating execution plan...",
    });

    // Call LLM to generate plan via ModelRouter
    const { parsed, parseError } = await modelRouter.callModelForJSON<PlannerResult>(
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

      // Execute ready tasks in parallel, passing dependency results
      await Promise.all(
        ready.map(async (step) => {
          const task = taskMap.get(step.order);
          if (!task) return;
          const depContext = await gatherDependencyResults(projectId, step, taskMap);
          return executeTask(projectId, task.id, step, originalPrompt, depContext, io, signal);
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
// EXECUTE SINGLE TASK — Routes to the appropriate agent
// ═══════════════════════════════════════════════════════════════════

async function executeTask(
  projectId: string,
  taskId: string,
  step: PlannerResult["steps"][number],
  originalPrompt: string,
  dependencyContext: string,
  io: SocketIOServer,
  signal: AbortSignal
) {
  const startTime = Date.now();

  try {
    // Mark task as running and record the model used
    const taskModel = modelRouter.getModelName(step.agentType);
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running", startedAt: new Date(), modelUsed: taskModel },
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

    // Route to the appropriate agent executor
    switch (step.agentType) {
      case "coder":
        await executeCoderTask(projectId, taskId, step, originalPrompt, dependencyContext, io, signal);
        break;

      case "designer":
        await executeCoderTask(projectId, taskId, step, originalPrompt, dependencyContext, io, signal, "designer");
        break;

      case "qa":
        await executeCoderTask(projectId, taskId, step, originalPrompt, dependencyContext, io, signal, "qa");
        break;

      case "research":
        await executeResearchTask(projectId, taskId, step, originalPrompt, dependencyContext, io, signal);
        break;

      case "analyst":
        await executeAnalystTask(projectId, taskId, step, originalPrompt, dependencyContext, io, signal);
        break;

      case "writer":
        await executeWriterTask(projectId, taskId, step, originalPrompt, dependencyContext, io, signal);
        break;

      case "deploy":
        await executeDeployTask(projectId, taskId, step, originalPrompt, dependencyContext, io, signal);
        break;

      default:
        // Unknown agent type — log and continue
        emitActivity(io, projectId, "agent_message", {
          message: `Agent "${step.agentType}" ejecutando: ${step.description}`,
        }, { taskId, agentType: step.agentType });
        break;
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

// ═══════════════════════════════════════════════════════════════════
// CODER AGENT — Uses existing Orchestrator
// ═══════════════════════════════════════════════════════════════════

async function executeCoderTask(
  projectId: string,
  taskId: string,
  step: PlannerResult["steps"][number],
  originalPrompt: string,
  dependencyContext: string,
  io: SocketIOServer,
  signal: AbortSignal,
  agentOverlay?: "designer" | "qa"
) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");

  let sandboxId = project.sandboxId;
  if (!sandboxId) {
    emitActivity(io, projectId, "thinking", {
      message: "Creating sandbox environment...",
    }, { taskId, agentType: step.agentType });

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
  let taskPrompt = step.description;

  // Add agent-specific overlay instructions
  if (agentOverlay === "designer") {
    taskPrompt = `[MODO DISEÑADOR] Enfócate en aspectos visuales, UX/UI, estilos, y diseño.\n\n${taskPrompt}`;
  } else if (agentOverlay === "qa") {
    taskPrompt = `[MODO QA] Enfócate en testing, revisión de código, manejo de errores, y calidad.\n\n${taskPrompt}`;
  }

  taskPrompt += `\n\nOriginal user request: ${originalPrompt}`;
  if (dependencyContext) {
    taskPrompt += dependencyContext;
  }

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

  const orchestrator = new Orchestrator();

  const callbacks: OrchestratorCallbacks = {
    onThinking: (content) => {
      emitActivity(io, projectId, "thinking", { message: content }, { taskId, agentType: step.agentType });
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
      emitActivity(io, projectId, "agent_message", { message }, { taskId });
    },
    onCodeChange: (change: CodeChange) => {
      emitActivity(io, projectId, "file_change", {
        action: change.action,
        path: change.file,
        diff: change.diff,
      }, { taskId, agentType: step.agentType });
    },
    onFileChanged: (path) => {
      emit(io, projectId, "sandbox:file_changed", { path });
    },
    onTerminalOutput: (output) => {
      emitActivity(io, projectId, "terminal_cmd", { output: output.slice(0, 1000) }, { taskId });
    },
    onError: (message) => {
      emitActivity(io, projectId, "error", { message }, { taskId });
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
// RESEARCH AGENT — LLM knowledge-based research
// ═══════════════════════════════════════════════════════════════════

async function executeResearchTask(
  projectId: string,
  taskId: string,
  step: PlannerResult["steps"][number],
  originalPrompt: string,
  dependencyContext: string,
  io: SocketIOServer,
  signal: AbortSignal
) {
  emitActivity(io, projectId, "thinking", {
    message: `Investigando: ${step.title}...`,
  }, { taskId, agentType: "research" });

  const userMessage = `Tarea: ${step.description}\n\nSolicitud original del usuario: ${originalPrompt}${dependencyContext}`;

  const { parsed, text, parseError, model } = await modelRouter.callModelForJSON<ResearchResult>(
    "research",
    RESEARCH_AGENT_PROMPT,
    [{ role: "user", content: userMessage }],
    signal
  );

  if (signal.aborted) return;

  // Estimate tokens (~4 chars per token)
  const estimatedTokens = Math.ceil((userMessage.length + (text?.length || 0)) / 4);
  await updateTokenUsage(projectId, taskId, estimatedTokens);

  if (parsed) {
    // Emit findings as activity
    emitActivity(io, projectId, "agent_message", {
      message: parsed.summary,
    }, { taskId, agentType: "research" });

    for (const finding of parsed.findings || []) {
      emitActivity(io, projectId, "agent_message", {
        message: `[${finding.relevance?.toUpperCase()}] ${finding.topic}: ${finding.description}`,
      }, { taskId, agentType: "research" });
    }

    if (parsed.recommendations?.length) {
      emitActivity(io, projectId, "agent_message", {
        message: `Recomendaciones: ${parsed.recommendations.join("; ")}`,
      }, { taskId, agentType: "research" });
    }

    // Store full result for downstream tasks
    await prisma.task.update({
      where: { id: taskId },
      data: { outputResult: parsed as unknown as Prisma.InputJsonValue, modelUsed: model },
    });
  } else {
    logger.warn({ parseError }, "Research agent: failed to parse JSON, storing raw text");
    await prisma.task.update({
      where: { id: taskId },
      data: { outputResult: { summary: text || "Research completed", raw: true }, modelUsed: model },
    });

    emitActivity(io, projectId, "agent_message", {
      message: text?.slice(0, 500) || "Research completed",
    }, { taskId, agentType: "research" });
  }
}

// ═══════════════════════════════════════════════════════════════════
// ANALYST AGENT — Data analysis and insights
// ═══════════════════════════════════════════════════════════════════

async function executeAnalystTask(
  projectId: string,
  taskId: string,
  step: PlannerResult["steps"][number],
  originalPrompt: string,
  dependencyContext: string,
  io: SocketIOServer,
  signal: AbortSignal
) {
  emitActivity(io, projectId, "thinking", {
    message: `Analizando: ${step.title}...`,
  }, { taskId, agentType: "analyst" });

  const userMessage = `Tarea: ${step.description}\n\nSolicitud original del usuario: ${originalPrompt}${dependencyContext}`;

  const { parsed, text, parseError, model } = await modelRouter.callModelForJSON<AnalystResult>(
    "analyst",
    ANALYST_AGENT_PROMPT,
    [{ role: "user", content: userMessage }],
    signal
  );

  if (signal.aborted) return;

  const estimatedTokens = Math.ceil((userMessage.length + (text?.length || 0)) / 4);
  await updateTokenUsage(projectId, taskId, estimatedTokens);

  if (parsed) {
    emitActivity(io, projectId, "agent_message", {
      message: parsed.summary,
    }, { taskId, agentType: "analyst" });

    for (const insight of parsed.insights || []) {
      emitActivity(io, projectId, "agent_message", {
        message: `[${insight.impact?.toUpperCase()}] ${insight.insight}`,
      }, { taskId, agentType: "analyst" });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { outputResult: parsed as unknown as Prisma.InputJsonValue, modelUsed: model },
    });
  } else {
    logger.warn({ parseError }, "Analyst agent: failed to parse JSON");
    await prisma.task.update({
      where: { id: taskId },
      data: { outputResult: { summary: text || "Analysis completed", raw: true }, modelUsed: model },
    });

    emitActivity(io, projectId, "agent_message", {
      message: text?.slice(0, 500) || "Analysis completed",
    }, { taskId, agentType: "analyst" });
  }
}

// ═══════════════════════════════════════════════════════════════════
// WRITER AGENT — Content creation
// ═══════════════════════════════════════════════════════════════════

async function executeWriterTask(
  projectId: string,
  taskId: string,
  step: PlannerResult["steps"][number],
  originalPrompt: string,
  dependencyContext: string,
  io: SocketIOServer,
  signal: AbortSignal
) {
  emitActivity(io, projectId, "thinking", {
    message: `Redactando: ${step.title}...`,
  }, { taskId, agentType: "writer" });

  const userMessage = `Tarea: ${step.description}\n\nSolicitud original del usuario: ${originalPrompt}${dependencyContext}`;

  const { parsed, text, parseError, model } = await modelRouter.callModelForJSON<WriterResult>(
    "writer",
    WRITER_AGENT_PROMPT,
    [{ role: "user", content: userMessage }],
    signal
  );

  if (signal.aborted) return;

  const estimatedTokens = Math.ceil((userMessage.length + (text?.length || 0)) / 4);
  await updateTokenUsage(projectId, taskId, estimatedTokens);

  if (parsed) {
    emitActivity(io, projectId, "agent_message", {
      message: parsed.summary,
    }, { taskId, agentType: "writer" });

    // If content has targetFile, write to sandbox
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { sandboxId: true },
    });

    for (const item of parsed.content || []) {
      if (item.targetFile && project?.sandboxId) {
        try {
          await sandboxManager.writeFile(project.sandboxId, item.targetFile, item.body);
          emitActivity(io, projectId, "file_change", {
            action: "create",
            path: item.targetFile,
          }, { taskId, agentType: "writer" });
          emit(io, projectId, "sandbox:file_changed", { path: item.targetFile });
        } catch (err) {
          logger.warn({ err, file: item.targetFile }, "Writer: failed to write file to sandbox");
        }
      }

      emitActivity(io, projectId, "agent_message", {
        message: `${item.title} (${item.type}): ${item.body.slice(0, 200)}...`,
      }, { taskId, agentType: "writer" });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { outputResult: parsed as unknown as Prisma.InputJsonValue, modelUsed: model },
    });
  } else {
    logger.warn({ parseError }, "Writer agent: failed to parse JSON");
    await prisma.task.update({
      where: { id: taskId },
      data: { outputResult: { summary: text || "Content created", raw: true }, modelUsed: model },
    });

    emitActivity(io, projectId, "agent_message", {
      message: text?.slice(0, 500) || "Content created",
    }, { taskId, agentType: "writer" });
  }
}

// ═══════════════════════════════════════════════════════════════════
// DEPLOY AGENT — Deployment configuration via sandbox
// ═══════════════════════════════════════════════════════════════════

async function executeDeployTask(
  projectId: string,
  taskId: string,
  step: PlannerResult["steps"][number],
  originalPrompt: string,
  dependencyContext: string,
  io: SocketIOServer,
  signal: AbortSignal
) {
  emitActivity(io, projectId, "thinking", {
    message: `Preparando deployment: ${step.title}...`,
  }, { taskId, agentType: "deploy" });

  // Gather project context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { sandboxId: true, framework: true },
  });

  let projectInfo = `Framework: ${project?.framework || "unknown"}`;
  if (project?.sandboxId) {
    try {
      const fileTree = await sandboxManager.getFileTree(project.sandboxId);
      projectInfo += `\nProject files: ${JSON.stringify(fileTree, null, 2)}`;
      const pkg = await sandboxManager.readFile(project.sandboxId, "package.json");
      projectInfo += `\n\n--- package.json ---\n${pkg}`;
    } catch { /* skip */ }
  }

  const userMessage = `Tarea: ${step.description}\n\nSolicitud original: ${originalPrompt}\n\nProyecto:\n${projectInfo}${dependencyContext}`;

  const { parsed, text, parseError, model } = await modelRouter.callModelForJSON<DeployResult>(
    "deploy",
    DEPLOY_AGENT_PROMPT,
    [{ role: "user", content: userMessage }],
    signal
  );

  if (signal.aborted) return;

  const estimatedTokens = Math.ceil((userMessage.length + (text?.length || 0)) / 4);
  await updateTokenUsage(projectId, taskId, estimatedTokens);

  const sbId = project?.sandboxId;
  if (parsed && sbId) {
    emitActivity(io, projectId, "agent_message", {
      message: parsed.summary,
    }, { taskId, agentType: "deploy" });

    // Write config files to sandbox
    for (const deployStep of parsed.steps || []) {
      for (const configFile of deployStep.configFiles || []) {
        try {
          await sandboxManager.writeFile(sbId, configFile.path, configFile.content);
          emitActivity(io, projectId, "file_change", {
            action: "create",
            path: configFile.path,
          }, { taskId, agentType: "deploy" });
          emit(io, projectId, "sandbox:file_changed", { path: configFile.path });
        } catch (err) {
          logger.warn({ err, file: configFile.path }, "Deploy: failed to write config file");
        }
      }

      // Execute deploy commands in sandbox
      for (const cmd of deployStep.commands || []) {
        try {
          emitActivity(io, projectId, "terminal_cmd", {
            command: cmd,
            output: `$ ${cmd}`,
          }, { taskId, agentType: "deploy" });

          const result = await sandboxManager.executeCommand(sbId, cmd);
          const output = result.stdout || result.stderr || "";
          emitActivity(io, projectId, "terminal_cmd", {
            output: output.slice(0, 1000),
          }, { taskId, agentType: "deploy" });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          emitActivity(io, projectId, "error", {
            message: `Deploy command failed: ${cmd} — ${errMsg}`,
          }, { taskId, agentType: "deploy" });
        }
      }
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { outputResult: parsed as unknown as Prisma.InputJsonValue, modelUsed: model },
    });
  } else {
    logger.warn({ parseError }, "Deploy agent: using raw output");
    await prisma.task.update({
      where: { id: taskId },
      data: { outputResult: { summary: text || "Deploy analysis completed", raw: true }, modelUsed: model },
    });

    emitActivity(io, projectId, "agent_message", {
      message: text?.slice(0, 500) || "Deploy analysis completed",
    }, { taskId, agentType: "deploy" });
  }
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

      const controller = engineAbortControllers.get(projectId);
      if (controller) {
        controller.abort();
        engineAbortControllers.delete(projectId);
      }

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

      if (project.engineStatus !== "running") {
        await prisma.project.update({
          where: { id: projectId },
          data: { engineStatus: "running" },
        });
        emit(io, projectId, "engine:status_change", { status: "running" });

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
