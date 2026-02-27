import { Response, NextFunction } from "express";
import { createHash } from "crypto";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "./auth";

export interface ApiKeyRequest extends AuthRequest {
  apiKeyId?: string;
  apiKeyScopes?: string[];
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Scope mapping: route pattern + method → required scope
const SCOPE_MAP: Array<{ pattern: RegExp; method: string; scope: string }> = [
  { pattern: /^\/projects$/, method: "GET", scope: "projects.read" },
  { pattern: /^\/projects$/, method: "POST", scope: "projects.write" },
  { pattern: /^\/projects\/[^/]+$/, method: "GET", scope: "projects.read" },
  { pattern: /^\/projects\/[^/]+$/, method: "DELETE", scope: "projects.write" },
  { pattern: /^\/engine\/start$/, method: "POST", scope: "engine.start" },
  { pattern: /^\/engine\/status\/[^/]+$/, method: "GET", scope: "engine.read" },
  { pattern: /^\/engine\/control$/, method: "POST", scope: "engine.start" },
  { pattern: /^\/skills/, method: "GET", scope: "skills.read" },
  { pattern: /^\/skills\/[^/]+\/use$/, method: "POST", scope: "engine.start" },
  { pattern: /^\/usage/, method: "GET", scope: "usage.read" },
];

function getScopeForRoute(path: string, method: string): string | null {
  for (const entry of SCOPE_MAP) {
    if (entry.method === method && entry.pattern.test(path)) {
      return entry.scope;
    }
  }
  return null;
}

/**
 * Authenticate requests using `arya_key_*` API keys with scope enforcement.
 * Attaches userId, apiKeyId, apiKeyScopes to request.
 */
export async function apiKeyAuth(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: { code: "AUTH_REQUIRED", message: "Missing API key. Use: Authorization: Bearer arya_key_..." },
    });
  }

  const key = authHeader.slice(7);

  if (!key.startsWith("arya_key_")) {
    return res.status(401).json({
      error: { code: "AUTH_INVALID", message: "Invalid API key format. Keys start with arya_key_" },
    });
  }

  try {
    const keyHash = hashKey(key);
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: { select: { id: true, plan: true } } },
    });

    if (!apiKey || !apiKey.isActive) {
      return res.status(401).json({
        error: { code: "AUTH_INVALID", message: "Invalid or revoked API key" },
      });
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return res.status(401).json({
        error: { code: "AUTH_EXPIRED", message: "API key has expired" },
      });
    }

    // Check scopes — strip the /api/v1 prefix before matching
    const routePath = req.path; // already relative to router mount
    const requiredScope = getScopeForRoute(routePath, req.method);
    if (requiredScope && !apiKey.scopes.includes(requiredScope)) {
      return res.status(403).json({
        error: {
          code: "INSUFFICIENT_SCOPE",
          message: `This key lacks the "${requiredScope}" scope`,
          required: requiredScope,
          available: apiKey.scopes,
        },
      });
    }

    req.userId = apiKey.user.id;
    req.userPlan = apiKey.user.plan;
    req.apiKeyId = apiKey.id;
    req.apiKeyScopes = apiKey.scopes;

    // Track usage (fire-and-forget)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    next();
  } catch {
    return res.status(401).json({
      error: { code: "AUTH_INVALID", message: "Invalid API key" },
    });
  }
}
