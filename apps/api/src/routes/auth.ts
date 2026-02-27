import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@forgeai/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { registerSchema, loginSchema, updateSettingsSchema, createApiKeySchema, validateBody } from "../lib/validation";
import { Sentry } from "../lib/sentry";
import { trackServerEvent } from "../lib/posthog";
import { logger } from "../lib/logger";

export const authRouter: import("express").Router = Router();

// ── Token helpers ────────────────────────────────────────

function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "15m" });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, process.env.JWT_REFRESH_SECRET!, { expiresIn: "7d" });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function createTokenPair(userId: string) {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);

  // Store refresh token hash in DB
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}

// ── Register ─────────────────────────────────────────────

authRouter.post("/register", validateBody(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { code: "CONFLICT", message: "Email already registered" } });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name: name || null },
    });

    const tokens = await createTokenPair(user.id);
    logger.info({ userId: user.id }, "User registered");
    trackServerEvent(user.id, 'user_registered', { method: 'email', plan: user.plan });

    return res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      ...tokens,
    });
  } catch (err) {
    logger.error(err, "Register error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ── Login ────────────────────────────────────────────────

authRouter.post("/login", validateBody(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid credentials" } });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      Sentry.captureMessage('Failed login attempt', {
        level: 'warning',
        tags: { auth_event: 'login_failed' },
        extra: { email, reason: 'invalid_password' },
      });
      return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid credentials" } });
    }

    const tokens = await createTokenPair(user.id);
    logger.info({ userId: user.id }, "User logged in");
    trackServerEvent(user.id, 'user_logged_in', { method: 'email' });

    return res.json({
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      ...tokens,
    });
  } catch (err) {
    logger.error(err, "Login error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ── Refresh (rotate) ─────────────────────────────────────

authRouter.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Refresh token required" } });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
    const tokenHash = hashToken(refreshToken);

    // Find and delete the used refresh token (rotation)
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored) {
      // Token reuse detected — revoke all tokens for this user
      await prisma.refreshToken.deleteMany({ where: { userId: payload.userId } });
      logger.warn({ userId: payload.userId }, "Refresh token reuse detected, all sessions revoked");
      return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Token has been revoked" } });
    }

    // Delete the old token
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    // Issue new pair
    const tokens = await createTokenPair(payload.userId);
    return res.json(tokens);
  } catch {
    return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid refresh token" } });
  }
});

// ── Logout ───────────────────────────────────────────────

authRouter.post("/logout", authenticate, async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(refreshToken) } });
  }
  return res.json({ message: "Logged out" });
});

// ── Get current user ─────────────────────────────────────

