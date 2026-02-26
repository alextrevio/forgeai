
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { prisma } from "@forgeai/db";
import { authRouter } from "./routes/auth";
import { projectRouter } from "./routes/projects";
import { messageRouter } from "./routes/messages";
import { sandboxRouter, previewProxyRouter } from "./routes/sandbox";
import { githubRouter } from "./routes/github";
import { billingRouter } from "./routes/billing";
import { templateRouter } from "./routes/templates";
import { supabaseRouter } from "./routes/supabase";
import { sharingRouter } from "./routes/sharing";
import { notificationRouter } from "./routes/notifications";
import { exportImportRouter } from "./routes/export-import";
import { engineRouter } from "./routes/engine";
import { authenticate } from "./middleware/auth";
import { errorHandler } from "./middleware/error-handler";
import { rateLimit } from "./middleware/rate-limit";
import { setupSocketHandlers } from "./socket";
import { logger } from "./lib/logger";

// ── Validate required env vars at startup ───────────────
const REQUIRED_ENV = ["JWT_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const startTime = Date.now();
const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.APP_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make io accessible to routes
app.set("io", io);

// ── Security middleware ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Handled by nginx in production
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

app.use(express.json({ limit: "10mb" }));

// ── Request logging ──────────────────────────────────────
app.use((req, _res, next) => {
  if (req.path !== "/api/health" && req.path !== "/api/metrics") {
    logger.info({ method: req.method, path: req.path }, "incoming request");
  }
  next();
});

// Serve deployed projects as static files
const deploysDir = join(process.cwd(), "deploys");
if (!existsSync(deploysDir)) {
  mkdirSync(deploysDir, { recursive: true });
}
app.use("/preview", express.static(deploysDir));

// Preview proxy — no auth required (loaded by iframe)
app.use("/api/projects", previewProxyRouter);

// General rate limit for all API routes
const generalLimiter = rateLimit({ windowMs: 60_000, max: 100, keyPrefix: "general" });

// Stricter rate limit for auth routes (login/register brute-force protection)
const authLimiter = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "auth" });

// Stricter rate limit for agent/message routes
const agentLimiter = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "agent" });

// ── Health check (enhanced) ──────────────────────────────
app.get("/api/health", async (_req, res) => {
  let dbStatus = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  const status = dbStatus === "ok" ? "healthy" : "degraded";

  res.status(status === "healthy" ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services: {
      database: dbStatus,
    },
  });
});

// ── Metrics endpoint ─────────────────────────────────────
app.get("/api/metrics", authenticate, async (_req, res) => {
  try {
    const [userCount, projectCount, messageCount] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.message.count(),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      counts: {
        users: userCount,
        projects: projectCount,
        messages: messageCount,
      },
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    });
  } catch (err) {
    logger.error(err, "Metrics error");
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to gather metrics" } });
  }
});

// Public routes (stricter auth rate limit: 10 req/min per IP)
app.use("/api/auth", authLimiter, authRouter);

// Protected routes
app.use("/api/projects", authenticate, generalLimiter, projectRouter);
app.use("/api/projects", authenticate, agentLimiter, messageRouter);
app.use("/api/projects", authenticate, generalLimiter, sandboxRouter);
app.use("/api/github", authenticate, generalLimiter, githubRouter);
app.use("/api/billing", authenticate, generalLimiter, billingRouter);
app.use("/api/templates", authenticate, generalLimiter, templateRouter);
app.use("/api/supabase", authenticate, generalLimiter, supabaseRouter);
app.use("/api/projects", authenticate, generalLimiter, sharingRouter);
app.use("/api/projects", authenticate, generalLimiter, exportImportRouter);
app.use("/api/notifications", authenticate, generalLimiter, notificationRouter);
app.use("/api/engine", authenticate, agentLimiter, engineRouter);

// 404 handler for API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `Route not found: ${req.method} ${req.path}` } });
});

// Global error handler (must be last middleware)
app.use(errorHandler);

// Socket.IO
setupSocketHandlers(io);

const PORT = parseInt(process.env.PORT || "8000", 10);
httpServer.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "ForgeAI API running");
});

// ── Graceful shutdown ────────────────────────────────────
function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing...");
  httpServer.close(() => {
    logger.info("HTTP server closed");
    prisma.$disconnect().then(() => {
      logger.info("Database disconnected");
      process.exit(0);
    });
  });
  // Force exit after 10 seconds
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export { io };
