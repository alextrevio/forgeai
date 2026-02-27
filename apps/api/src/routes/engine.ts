import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { checkCredits } from "../middleware/credits";
import { logger } from "../lib/logger";
import { Server as SocketIOServer } from "socket.io";
import { startEngine, controlEngine } from "../engine/service";
import { agentRegistry } from "../services/agent-registry";
import { modelRouter } from "../services/model-router";

export const engineRouter: RouterType = Router();

// ── Helpers ──────────────────────────────────────────────

async function findUserProject(projectId: string, userId: string | undefined) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
}

// ── Validation Schemas ───────────────────────────────────

const startEngineSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1, "Prompt cannot be empty").max(20000, "Prompt too long"),
});

const controlSchema = z.object({
  projectId: z.string().min(1),
  action: z.enum(["pause", "resume", "cancel", "retry"]),
  taskId: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════
// POST /start — Start the Arya Engine
// ═══════════════════════════════════════════════════════════

engineRouter.post("/start", checkCredits, async (req: AuthRequest, res: Response) => {
  try {
    const body = startEngineSchema.parse(req.body);
    const project = await findUserProject(body.projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.engineStatus === "running" || project.engineStatus === "planning") {
      return res.status(409).json({ error: "Engine is already running" });
    }

    // Update credits
    await prisma.user.update({
      where: { id: req.userId },
      data: { creditsUsed: { increment: 1 } },
    });

    const io: SocketIOServer = req.app.get("io");
    const result = await startEngine(project.id, body.prompt, io);

    return res.status(201).json({
      engineStatus: "running",
      planSteps: result.planSteps,
      tasks: result.tasks,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Engine start error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /status/:projectId — Engine status with progress
// ═══════════════════════════════════════════════════════════

engineRouter.get("/status/:projectId", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId: project.id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        agentType: true,
        title: true,
        description: true,
        status: true,
        order: true,
        tokensUsed: true,
        durationMs: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        subTasks: {
          select: { id: true, agentType: true, title: true, status: true, order: true },
          orderBy: { order: "asc" },
        },
      },
    });

    const completed = tasks.filter((t) => t.status === "completed").length;
    const total = tasks.length;

    return res.json({
      engineStatus: project.engineStatus,
      planSteps: project.planSteps,
      tasks,
      activeAgents: project.activeAgents,
      totalTokensUsed: project.totalTokensUsed,
      estimatedCost: project.estimatedCost,
      progress: {
        completed,
        total,
        percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
    });
  } catch (err) {
    logger.error(err, "Engine status error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /activity/:projectId — Activity feed (paginated)
// ═══════════════════════════════════════════════════════════

engineRouter.get("/activity/:projectId", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const before = req.query.before as string | undefined;

    const where: Prisma.ActivityLogWhereInput = { projectId: project.id };

    // Filter by types (comma-separated)
    const types = req.query.types as string | undefined;
    if (types) {
      where.type = { in: types.split(",") };
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit + 1,
      ...(before && { cursor: { id: before }, skip: 1 }),
      select: {
        id: true,
        type: true,
        agentType: true,
        content: true,
        taskId: true,
        timestamp: true,
      },
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return res.json({
      logs: items,
      hasMore,
      nextCursor,
    });
  } catch (err) {
    logger.error(err, "Get activity error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /control — Control engine execution
// ═══════════════════════════════════════════════════════════

engineRouter.post("/control", async (req: AuthRequest, res: Response) => {
  try {
    const body = controlSchema.parse(req.body);
    const project = await findUserProject(body.projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const io: SocketIOServer = req.app.get("io");
    const result = await controlEngine(project.id, body.action, io, body.taskId);

    return res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    // Return specific errors as 400 (user-facing) vs 500
    if (message.includes("not running") || message.includes("not paused") || message.includes("not active") || message.includes("not found") || message.includes("only retry")) {
      return res.status(400).json({ error: message });
    }
    logger.error(err, "Engine control error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /tasks/:projectId — List tasks for a project
// ═══════════════════════════════════════════════════════════

engineRouter.get("/tasks/:projectId", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const status = req.query.status as string | undefined;
    const where: Prisma.TaskWhereInput = { projectId: project.id };
    if (status) {
      where.status = status;
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      include: {
        subTasks: {
          select: { id: true, agentType: true, title: true, status: true, order: true },
          orderBy: { order: "asc" },
        },
        _count: { select: { activityLogs: true } },
      },
    });

    return res.json(tasks);
  } catch (err) {
    logger.error(err, "List tasks error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /tasks/:projectId/:taskId — Task detail
// ═══════════════════════════════════════════════════════════

engineRouter.get("/tasks/:projectId/:taskId", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const taskId = req.params.taskId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId: project.id },
      include: {
        subTasks: { orderBy: { order: "asc" } },
        activityLogs: {
          orderBy: { timestamp: "desc" },
          take: 50,
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.json(task);
  } catch (err) {
    logger.error(err, "Get task error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /tasks/:projectId/:taskId/result — Task result data
// ═══════════════════════════════════════════════════════════

engineRouter.get("/tasks/:projectId/:taskId/result", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const taskId = req.params.taskId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId: project.id },
      select: {
        id: true,
        agentType: true,
        title: true,
        description: true,
        status: true,
        order: true,
        outputResult: true,
        modelUsed: true,
        tokensUsed: true,
        durationMs: true,
        startedAt: true,
        completedAt: true,
        errorMessage: true,
      },
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const outputResult = task.outputResult as Record<string, unknown> | null;
    const resultSummary = outputResult?.resultSummary || null;

    return res.json({
      ...task,
      resultSummary,
    });
  } catch (err) {
    logger.error(err, "Get task result error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /agents — List available agents with their configs
// ═══════════════════════════════════════════════════════════

engineRouter.get("/agents", async (_req: AuthRequest, res: Response) => {
  try {
    const agents = agentRegistry.getAllAgents().map((agent) => {
      const modelConfig = modelRouter.getModelConfig(agent.type);
      return {
        type: agent.type,
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        capabilities: agent.capabilities,
        model: {
          provider: modelConfig.provider,
          model: modelConfig.model,
          maxTokens: modelConfig.maxTokens,
          temperature: modelConfig.temperature,
        },
      };
    });

    return res.json({ agents });
  } catch (err) {
    logger.error(err, "List agents error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