authRouter.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        creditsUsed: true,
        creditsLimit: true,
        settings: true,
        createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    }
    return res.json(user);
  } catch (err) {
    logger.error(err, "Me error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ── Update settings ──────────────────────────────────────

authRouter.patch("/me/settings", authenticate, validateBody(updateSettingsSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { settings } = req.body;

    // Merge with existing settings instead of replacing
    const existing = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { settings: true },
    });
    const existingSettings = (existing?.settings as Record<string, unknown>) || {};
    const merged = { ...existingSettings, ...settings };

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        settings: merged as any,
        ...(settings.name ? { name: settings.name } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        creditsUsed: true,
        creditsLimit: true,
        settings: true,
        createdAt: true,
      },
    });

    return res.json(user);
  } catch (err) {
    logger.error(err, "Update settings error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

// ── API Keys ─────────────────────────────────────────────

const ALL_SCOPES = [
  "projects.read",
  "projects.write",
  "engine.start",
  "engine.read",
  "skills.read",
  "usage.read",
];

authRouter.get("/api-keys", authenticate, async (req: AuthRequest, res: Response) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.userId },
    select: { id: true, name: true, prefix: true, scopes: true, isActive: true, expiresAt: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json(keys);
});

authRouter.post("/api-keys", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, scopes, expiresInDays } = req.body;
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 100) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "Name is required (1-100 chars)" } });
    }

    // Validate scopes
    const requestedScopes: string[] = Array.isArray(scopes) ? scopes : ALL_SCOPES;
    const invalidScopes = requestedScopes.filter((s: string) => !ALL_SCOPES.includes(s));
    if (invalidScopes.length > 0) {
      return res.status(400).json({ error: { code: "VALIDATION", message: `Invalid scopes: ${invalidScopes.join(", ")}`, validScopes: ALL_SCOPES } });
    }

    // Generate arya_key_ prefixed API key
    const rawKey = `arya_key_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 17); // "arya_key_" + 8 chars

    let expiresAt: Date | null = null;
    if (expiresInDays && typeof expiresInDays === "number" && expiresInDays > 0) {
      expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.userId!,
        name,
        keyHash,
        prefix,
        scopes: requestedScopes,
        isActive: true,
        expiresAt,
      },
    });

    // Only time the full key is returned
    return res.status(201).json({
      key: rawKey,
      id: apiKey.id,
      prefix,
      name,
      scopes: requestedScopes,
      expiresAt,
    });
  } catch (err) {
    logger.error(err, "Create API key error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

authRouter.patch("/api-keys/:keyId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const keyId = req.params.keyId as string;
    const { isActive } = req.body;

    const key = await prisma.apiKey.findFirst({
      where: { id: keyId, userId: req.userId },
    });
    if (!key) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "API key not found" } });
    }

    const updated = await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: typeof isActive === "boolean" ? isActive : key.isActive },
      select: { id: true, name: true, prefix: true, scopes: true, isActive: true, expiresAt: true, lastUsedAt: true, createdAt: true },
    });

    return res.json(updated);
  } catch (err) {
    logger.error(err, "Update API key error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

authRouter.delete("/api-keys/:keyId", authenticate, async (req: AuthRequest, res: Response) => {
  const keyId = req.params.keyId as string;
  await prisma.apiKey.deleteMany({
    where: { id: keyId, userId: req.userId },
  });
  return res.json({ message: "API key deleted" });
});

// ── Webhooks ─────────────────────────────────────────────

authRouter.get("/webhooks", authenticate, async (req: AuthRequest, res: Response) => {
  const webhooks = await prisma.webhook.findMany({
    where: { userId: req.userId },
    select: { id: true, url: true, events: true, isActive: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json(webhooks);
});

authRouter.post("/webhooks", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { url, events } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: { code: "VALIDATION", message: "URL is required" } });
    }

    const validEvents = ["engine.completed", "engine.failed", "engine.started", "project.created", "project.deleted"];
    const requestedEvents: string[] = Array.isArray(events) ? events : validEvents;
    const invalidEvents = requestedEvents.filter((e: string) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return res.status(400).json({ error: { code: "VALIDATION", message: `Invalid events: ${invalidEvents.join(", ")}`, validEvents } });
    }

    // Generate a webhook signing secret
    const secret = `whsec_${randomBytes(24).toString("hex")}`;

    const webhook = await prisma.webhook.create({
      data: {
        userId: req.userId!,
        url,
        events: requestedEvents,
        secret,
        isActive: true,
      },
    });

    // Return the secret only on creation
    return res.status(201).json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
      secret,
      createdAt: webhook.createdAt,
    });
  } catch (err) {
    logger.error(err, "Create webhook error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

authRouter.patch("/webhooks/:webhookId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const webhookId = req.params.webhookId as string;
    const webhook = await prisma.webhook.findFirst({
      where: { id: webhookId, userId: req.userId },
    });
    if (!webhook) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Webhook not found" } });
    }

    const { url, events, isActive } = req.body;
    const data: Record<string, unknown> = {};
    if (typeof url === "string") data.url = url;
    if (Array.isArray(events)) data.events = events;
    if (typeof isActive === "boolean") data.isActive = isActive;

    const updated = await prisma.webhook.update({
      where: { id: webhookId },
      data,
      select: { id: true, url: true, events: true, isActive: true, createdAt: true, updatedAt: true },
    });

    return res.json(updated);
  } catch (err) {
    logger.error(err, "Update webhook error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});

authRouter.delete("/webhooks/:webhookId", authenticate, async (req: AuthRequest, res: Response) => {
  const webhookId = req.params.webhookId as string;
  await prisma.webhook.deleteMany({
    where: { id: webhookId, userId: req.userId },
  });
  return res.json({ message: "Webhook deleted" });
});

authRouter.get("/webhooks/:webhookId/deliveries", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const webhookId = req.params.webhookId as string;
    const webhook = await prisma.webhook.findFirst({
      where: { id: webhookId, userId: req.userId },
    });
    if (!webhook) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Webhook not found" } });
    }

    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, event: true, statusCode: true, success: true, durationMs: true, createdAt: true },
    });

    return res.json(deliveries);
  } catch (err) {
    logger.error(err, "Get webhook deliveries error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
  }
});
