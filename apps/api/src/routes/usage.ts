import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { usageTracker, PLAN_BUDGETS } from "../services/usage-tracker";
import { logger } from "../lib/logger";

export const usageRouter: RouterType = Router();

// ═══════════════════════════════════════════════════════════
// GET / — Usage summary for current user
// ═══════════════════════════════════════════════════════════

usageRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const summary = await usageTracker.getUserSummary(req.userId!);
    if (!summary) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(summary);
  } catch (err) {
    logger.error(err, "Get usage summary error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /records — Paginated usage records
// ═══════════════════════════════════════════════════════════

usageRouter.get("/records", async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const projectId = req.query.projectId as string | undefined;

    const result = await usageTracker.getRecords(req.userId!, { limit, offset, projectId });
    return res.json(result);
  } catch (err) {
    logger.error(err, "Get usage records error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /by-project/:projectId — Usage for a specific project
// ═══════════════════════════════════════════════════════════

usageRouter.get("/by-project/:projectId", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;

    // Verify ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
      select: { id: true, name: true },
    });
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const usage = await usageTracker.getProjectUsage(projectId);
    return res.json({ project: { id: project.id, name: project.name }, ...usage });
  } catch (err) {
    logger.error(err, "Get project usage error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /budget — Update spending cap
// ═══════════════════════════════════════════════════════════

const budgetSchema = z.object({
  monthlyBudget: z.number().min(0).max(100000),
});

usageRouter.put("/budget", async (req: AuthRequest, res: Response) => {
  try {
    const body = budgetSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { monthlyBudget: body.monthlyBudget },
      select: { monthlyBudget: true, totalSpent: true, plan: true },
    });

    return res.json({
      success: true,
      monthlyBudget: user.monthlyBudget,
      totalSpent: user.totalSpent,
      remaining: Math.max(0, user.monthlyBudget - user.totalSpent),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Update budget error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
