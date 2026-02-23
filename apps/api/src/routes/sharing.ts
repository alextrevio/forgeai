import { Router } from "express";
import { prisma } from "@forgeai/db";
import type { Server as SocketIOServer } from "socket.io";

const router = Router();

// POST /api/projects/:id/share — Invite a collaborator
router.post("/:id/share", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;
    const { email, role } = req.body;

    if (!email || !role || !["viewer", "editor"].includes(role)) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "email and role (viewer|editor) required" } });
    }

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found or not owned by you" } });
    }

    // Find the invited user
    const invitedUser = await prisma.user.findUnique({ where: { email } });
    if (!invitedUser) {
      return res.status(404).json({ error: { code: "USER_NOT_FOUND", message: "No user found with that email" } });
    }

    if (invitedUser.id === userId) {
      return res.status(400).json({ error: { code: "SELF_INVITE", message: "Cannot invite yourself" } });
    }

    // Create or update membership
    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: invitedUser.id } },
      create: { projectId: id, userId: invitedUser.id, role },
      update: { role },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    // Create notification for invited user
    await prisma.notification.create({
      data: {
        userId: invitedUser.id,
        type: "project_shared",
        title: "Project shared with you",
        message: `You have been invited as ${role} to "${project.name}"`,
        projectId: id,
      },
    });

    // Emit notification via WebSocket
    const io: SocketIOServer = req.app.get("io");
    io.to(`user:${invitedUser.id}`).emit("event", {
      type: "notification",
      data: {
        notification: {
          type: "project_shared",
          title: "Project shared with you",
          message: `You have been invited as ${role} to "${project.name}"`,
          projectId: id,
        },
      },
    });

    res.json({ member: { id: member.id, userId: member.userId, role: member.role, user: member.user, invitedAt: member.invitedAt } });
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/members — List project members
router.get("/:id/members", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Verify access (owner or member)
    const project = await prisma.project.findFirst({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    const isMember = project.userId === userId || await prisma.projectMember.findFirst({ where: { projectId: id, userId } });
    if (!isMember) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "No access to this project" } });
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { invitedAt: "asc" },
    });

    // Include owner as first member
    const owner = await prisma.user.findUnique({
      where: { id: project.userId },
      select: { id: true, email: true, name: true },
    });

    res.json({
      owner: { ...owner, role: "owner" },
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        user: m.user,
        invitedAt: m.invitedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/projects/:id/members/:memberId — Remove a member
router.delete("/:id/members/:memberId", async (req, res, next) => {
  try {
    const { id, memberId } = req.params;
    const userId = (req as any).userId;

    // Verify ownership
    const project = await prisma.project.findFirst({ where: { id, userId } });
    if (!project) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Only the owner can remove members" } });
    }

    await prisma.projectMember.deleteMany({
      where: { id: memberId, projectId: id },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/fork — Fork a project
router.post("/:id/fork", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    // Verify access (owner or member)
    const project = await prisma.project.findFirst({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    const hasAccess =
      project.userId === userId ||
      (await prisma.projectMember.findFirst({ where: { projectId: id, userId } }));
    if (!hasAccess) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "No access to this project" } });
    }

    // Create forked project
    const forkedProject = await prisma.project.create({
      data: {
        name: `${project.name} (Fork)`,
        description: project.description,
        userId,
        framework: project.framework,
        settings: project.settings ?? undefined,
        customInstructions: project.customInstructions,
        template: project.template,
        forkedFrom: id,
        status: "ACTIVE",
      },
    });

    // Copy sandbox files if sandbox exists
    const { sandboxManager } = await import("../sandbox/manager");

    if (project.sandboxId) {
      try {
        // Get all files from original sandbox
        const files = await sandboxManager.getFileTree(project.sandboxId);
        const fileContents: Record<string, string> = {};

        const collectFiles = async (nodes: any[], basePath = "") => {
          for (const node of nodes) {
            const fullPath = basePath ? `${basePath}/${node.name}` : node.name;
            if (node.type === "file") {
              try {
                const content = await sandboxManager.readFile(project.sandboxId!, fullPath);
                fileContents[fullPath] = content;
              } catch {
                // Skip unreadable files
              }
            } else if (node.children) {
              await collectFiles(node.children, fullPath);
            }
          }
        };
        await collectFiles(files);

        // Create new sandbox and write files
        const newSandbox = await sandboxManager.createSandbox(forkedProject.id, project.framework);
        for (const [path, content] of Object.entries(fileContents)) {
          await sandboxManager.writeFile(newSandbox.containerId, path, content);
        }

        await prisma.project.update({
          where: { id: forkedProject.id },
          data: { sandboxId: newSandbox.containerId },
        });
      } catch (err) {
        console.warn("Failed to copy sandbox files during fork:", err);
      }
    }

    res.json(forkedProject);
  } catch (err) {
    next(err);
  }
});

export { router as sharingRouter };
