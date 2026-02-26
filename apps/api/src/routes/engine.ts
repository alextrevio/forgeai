import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { checkCredits } from "../middleware/credits";
import { logger } from "../lib/logger";
import { Server as SocketIOServer } from "socket.io";

export const engineRouter: RouterType = Router();

// ── Helpers ──────────────────────────────────────────────

function emit(io: SocketIOServer, projectId: string, type: string, data: unknown) {
  io.to(`project:${projectId}`).emit("event", { type, data });
}

async function findUserProject(projectId: string, userId: string | undefined) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
  });
}

// ── Validation Schemas ───────────────────────────────────

const startEngineSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty").max(20000, "Prompt too long"),
  model: z.string().optional(),
});

const createTaskSchema = z.object({
  agentType: z.enum(["coder", "research", "designer", "analyst", "writer", "deploy", "qa", "planner"]),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  parentTaskId: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

const updateTaskSchema = z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
  outputResult: z.any().optional(),
  errorMessage: z.string().optional(),
  tokensUsed: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
});

const createActivitySchema = z.object({
  type: z.enum(["plan_step", "file_change", "terminal_cmd", "agent_message", "thinking", "error", "agent_spawn", "agent_complete"]),
  agentType: z.string().optional(),
  content: z.record(z.unknown()),
  taskId: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════
// ENGINE STATUS & CONTROL
// ═══════════════════════════════════════════════════════════

// GET /:projectId/status — Full engine status
engineRouter.get("/:projectId/status", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const [taskCounts, activeTasks, recentActivity] = await Promise.all([
      prisma.task.groupBy({
        by: ["status"],
        where: { projectId: project.id },
        _count: { id: true },
      }),
      prisma.task.findMany({
        where: { projectId: project.id, status: { in: ["running", "pending"] } },
        orderBy: { order: "asc" },
        select: { id: true, agentType: true, title: true, status: true, order: true },
      }),
      prisma.activityLog.findMany({
        where: { projectId: project.id },
        orderBy: { timestamp: "desc" },
        take: 20,
        select: { id: true, type: true, agentType: true, content: true, timestamp: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const g of taskCounts) {
      counts[g.status] = g._count.id;
    }

    return res.json({
      engineStatus: project.engineStatus,
      planSteps: project.planSteps,
      activeAgents: project.activeAgents,
      totalTokensUsed: project.totalTokensUsed,
      estimatedCost: project.estimatedCost,
      tasks: { counts, active: activeTasks },
      recentActivity,
    });
  } catch (err) {
    logger.error(err, "Engine status error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:projectId/start — Start the engine (orchestrate agents)
engineRouter.post("/:projectId/start", checkCredits, async (req: AuthRequest, res: Response) => {
  try {
    const body = startEngineSchema.parse(req.body);
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.engineStatus === "running") {
      return res.status(409).json({ error: "Engine is already running" });
    }

    // Update engine status to planning
    await prisma.project.update({
      where: { id: project.id },
      data: { engineStatus: "planning" },
    });

    // Log engine start activity
    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        type: "plan_step",
        content: { step: "Engine started", status: "running", prompt: body.prompt.slice(0, 200) },
      },
    });

    // Emit real-time event
    const io: SocketIOServer = req.app.get("io");
    emit(io, project.id, "engine:status_change", { status: "planning" });

    // Update credits
    await prisma.user.update({
      where: { id: req.userId },
      data: { creditsUsed: { increment: 1 } },
    });

    return res.status(201).json({
      engineStatus: "planning",
      message: "Engine started",
      projectId: project.id,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Engine start error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:projectId/stop — Stop the engine
engineRouter.post("/:projectId/stop", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.engineStatus === "idle") {
      return res.status(400).json({ error: "Engine is not running" });
    }

    // Cancel all running/pending tasks
    await prisma.task.updateMany({
      where: {
        projectId: project.id,
        status: { in: ["running", "pending"] },
      },
      data: { status: "cancelled" },
    });

    // Update engine status
    await prisma.project.update({
      where: { id: project.id },
      data: {
        engineStatus: "idle",
        activeAgents: Prisma.DbNull,
      },
    });

    // Log stop activity
    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        type: "agent_complete",
        content: { message: "Engine stopped by user" },
      },
    });

    const io: SocketIOServer = req.app.get("io");
    emit(io, project.id, "engine:status_change", { status: "idle" });

    return res.json({ engineStatus: "idle", message: "Engine stopped" });
  } catch (err) {
    logger.error(err, "Engine stop error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:projectId/pause — Pause the engine
engineRouter.post("/:projectId/pause", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.engineStatus !== "running" && project.engineStatus !== "planning") {
      return res.status(400).json({ error: "Engine is not running" });
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { engineStatus: "paused" },
    });

    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        type: "plan_step",
        content: { step: "Engine paused", status: "paused" },
      },
    });

    const io: SocketIOServer = req.app.get("io");
    emit(io, project.id, "engine:status_change", { status: "paused" });

    return res.json({ engineStatus: "paused" });
  } catch (err) {
    logger.error(err, "Engine pause error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:projectId/resume — Resume a paused engine
engineRouter.post("/:projectId/resume", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (project.engineStatus !== "paused") {
      return res.status(400).json({ error: "Engine is not paused" });
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { engineStatus: "running" },
    });

    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        type: "plan_step",
        content: { step: "Engine resumed", status: "running" },
      },
    });

    const io: SocketIOServer = req.app.get("io");
    emit(io, project.id, "engine:status_change", { status: "running" });

    return res.json({ engineStatus: "running" });
  } catch (err) {
    logger.error(err, "Engine resume error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /:projectId/plan — Update plan steps
engineRouter.patch("/:projectId/plan", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const { planSteps } = req.body;
    if (!Array.isArray(planSteps)) {
      return res.status(400).json({ error: "planSteps must be an array" });
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { planSteps },
    });

    const io: SocketIOServer = req.app.get("io");
    emit(io, project.id, "engine:plan_update", { planSteps });

    return res.json({ planSteps });
  } catch (err) {
    logger.error(err, "Update plan error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════

// GET /:projectId/tasks — List all tasks
engineRouter.get("/:projectId/tasks", async (req: AuthRequest, res: Response) => {
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

// GET /:projectId/tasks/:taskId — Get task details
engineRouter.get("/:projectId/tasks/:taskId", async (req: AuthRequest, res: Response) => {
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
        subTasks: {
          orderBy: { order: "asc" },
        },
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

// POST /:projectId/tasks — Create a task
engineRouter.post("/:projectId/tasks", async (req: AuthRequest, res: Response) => {
  try {
    const body = createTaskSchema.parse(req.body);
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Validate parent task exists if provided
    if (body.parentTaskId) {
      const parentTask = await prisma.task.findFirst({
        where: { id: body.parentTaskId, projectId: project.id },
      });
      if (!parentTask) {
        return res.status(400).json({ error: "Parent task not found" });
      }
    }

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        agentType: body.agentType,
        title: body.title,
        description: body.description,
        parentTaskId: body.parentTaskId,
        order: body.order ?? 0,
      },
    });

    // Log task creation
    await prisma.activityLog.create({
      data: {
        projectId: project.id,
        taskId: task.id,
        type: "agent_spawn",
        agentType: body.agentType,
        content: { taskTitle: body.title, agentType: body.agentType },
      },
    });

    const io: SocketIOServer = req.app.get("io");
    emit(io, project.id, "engine:task_created", { task });

    return res.status(201).json(task);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Create task error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /:projectId/tasks/:taskId — Update a task
engineRouter.patch("/:projectId/tasks/:taskId", async (req: AuthRequest, res: Response) => {
  try {
    const body = updateTaskSchema.parse(req.body);
    const projectId = req.params.projectId as string;
    const taskId = req.params.taskId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const existing = await prisma.task.findFirst({
      where: { id: taskId, projectId: project.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Task not found" });
    }

    const updateData: Prisma.TaskUpdateInput = {};

    if (body.status) {
      updateData.status = body.status;
      if (body.status === "running" && !existing.startedAt) {
        updateData.startedAt = new Date();
      }
      if (body.status === "completed" || body.status === "failed") {
        updateData.completedAt = new Date();
        if (existing.startedAt) {
          updateData.durationMs = Date.now() - existing.startedAt.getTime();
        }
      }
    }
    if (body.outputResult !== undefined) updateData.outputResult = body.outputResult;
    if (body.errorMessage !== undefined) updateData.errorMessage = body.errorMessage;
    if (body.tokensUsed !== undefined) {
      updateData.tokensUsed = body.tokensUsed;
      // Also increment project-level token counter
      await prisma.project.update({
        where: { id: project.id },
        data: { totalTokensUsed: { increment: body.tokensUsed - existing.tokensUsed } },
      });
    }
    if (body.durationMs !== undefined) updateData.durationMs = body.durationMs;

    const task = await prisma.task.update({
      where: { id: existing.id },
      data: updateData,
    });

    // Log status change
    if (body.status) {
      await prisma.activityLog.create({
        data: {
          projectId: project.id,
          taskId: task.id,
          type: body.status === "completed" ? "agent_complete" : body.status === "failed" ? "error" : "plan_step",
          agentType: task.agentType,
          content: {
            taskTitle: task.title,
            status: body.status,
            ...(body.errorMessage && { error: body.errorMessage }),
          },
        },
      });
    }

    const io: SocketIOServer = req.app.get("io");
    emit(io, project.id, "engine:task_updated", { task });

    // Check if all tasks are done → mark engine as completed
    if (body.status === "completed" || body.status === "failed") {
      const pendingOrRunning = await prisma.task.count({
        where: {
          projectId: project.id,
          status: { in: ["pending", "running"] },
        },
      });

      if (pendingOrRunning === 0) {
        await prisma.project.update({
          where: { id: project.id },
          data: { engineStatus: "completed", activeAgents: Prisma.DbNull },
        });
        emit(io, project.id, "engine:status_change", { status: "completed" });
      }
    }

    return res.json(task);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Update task error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// ACTIVITY LOGS
// ═══════════════════════════════════════════════════════════

// GET /:projectId/activity — Get activity feed (paginated)
engineRouter.get("/:projectId/activity", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const cursor = req.query.cursor as string | undefined;

    const where: Prisma.ActivityLogWhereInput = { projectId: project.id };

    // Filter by type
    const type = req.query.type as string | undefined;
    if (type) {
      where.type = type;
    }

    // Filter by task
    const taskId = req.query.taskId as string | undefined;
    if (taskId) {
      where.taskId = taskId;
    }

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
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
      items,
      nextCursor,
      hasMore,
    });
  } catch (err) {
    logger.error(err, "Get activity error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /:projectId/activity — Create an activity log entry
engineRouter.post("/:projectId/activity", async (req: AuthRequest, res: Response) => {
  try {
    const body = createActivitySchema.parse(req.body);
    const projectId = req.params.projectId as string;
    const project = await findUserProject(projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Validate taskId if provided
    if (body.taskId) {
      const task = await prisma.task.findFirst({
        where: { id: body.taskId, projectId: project.id },
      });
      if (!task) {
        return res.status(400).json({ error: "Task not found" });
      }
    }

    const log = await prisma.activityLog.create({
      data: {
        projectId: project.id,
        taskId: body.taskId,
        type: body.type,
        agentType: body.agentType,
        content: body.content as Prisma.InputJsonValue,
      },
    });

    // Emit real-time event
    const io: SocketIOServer = req.app.get("io");
    emit(io, project.id, "engine:activity", {
      id: log.id,
      type: log.type,
      agentType: log.agentType,
      content: log.content,
      taskId: log.taskId,
      timestamp: log.timestamp,
    });

    return res.status(201).json(log);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Create activity error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
