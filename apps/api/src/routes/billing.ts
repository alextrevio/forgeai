import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";

export const billingRouter: RouterType = Router();

const PLAN_LIMITS: Record<string, { credits: number; maxProjects: number }> = {
  FREE: { credits: 50, maxProjects: 3 },
  PRO: { credits: 500, maxProjects: 20 },
  BUSINESS: { credits: 2000, maxProjects: 100 },
  ENTERPRISE: { credits: -1, maxProjects: -1 },
};

// Get usage stats
billingRouter.get("/usage", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        plan: true,
        creditsUsed: true,
        creditsLimit: true,
        createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get credit usage over time (last 30 days, grouped by day)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const messages = await prisma.message.findMany({
      where: {
        project: { userId: req.userId },
        role: "ASSISTANT",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        creditsConsumed: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by day
    const dailyUsage: Record<string, number> = {};
    for (const msg of messages) {
      const day = msg.createdAt.toISOString().split("T")[0];
      dailyUsage[day] = (dailyUsage[day] || 0) + (msg.creditsConsumed || 0);
    }

    const projectCount = await prisma.project.count({
      where: { userId: req.userId },
    });

    const planLimits = PLAN_LIMITS[user.plan] || PLAN_LIMITS.FREE;

    return res.json({
      plan: user.plan,
      creditsUsed: user.creditsUsed,
      creditsLimit: user.creditsLimit,
      maxProjects: planLimits.maxProjects,
      projectCount,
      dailyUsage,
      memberSince: user.createdAt,
    });
  } catch (err) {
    console.error("Get usage error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Upgrade plan (simulated — no real payment)
const upgradeSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS", "ENTERPRISE"]),
});

billingRouter.post("/upgrade", async (req: AuthRequest, res: Response) => {
  try {
    const body = upgradeSchema.parse(req.body);
    const planLimits = PLAN_LIMITS[body.plan];
    if (!planLimits) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        plan: body.plan,
        creditsLimit: planLimits.credits,
      },
    });

    return res.json({
      success: true,
      plan: body.plan,
      creditsLimit: planLimits.credits,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    console.error("Upgrade error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get available plans
billingRouter.get("/plans", async (_req: AuthRequest, res: Response) => {
  const plans = [
    {
      id: "FREE",
      name: "Free",
      price: 0,
      credits: 50,
      maxProjects: 3,
      features: ["50 AI credits/month", "3 projects", "Community support"],
    },
    {
      id: "PRO",
      name: "Pro",
      price: 19,
      credits: 500,
      maxProjects: 20,
      features: ["500 AI credits/month", "20 projects", "Priority support", "GitHub export", "Custom domains"],
    },
    {
      id: "BUSINESS",
      name: "Business",
      price: 49,
      credits: 2000,
      maxProjects: 100,
      features: ["2000 AI credits/month", "100 projects", "Premium support", "Team collaboration", "Custom branding"],
    },
    {
      id: "ENTERPRISE",
      name: "Enterprise",
      price: -1,
      credits: -1,
      maxProjects: -1,
      features: ["Unlimited credits", "Unlimited projects", "Dedicated support", "SLA", "On-premise option"],
    },
  ];

  return res.json(plans);
});
