import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { checkCredits } from "../middleware/credits";
import { runAgent } from "../agent/orchestrator";
import { sandboxManager } from "../sandbox/manager";
import { Server as SocketIOServer } from "socket.io";

export const messageRouter: RouterType = Router();

const sendMessageSchema = z.object({
  content: z.string().min(1),
});

// Get message history
messageRouter.get("/:id/messages", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const messages = await prisma.message.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    });
    return res.json(messages);
  } catch (err) {
    console.error("Get messages error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Send message (triggers agent)
messageRouter.post("/:id/messages", checkCredits, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const body = sendMessageSchema.parse(req.body);
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        projectId: project.id,
        role: "USER",
        content: body.content,
      },
    });

    // Update credits
    await prisma.user.update({
      where: { id: req.userId },
      data: { creditsUsed: { increment: 1 } },
    });

    // Start agent in background (don't await)
    const io: SocketIOServer = req.app.get("io");
    runAgent(project.id, body.content, io).catch((err: Error) => {
      console.error("Agent error:", err);
      io.to(`project:${project.id}`).emit("event", {
        type: "agent:error",
        data: { message: err.message },
      });
    });

    return res.status(201).json(userMessage);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    console.error("Send message error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Stop agent execution
messageRouter.post("/:id/stop", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const { agentAbortControllers } = await import("../agent/orchestrator");
    const controller = agentAbortControllers.get(project.id);
    if (controller) {
      controller.abort();
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("Stop agent error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Undo — restore to most recent snapshot
messageRouter.post("/:id/undo", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const snapshot = await prisma.snapshot.findFirst({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
    });

    if (!snapshot) {
      return res.status(404).json({ error: "No snapshots to undo to" });
    }

    // Restore files from snapshot
    const files = snapshot.files as Record<string, string>;
    await sandboxManager.restoreFiles(project.sandboxId, files);

    // Notify clients
    const io: SocketIOServer = req.app.get("io");
    io.to(`project:${project.id}`).emit("event", { type: "preview:reload", data: {} });

    // Delete this snapshot so next undo goes further back
    await prisma.snapshot.delete({ where: { id: snapshot.id } });

    return res.json({
      success: true,
      snapshot: { id: snapshot.id, label: snapshot.label, createdAt: snapshot.createdAt },
    });
  } catch (err) {
    console.error("Undo error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get snapshots (timeline)
messageRouter.get("/:id/snapshots", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const snapshots = await prisma.snapshot.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, label: true, createdAt: true },
    });
    return res.json(snapshots);
  } catch (err) {
    console.error("Get snapshots error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Restore to specific snapshot
messageRouter.post("/:id/snapshots/:snapshotId/restore", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const snapshotId = req.params.snapshotId as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const snapshot = await prisma.snapshot.findFirst({
      where: { id: snapshotId, projectId: project.id },
    });
    if (!snapshot) {
      return res.status(404).json({ error: "Snapshot not found" });
    }

    const files = snapshot.files as Record<string, string>;
    await sandboxManager.restoreFiles(project.sandboxId, files);

    const io: SocketIOServer = req.app.get("io");
    io.to(`project:${project.id}`).emit("event", { type: "preview:reload", data: {} });

    return res.json({ success: true, label: snapshot.label });
  } catch (err) {
    console.error("Restore snapshot error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
