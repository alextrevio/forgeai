import { Request, Response, NextFunction } from "express";
import { createAppError } from "./error-handler";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (used when Redis is not available)
const memoryStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.resetAt < now) memoryStore.delete(key);
  }
}, 60_000);

// Plan-based limits
const PLAN_LIMITS: Record<string, { api: number; agent: number }> = {
  FREE: { api: 20, agent: 5 },
  PRO: { api: 60, agent: 15 },
  BUSINESS: { api: 120, agent: 30 },
  ENTERPRISE: { api: 300, agent: 60 },
};

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId || req.ip;
    const key = `${opts.keyPrefix || "rl"}:${userId}`;
    const now = Date.now();

    // Adjust max based on user plan if available
    const plan = (req as any).userPlan;
    let effectiveMax = opts.max;
    if (plan && PLAN_LIMITS[plan]) {
      const planLimit = PLAN_LIMITS[plan];
      effectiveMax = opts.keyPrefix === "agent" ? planLimit.agent : planLimit.api;
    }

    let entry = memoryStore.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      memoryStore.set(key, entry);
    }

    entry.count++;

    res.setHeader("X-RateLimit-Limit", effectiveMax);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, effectiveMax - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > effectiveMax) {
      throw createAppError("RATE_LIMITED", `Rate limit exceeded. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s`);
    }

    next();
  };
}
