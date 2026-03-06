import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { encrypt } from "../lib/encryption";
import { logger } from "../lib/logger";

export const settingsRouter: RouterType = Router();

// ═══════════════════════════════════════════════════════════════════
// PUT /api-keys — Save encrypted provider API keys
// ═══════════════════════════════════════════════════════════════════

const saveKeysSchema = z.object({
  anthropic: z.string().optional(),
  openai: z.string().optional(),
});

settingsRouter.put("/api-keys", async (req: AuthRequest, res: Response) => {
  try {
    const body = saveKeysSchema.parse(req.body);
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const settings = (user?.settings as Record<string, unknown>) || {};

    if (body.anthropic) {
      settings.encryptedAnthropicKey = encrypt(body.anthropic);
    }
    if (body.openai) {
      settings.encryptedOpenaiKey = encrypt(body.openai);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { settings: settings as Prisma.InputJsonValue },
    });

    return res.json({
      anthropic: !!settings.encryptedAnthropicKey,
      openai: !!settings.encryptedOpenaiKey,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Save provider API keys error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// GET /api-keys — Check which provider keys are configured
// ═══════════════════════════════════════════════════════════════════

settingsRouter.get("/api-keys", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    const settings = (user?.settings as Record<string, unknown>) || {};

    return res.json({
      anthropic: !!settings.encryptedAnthropicKey,
      openai: !!settings.encryptedOpenaiKey,
    });
  } catch (err) {
    logger.error(err, "Get provider API key status error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// POST /api-keys/validate — Validate a provider API key
// ═══════════════════════════════════════════════════════════════════

const validateKeySchema = z.object({
  provider: z.enum(["anthropic"]),
  key: z.string().min(1),
});

settingsRouter.post("/api-keys/validate", async (req: AuthRequest, res: Response) => {
  try {
    const body = validateKeySchema.parse(req.body);

    if (body.provider === "anthropic") {
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": body.key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });

        if (response.ok) {
          return res.json({ valid: true });
        }

        const errorBody = await response.json().catch(() => ({}));
        const message = (errorBody as any)?.error?.message || `API returned ${response.status}`;
        return res.json({ valid: false, error: message });
      } catch (err: any) {
        const message = err?.message || "Failed to validate key";
        return res.json({ valid: false, error: message });
      }
    }

    return res.json({ valid: false, error: "Unsupported provider" });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    logger.error(err, "Validate provider API key error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
