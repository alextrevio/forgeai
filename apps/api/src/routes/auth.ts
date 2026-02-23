import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@forgeai/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { registerSchema, loginSchema, updateSettingsSchema, createApiKeySchema, validateBody } from "../lib/validation";
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
      return res.status(401).json({ error: { code: "AUTH_INVALID", message: "Invalid credentials" } });
    }

    const tokens = await createTokenPair(user.id);
    logger.info({ userId: user.id }, "User logged in");

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

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        settings: settings as any,
        name: settings.name || undefined,
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

authRouter.get("/api-keys", authenticate, async (req: AuthRequest, res: Response) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.userId },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return res.json(keys);
});

authRouter.post("/api-keys", authenticate, validateBody(createApiKeySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;

    // Generate a random API key
    const rawKey = `fai_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const prefix = rawKey.slice(0, 12);

    await prisma.apiKey.create({
      data: { userId: req.userId!, name, keyHash, prefix },
    });

    // Only time the full key is returned
    return res.status(201).json({ key: rawKey, prefix, name });
  } catch (err) {
    logger.error(err, "Create API key error");
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
