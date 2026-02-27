import { z } from "zod";
import { Request, Response, NextFunction } from "express";

// ── Auth schemas ─────────────────────────────────────────
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Project schemas ──────────────────────────────────────
export const createProjectSchema = z.object({
  name: z.string().min(1).max(100, "Project name must be under 100 characters"),
  framework: z.enum(["react-vite", "nextjs", "vue", "landing", "dashboard", "saas", "api-only"]).optional(),
  description: z.string().max(500).optional(),
  template: z.string().max(50).optional(),
});

// ── Message schemas ──────────────────────────────────────
export const sendMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(10000, "Message too long (max 10000 chars)"),
});

// ── Share schemas ────────────────────────────────────────
export const shareProjectSchema = z.object({
  email: z.string().email("Invalid email"),
  role: z.enum(["viewer", "editor"]),
});

// ── Settings schemas ─────────────────────────────────────
export const updateSettingsSchema = z.object({
  settings: z.object({
    theme: z.enum(["dark", "light", "system"]).optional(),
    editorFontSize: z.number().min(10).max(24).optional(),
    defaultFramework: z.string().optional(),
    autoSave: z.boolean().optional(),
    anthropicApiKey: z.string().optional(),
    openaiApiKey: z.string().optional(),
    name: z.string().optional(),
    // Onboarding fields
    projectTypes: z.array(z.string()).optional(),
    preferredTemplate: z.string().optional(),
    onboarded: z.boolean().optional(),
  }).passthrough(), // Allow additional fields without failing validation
});

// ── API Key schemas ──────────────────────────────────────
export const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
});

// ── Middleware factory ────────────────────────────────────
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "Validation failed",
          details: result.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
      });
    }
    req.body = result.data;
    next();
  };
}
