import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { canAccessProject, hasTeamRole } from "../services/team-permissions";
import { auditLogService } from "../services/audit-log";

export const projectRouter: RouterType = Router();

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  framework: z.enum(["react-vite", "nextjs", "vue", "landing", "dashboard", "saas", "api-only"]).default("react-vite"),
  template: z.string().optional(),
  customInstructions: z.string().optional(),
});

// List user projects (owned, team, or shared)
projectRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get user's team IDs
    const teamMemberships = await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    });
    const teamIds = teamMemberships.map((m) => m.teamId);

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { userId },
          ...(teamIds.length > 0 ? [{ teamId: { in: teamIds } }] : []),
          { members: { some: { userId } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        framework: true,
        engineStatus: true,
        deployUrl: true,
        userId: true,
        teamId: true,
        team: { select: { id: true, name: true, slug: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json(projects);
  } catch (err) {
    console.error("List projects error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Create project
projectRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const body = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description,
        framework: body.framework,
        template: body.template,
        customInstructions: body.customInstructions,
        userId: req.userId!,
      },
    });
    return res.status(201).json(project);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    console.error("Create project error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get project details
projectRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!(await canAccessProject(id, req.userId!))) {
      return res.status(404).json({ error: "Project not found" });
    }
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true, slug: true } },
        _count: { select: { messages: true, snapshots: true } },
      },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    return res.json(project);
  } catch (err) {
    console.error("Get project error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete project
projectRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    await prisma.project.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    console.error("Delete project error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update project settings (custom instructions)
projectRouter.patch("/:id/settings", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const { customInstructions, settings } = req.body;

    const updateData: Record<string, unknown> = {};
    if (typeof customInstructions === "string") {
      if (customInstructions.length > 5000) {
        return res.status(400).json({ error: "Custom instructions too long (max 5000 chars)" });
      }
      updateData.customInstructions = customInstructions;
    }
    if (settings && typeof settings === "object" && !Array.isArray(settings)) {
      const raw = JSON.stringify(settings);
      if (raw.length > 10000) {
        return res.status(400).json({ error: "Settings payload too large" });
      }
      updateData.settings = raw;
    }

    const updated = await prisma.project.update({
      where: { id, userId: req.userId! },
      data: updateData,
    });

    return res.json(updated);
  } catch (err) {
    console.error("Update settings error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Deploy project (uses deployer agent)
projectRouter.post("/:id/deploy", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { status: "DEPLOYING" },
    });

    const io = req.app.get("io");
    const { runDeploy } = await import("../agent/orchestrator");

    // Run deploy in background
    runDeploy(project.id, io).then(async (result) => {
      if (!result.success) {
        await prisma.project.update({
          where: { id: project.id },
          data: { status: "ACTIVE" },
        });
      }
    }).catch(async (err) => {
      console.error("Deploy error:", err);
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "ACTIVE" },
      });
    });

    return res.json({ status: "deploying" });
  } catch (err) {
    console.error("Deploy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Assign project to a team
projectRouter.put("/:id/team", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;
    const { teamId } = req.body as { teamId: string | null };

    // Must be project owner
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found or not owner" });
    }

    // If assigning to a team, verify user is admin+ in that team
    if (teamId) {
      if (!(await hasTeamRole(teamId, userId, "admin"))) {
        return res.status(403).json({ error: "Must be admin or owner of the target team" });
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { teamId: teamId ?? null },
      include: { team: { select: { id: true, name: true, slug: true } } },
    });

    auditLogService.log({
      teamId: teamId ?? undefined,
      userId,
      action: teamId ? "project.assign_team" : "project.remove_team",
      resource: "project",
      resourceId: id,
      details: { teamId },
      ip: req.ip as string | undefined,
    });

    return res.json(updated);
  } catch (err) {
    console.error("Assign project to team error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
