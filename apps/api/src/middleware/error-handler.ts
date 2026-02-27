import { Request, Response, NextFunction } from "express";
import { Sentry } from "../lib/sentry";
import { logger } from "../lib/logger";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export const ERROR_CODES = {
  AUTH_REQUIRED: { status: 401, message: "Authentication required" },
  AUTH_INVALID: { status: 401, message: "Invalid credentials" },
  FORBIDDEN: { status: 403, message: "Access denied" },
  NOT_FOUND: { status: 404, message: "Resource not found" },
  INVALID_INPUT: { status: 400, message: "Invalid input" },
  CREDITS_DEPLETED: { status: 402, message: "Credits depleted" },
  RATE_LIMITED: { status: 429, message: "Too many requests" },
  SANDBOX_ERROR: { status: 500, message: "Sandbox error" },
  AGENT_ERROR: { status: 500, message: "Agent processing error" },
  INTERNAL: { status: 500, message: "Internal server error" },
} as const;

export function createAppError(code: keyof typeof ERROR_CODES, details?: string): AppError {
  const errorDef = ERROR_CODES[code];
  const error: AppError = new Error(details || errorDef.message);
  error.statusCode = errorDef.status;
  error.code = code;
  return error;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL";

  if (statusCode >= 500) {
    logger.error({ err, path: req.path, method: req.method }, `[${code}] ${err.message}`);
    Sentry.captureException(err, {
      tags: { error_code: code, path: req.path, method: req.method },
    });
  } else {
    logger.warn({ code, path: req.path, method: req.method }, err.message);
  }

  res.status(statusCode).json({
    error: {
      code,
      message: err.message,
      ...(process.env.NODE_ENV === "development" && statusCode === 500 && { stack: err.stack }),
    },
  });
}
