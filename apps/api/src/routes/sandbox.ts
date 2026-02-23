import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { sandboxManager } from "../sandbox/manager";

export const sandboxRouter: RouterType = Router();

// Get file tree
sandboxRouter.get("/:id/files", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const tree = await sandboxManager.getFileTree(project.sandboxId);
    return res.json(tree);
  } catch (err) {
    console.error("Get file tree error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Read file
sandboxRouter.get("/:id/files/*", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const filePath = (req.params[0] as string) || "";
    const content = await sandboxManager.readFile(project.sandboxId, filePath);
    return res.json({ path: filePath, content });
  } catch (err) {
    console.error("Read file error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Write file
sandboxRouter.put("/:id/files/*", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const filePath = (req.params[0] as string) || "";
    const { content } = req.body;
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Content must be a string" });
    }

    await sandboxManager.writeFile(project.sandboxId, filePath, content);
    return res.json({ success: true });
  } catch (err) {
    console.error("Write file error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get preview URL
sandboxRouter.get("/:id/preview", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const url = await sandboxManager.getPreviewUrl(project.sandboxId);
    return res.json({ url });
  } catch (err) {
    console.error("Get preview error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});
