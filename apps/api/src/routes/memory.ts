import { Router, Response } from "express";
import { z } from "zod";
import { memoryService } from "../services/memory-service";
import type { AuthRequest } from "../middleware/auth";

export const memoryRouter = Router();

// GET /api/memory — list all memories for the user
memoryRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const memories = await memoryService.getUserMemories(userId);
    res.json({ memories });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
  }
});

// GET /api/memory/summary — short summary for dashboard indicator
memoryRouter.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const summary = await memoryService.getMemorySummary(userId);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
  }
});

const saveMemorySchema = z.object({
  category: z.string().min(1).max(50),
  key: z.string().min(1).max(100),
  value: z.string().min(1).max(2000),
  source: z.enum(["auto", "manual"]).default("manual"),
});

// PUT /api/memory — save/update a memory
memoryRouter.put("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const body = saveMemorySchema.parse(req.body);
    const memory = await memoryService.saveMemory(
      userId,
      body.category,
      body.key,
      body.value,
      body.source
    );
    res.json({ memory });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return res.status(400).json({ error: { code: "VALIDATION", message: err.message } });
    }
    res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
  }
});

// DELETE /api/memory/all — clear all memories
memoryRouter.delete("/all", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await memoryService.clearAllMemories(userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
  }
});

// DELETE /api/memory/:id — delete a single memory
memoryRouter.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await memoryService.deleteMemory(userId, req.params.id as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
  }
});

// POST /api/memory/extract/:projectId — force extraction from a project
memoryRouter.post("/extract/:projectId", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    await memoryService.extractMemoriesFromProject(userId, req.params.projectId as string);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL", message: err.message } });
  }
});
