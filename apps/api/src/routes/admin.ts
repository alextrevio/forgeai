import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { AuthRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { getAllJobs, getQueueStats } from "../services/queue/job-queue";

export const adminRouter: RouterType = Router();

// ═══════════════════════════════════════════════════════════
// GET /jobs — List all jobs across queues
// ═══════════════════════════════════════════════════════════

adminRouter.get("/jobs", async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as "active" | "waiting" | "completed" | "failed" | "delayed" | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const jobs = await getAllJobs(status, limit);

    return res.json({ jobs, count: jobs.length });
  } catch (err) {
    logger.error(err, "Admin list jobs error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /jobs/stats — Queue statistics
// ═══════════════════════════════════════════════════════════

adminRouter.get("/jobs/stats", async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await getQueueStats();

    return res.json({
      timestamp: new Date().toISOString(),
      queues: stats,
    });
  } catch (err) {
    logger.error(err, "Admin queue stats error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
