import { Response, NextFunction } from "express";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "./auth";

export async function checkCredits(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { creditsUsed: true, creditsLimit: true, plan: true },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // Unlimited credits for enterprise
    if (user.plan === "ENTERPRISE" || user.creditsLimit === -1) {
      return next();
    }

    if (user.creditsUsed >= user.creditsLimit) {
      return res.status(402).json({
        error: "Credit limit reached",
        creditsUsed: user.creditsUsed,
        creditsLimit: user.creditsLimit,
        plan: user.plan,
        upgradeUrl: "/dashboard/billing",
      });
    }

    next();
  } catch (err) {
    console.error("Credit check error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
