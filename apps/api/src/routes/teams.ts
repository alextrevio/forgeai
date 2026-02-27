import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { auditLogService } from "../services/audit-log";
import { hasTeamRole, getTeamMembership } from "../services/team-permissions";
import { notificationService } from "../services/notifications";
import { logger } from "../lib/logger";

export const teamRouter: RouterType = Router();

// ── Validation Schemas ──────────────────────────────────

const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

const updateRoleSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]),
});

// ═══════════════════════════════════════════════════════════
// POST / — Create team
// ═══════════════════════════════════════════════════════════

teamRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const body = createTeamSchema.parse(req.body);
    const userId = req.userId!;

    // Check slug uniqueness
    const existing = await prisma.team.findUnique({ where: { slug: body.slug } });
    if (existing) {
      return res.status(409).json({ error: "Team slug already taken" });
    }

    const team = await prisma.team.create({
      data: {
        name: body.name,
        slug: body.slug,
        ownerId: userId,
        members: {
          create: { userId, role: "owner" },
        },
      },
      include: {
        _count: { select: { members: true } },
      },
    });

    auditLogService.log({
      teamId: team.id,
      userId,
      action: "team.create",
      resource: "team",
      resourceId: team.id,
      ip: req.ip as string | undefined,
    });

    return res.status(201).json(team);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Create team error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET / — List user's teams
// ═══════════════════════════════════════════════════════════

teamRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const teams = await prisma.team.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        _count: { select: { members: true, projects: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(teams);
  } catch (err) {
    logger.error(err, "List teams error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /:id — Team details
// ═══════════════════════════════════════════════════════════

teamRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.id as string;
    const userId = req.userId!;

    const membership = await getTeamMembership(teamId, userId);
    if (!membership) {
      return res.status(404).json({ error: "Team not found" });
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
          orderBy: { joinedAt: "asc" },
        },
        _count: { select: { members: true, projects: true } },
      },
    });

    return res.json(team);
  } catch (err) {
    logger.error(err, "Get team error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /:id/invite — Invite member by email
// ═══════════════════════════════════════════════════════════

teamRouter.post("/:id/invite", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.id as string;
    const userId = req.userId!;
    const body = inviteSchema.parse(req.body);

    // Check admin+ permission
    if (!(await hasTeamRole(teamId, userId, "admin"))) {
      return res.status(403).json({ error: "Admin role required to invite members" });
    }

    // Find user by email
    const invitedUser = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true },
    });
    if (!invitedUser) {
      return res.status(404).json({ error: "User not found with that email" });
    }

    // Upsert membership
    const member = await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: invitedUser.id } },
      create: { teamId, userId: invitedUser.id, role: body.role },
      update: { role: body.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    // Send notification to invited user
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true } });
    await notificationService.notifyInApp(invitedUser.id, {
      title: "Invitacion a equipo",
      message: `Fuiste invitado al equipo "${team?.name || ""}".`,
      type: "team_invite",
    });

    // Emit socket event to invited user
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${invitedUser.id}`).emit("event", {
        type: "team:invite",
        data: { teamId, teamName: team?.name, role: body.role },
      });
    }

    auditLogService.log({
      teamId,
      userId,
      action: "team.invite",
      resource: "team_member",
      resourceId: member.id,
      details: { email: body.email, role: body.role },
      ip: req.ip as string | undefined,
    });

    return res.status(201).json(member);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Invite team member error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /:id/members/:userId — Change member role
// ═══════════════════════════════════════════════════════════

teamRouter.put("/:id/members/:userId", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.id as string;
    const targetUserId = req.params.userId as string;
    const actingUserId = req.userId!;
    const body = updateRoleSchema.parse(req.body);

    // Check admin+ permission
    if (!(await hasTeamRole(teamId, actingUserId, "admin"))) {
      return res.status(403).json({ error: "Admin role required" });
    }

    // Cannot change owner's role
    const target = await getTeamMembership(teamId, targetUserId);
    if (!target) {
      return res.status(404).json({ error: "Member not found" });
    }
    if (target.role === "owner") {
      return res.status(403).json({ error: "Cannot change the owner's role" });
    }

    const updated = await prisma.teamMember.update({
      where: { id: target.id },
      data: { role: body.role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    auditLogService.log({
      teamId,
      userId: actingUserId,
      action: "team.role_change",
      resource: "team_member",
      resourceId: target.id,
      details: { targetUserId, oldRole: target.role, newRole: body.role },
      ip: req.ip as string | undefined,
    });

    return res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Update team member role error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /:id/members/:userId — Remove member
// ═══════════════════════════════════════════════════════════

teamRouter.delete("/:id/members/:userId", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.id as string;
    const targetUserId = req.params.userId as string;
    const actingUserId = req.userId!;

    // Self-removal is always allowed (except owner)
    const isSelf = targetUserId === actingUserId;
    if (!isSelf && !(await hasTeamRole(teamId, actingUserId, "admin"))) {
      return res.status(403).json({ error: "Admin role required to remove members" });
    }

    const target = await getTeamMembership(teamId, targetUserId);
    if (!target) {
      return res.status(404).json({ error: "Member not found" });
    }
    if (target.role === "owner") {
      return res.status(403).json({ error: "Cannot remove the team owner" });
    }

    await prisma.teamMember.delete({ where: { id: target.id } });

    auditLogService.log({
      teamId,
      userId: actingUserId,
      action: isSelf ? "team.leave" : "team.remove_member",
      resource: "team_member",
      resourceId: target.id,
      details: { targetUserId },
      ip: req.ip as string | undefined,
    });

    return res.json({ success: true });
  } catch (err) {
    logger.error(err, "Remove team member error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /:id/audit — Paginated audit log
// ═══════════════════════════════════════════════════════════

teamRouter.get("/:id/audit", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = req.params.id as string;
    const userId = req.userId!;

    // Must be a team member
    const membership = await getTeamMembership(teamId, userId);
    if (!membership) {
      return res.status(404).json({ error: "Team not found" });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const before = req.query.before as string | undefined;

    const result = await auditLogService.getTeamLogs(teamId, { limit, before });
    return res.json(result);
  } catch (err) {
    logger.error(err, "Get team audit log error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
