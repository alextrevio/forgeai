import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { prisma } from "@forgeai/db";

export interface AuthRequest extends Request {
  userId?: string;
  userPlan?: string;
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "Missing authorization token" } });
  }

  const token = authHeader.slice(7);

  // API Key auth — keys start with "arya_key_"
  if (token.startsWith("arya_key_")) {
    try {
      const keyHash = hashKey(token);
      const apiKey = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { user: { select: { id: true, plan: true } } },
      });

      if (!apiKey) {
        return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid API key" } });
      }

      if (!apiKey.isActive) {
        return res.status(401).json({ error: { code: "AUTH_INVALID", message: "API key is deactivated" } });
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return res.status(401).json({ error: { code: "AUTH_INVALID", message: "API key has expired" } });
      }

      // Update last used timestamp (fire-and-forget)
      prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

      req.userId = apiKey.user.id;
      req.userPlan = apiKey.user.plan;
      return next();
    } catch {
      return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid API key" } });
    }
  }

  // JWT auth
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    req.userId = payload.userId;

    // Attach plan for rate limiting (non-blocking)
    prisma.user.findUnique({ where: { id: payload.userId }, select: { plan: true } })
      .then((user) => { if (user) req.userPlan = user.plan; })
      .catch(() => {});

    next();
  } catch {
    return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid or expired token" } });
  }
}
