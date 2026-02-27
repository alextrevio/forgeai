import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma } from "@forgeai/db";
import { ApiKeyRequest } from "../middleware/api-key-auth";
import { logger } from "../lib/logger";
import { usageTracker } from "../services/usage-tracker";
import { skillService } from "../services/skill-service";
import { canAccessProject } from "../services/team-permissions";

export const v1Router: RouterType = Router();

// ═══════════════════════════════════════════════════════════
// GET /projects — List projects
// ═══════════════════════════════════════════════════════════

v1Router.get("/projects", async (req: ApiKeyRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        framework: true,
        engineStatus: true,
        deployUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json({ data: projects });
  } catch (err) {
    logger.error(err, "v1: list projects error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /projects — Create project
// ═══════════════════════════════════════════════════════════

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  framework: z.enum(["react-vite", "nextjs", "vue", "landing", "dashboard", "saas", "api-only"]).default("react-vite"),
});

v1Router.post("/projects", async (req: ApiKeyRequest, res: Response) => {
  try {
    const body = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        framework: body.framework,
        userId: req.userId!,
      },
    });
    return res.status(201).json({ data: project });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid input", details: err.errors } });
    }
    logger.error(err, "v1: create project error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /projects/:id — Get project
// ═══════════════════════════════════════════════════════════

v1Router.get("/projects/:id", async (req: ApiKeyRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!(await canAccessProject(id, req.userId!))) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        framework: true,
        engineStatus: true,
        deployUrl: true,
        totalTokensUsed: true,
        estimatedCost: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    return res.json({ data: project });
  } catch (err) {
    logger.error(err, "v1: get project error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /projects/:id — Delete project
// ═══════════════════════════════════════════════════════════

v1Router.delete("/projects/:id", async (req: ApiKeyRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }
    await prisma.project.delete({ where: { id } });
    return res.json({ data: { success: true } });
  } catch (err) {
    logger.error(err, "v1: delete project error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /engine/start — Start engine for a project
// ═══════════════════════════════════════════════════════════

const startEngineSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1).max(20000),
});

v1Router.post("/engine/start", async (req: ApiKeyRequest, res: Response) => {
  try {
    const body = startEngineSchema.parse(req.body);

    if (!(await canAccessProject(body.projectId, req.userId!))) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    if (project.engineStatus === "running" || project.engineStatus === "planning") {
      return res.status(409).json({ error: { code: "CONFLICT", message: "Engine is already running" } });
    }

    // Update credits
    await prisma.user.update({
      where: { id: req.userId },
      data: { creditsUsed: { increment: 1 } },
    });

    const io = req.app.get("io");
    const { startEngine } = await import("../engine/service");
    const result = await startEngine(project.id, body.prompt, io);

    return res.status(201).json({
      data: {
        engineStatus: "running",
        planSteps: result.planSteps,
        tasks: result.tasks,
        queued: result.queued,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid input", details: err.errors } });
    }
    logger.error(err, "v1: engine start error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /engine/status/:projectId — Get engine status
// ═══════════════════════════════════════════════════════════

v1Router.get("/engine/status/:projectId", async (req: ApiKeyRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;

    if (!(await canAccessProject(projectId, req.userId!))) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        agentType: true,
        title: true,
        status: true,
        order: true,
        tokensUsed: true,
        durationMs: true,
        startedAt: true,
        completedAt: true,
      },
    });

    const completed = tasks.filter((t) => t.status === "completed").length;
    const total = tasks.length;

    return res.json({
      data: {
        engineStatus: project.engineStatus,
        planSteps: project.planSteps,
        tasks,
        totalTokensUsed: project.totalTokensUsed,
        estimatedCost: project.estimatedCost,
        progress: {
          completed,
          total,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
      },
    });
  } catch (err) {
    logger.error(err, "v1: engine status error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /engine/control — Pause/resume/cancel engine
// ═══════════════════════════════════════════════════════════

const controlSchema = z.object({
  projectId: z.string().min(1),
  action: z.enum(["pause", "resume", "cancel", "retry"]),
  taskId: z.string().optional(),
});

v1Router.post("/engine/control", async (req: ApiKeyRequest, res: Response) => {
  try {
    const body = controlSchema.parse(req.body);

    if (!(await canAccessProject(body.projectId, req.userId!))) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    const io = req.app.get("io");
    const { controlEngine } = await import("../engine/service");
    const result = await controlEngine(project.id, body.action, io, body.taskId);

    return res.json({ data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid input", details: err.errors } });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message.includes("not running") || message.includes("not paused") || message.includes("not active") || message.includes("not found") || message.includes("only retry")) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message } });
    }
    logger.error(err, "v1: engine control error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /skills — List available skills
// ═══════════════════════════════════════════════════════════

v1Router.get("/skills", async (req: ApiKeyRequest, res: Response) => {
  try {
    const { category, agentType, search } = req.query;
    const skills = await skillService.listSkills({
      category: category as string | undefined,
      agentType: agentType as string | undefined,
      search: search as string | undefined,
    });
    return res.json({ data: skills });
  } catch (err) {
    logger.error(err, "v1: list skills error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /skills/:slug/use — Use a skill in a project
// ═══════════════════════════════════════════════════════════

const useSkillSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1).max(20000),
});

v1Router.post("/skills/:slug/use", async (req: ApiKeyRequest, res: Response) => {
  try {
    const slug = req.params.slug as string;
    const body = useSkillSchema.parse(req.body);

    const skill = await skillService.getSkillBySlug(slug);
    if (!skill) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found" } });
    }

    if (!(await canAccessProject(body.projectId, req.userId!))) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    // Inject skill content into the prompt and start engine
    const enhancedPrompt = `[Skill: ${skill.name}]\n${skill.content}\n\n---\nUser request: ${body.prompt}`;

    const io = req.app.get("io");
    const { startEngine } = await import("../engine/service");
    const result = await startEngine(body.projectId, enhancedPrompt, io);

    return res.status(201).json({
      data: {
        skillUsed: { slug: skill.slug, name: skill.name },
        engineStatus: "running",
        planSteps: result.planSteps,
        tasks: result.tasks,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Invalid input", details: err.errors } });
    }
    logger.error(err, "v1: use skill error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /usage — Get usage stats for the authenticated user
// ═══════════════════════════════════════════════════════════

v1Router.get("/usage", async (req: ApiKeyRequest, res: Response) => {
  try {
    const summary = await usageTracker.getUserSummary(req.userId!);
    if (!summary) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }
    return res.json({ data: summary });
  } catch (err) {
    logger.error(err, "v1: get usage error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});
