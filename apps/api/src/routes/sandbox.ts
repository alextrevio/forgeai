import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";
import http from "http";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { sandboxManager } from "../sandbox/manager";
import { previewManager } from "../services/preview-server";

// Max file content size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Max command length
const MAX_COMMAND_LENGTH = 2000;

/**
 * Validate a sandbox command for safety.
 * Returns an error message if blocked, or null if safe.
 */
function validateSandboxCommand(command: string): string | null {
  if (command.length > MAX_COMMAND_LENGTH) {
    return "Command too long";
  }

  const normalized = command.toLowerCase().replace(/\s+/g, " ").trim();

  // Block dangerous binaries
  const blockedBinaries = [
    "rm -rf /", "rm -rf /*", "rm -rf ~", "rm -rf .",
    "mkfs", "dd if=", "fdisk", "parted", "mount", "umount",
    ":(){ :|:& };:", // fork bomb
    "chmod 777 /", "chown root",
  ];
  if (blockedBinaries.some((b) => normalized.includes(b))) {
    return "Command blocked for safety";
  }

  // Block network attack tools and reverse shells
  const networkPatterns = [
    /\bnc\b.*-[elp]/, // netcat listeners
    /\bncat\b/, /\bsocat\b/,
    /\/dev\/(tcp|udp)\//, // bash reverse shells
    /\bmkfifo\b/, // named pipes for shells
    /\btcpdump\b/, /\bnmap\b/, /\bwireshark\b/,
    /\biptables\b/, /\bufw\b/,
  ];
  if (networkPatterns.some((p) => p.test(normalized))) {
    return "Network tools are not allowed in sandbox";
  }

  // Block crypto miners and suspicious downloads
  const minerPatterns = [
    /xmrig|cryptonight|minerd|cgminer|cpuminer/,
    /stratum\+tcp/,
  ];
  if (minerPatterns.some((p) => p.test(normalized))) {
    return "Command blocked for safety";
  }

  // Block system modification commands
  const systemPatterns = [
    /\buseradd\b/, /\buserdel\b/, /\bgroupadd\b/,
    /\bpasswd\b/, /\bvisudo\b/, /\bsudo\b/,
    /\bsystemctl\b/, /\bservice\b.*(?:start|stop|restart)/,
    /\bshutdown\b/, /\breboot\b/, /\binit\b\s+\d/,
    /\bcrontab\b/, /\/etc\/cron/,
    /\bkill\b.*-9\s+1\b/, // kill init
    /\bkillall\b/,
  ];
  if (systemPatterns.some((p) => p.test(normalized))) {
    return "System modification commands are not allowed";
  }

  // Block access to sensitive paths
  const sensitivePaths = [
    /\/etc\/(?:passwd|shadow|sudoers|ssh)/,
    /\/proc\//, /\/sys\//,
    /\/root\//,
    /\.ssh\//,
    /\.env(?:\.|$|\s)/,
    /\.git\/config/,
  ];
  if (sensitivePaths.some((p) => p.test(normalized))) {
    return "Access to system paths is not allowed";
  }

  // Block piping to shell interpreters (common exploit pattern)
  const shellPipePatterns = [
    /curl\b.*\|\s*(?:bash|sh|zsh|python|perl|ruby|node)/,
    /wget\b.*\|\s*(?:bash|sh|zsh|python|perl|ruby|node)/,
    /\beval\b.*\$\(/, // eval $(...)
    /\bexec\b.*\d+[<>]/,
  ];
  if (shellPipePatterns.some((p) => p.test(normalized))) {
    return "Piping downloads to shell interpreters is not allowed";
  }

  return null;
}

/** Reject paths containing traversal sequences or absolute references */
function isSafePath(filePath: string): boolean {
  if (!filePath) return false;
  // Reject absolute paths, null bytes, and parent directory traversal
  if (filePath.startsWith("/") || filePath.includes("\0")) return false;
  const segments = filePath.split(/[\\/]/);
  return !segments.some((s) => s === ".." || s === ".");
}

export const sandboxRouter: RouterType = Router();

// Get file tree
sandboxRouter.get("/:id/files", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const tree = await sandboxManager.getFileTree(project.sandboxId);
    return res.json(tree);
  } catch (err) {
    console.error("Get file tree error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Read file
sandboxRouter.get("/:id/files/*", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const filePath = (req.params[0] as string) || "";
    if (!isSafePath(filePath)) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    const content = await sandboxManager.readFile(project.sandboxId, filePath);
    return res.json({ path: filePath, content });
  } catch (err) {
    console.error("Read file error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Write file
sandboxRouter.put("/:id/files/*", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const filePath = (req.params[0] as string) || "";
    if (!isSafePath(filePath)) {
      return res.status(400).json({ error: "Invalid file path" });
    }
    const { content } = req.body;
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Content must be a string" });
    }
    if (content.length > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` });
    }

    await sandboxManager.writeFile(project.sandboxId, filePath, content);

    // Emit file change via WebSocket for real-time updates
    const io = req.app.get("io");
    if (io) {
      io.to(`project:${id}`).emit("event", {
        type: "sandbox:file_changed",
        data: { path: filePath, action: "edit" },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Write file error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete file
sandboxRouter.delete("/:id/files/*", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const filePath = (req.params[0] as string) || "";
    if (!isSafePath(filePath)) {
      return res.status(400).json({ error: "Invalid file path" });
    }

    await sandboxManager.deleteFile(project.sandboxId, filePath);

    // Emit file tree update via WebSocket
    const io = req.app.get("io");
    if (io) {
      io.to(`project:${id}`).emit("event", {
        type: "sandbox:file_tree_update",
        data: { projectId: id },
      });
      io.to(`project:${id}`).emit("event", {
        type: "sandbox:file_changed",
        data: { path: filePath, action: "delete" },
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Delete file error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Execute command in sandbox terminal
sandboxRouter.post("/:id/terminal", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const { command } = req.body;
    if (!command || typeof command !== "string") {
      return res.status(400).json({ error: "Command must be a non-empty string" });
    }

    // ── Command safety validation ──────────────────────────
    const sanitizeError = validateSandboxCommand(command);
    if (sanitizeError) {
      return res.status(400).json({ error: sanitizeError });
    }

    const result = await sandboxManager.executeCommand(project.sandboxId, command);

    // Emit terminal output via WebSocket
    const io = req.app.get("io");
    if (io) {
      io.to(`project:${id}`).emit("event", {
        type: "sandbox:terminal_output",
        data: { output: `$ ${command}\n${result.stdout || result.stderr || ""}` },
      });
    }

    return res.json({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (err) {
    console.error("Terminal exec error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get preview URL with status — returns the proxy URL and health info
sandboxRouter.get("/:id/preview", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const url = `/api/projects/${id}/preview-proxy/`;
    const previewInfo = previewManager.getPreviewInfo(id);

    return res.json({
      url,
      status: previewInfo?.status ?? "unknown",
      framework: previewInfo?.framework ?? "unknown",
      readyAt: previewInfo?.readyAt?.toISOString() ?? null,
      lastRefreshAt: previewInfo?.lastRefreshAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("Get preview error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Refresh preview — triggers a reload event for connected clients
sandboxRouter.post("/:id/preview/refresh", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    // Ensure sandbox is running
    await sandboxManager.ensureSandboxRunning(id);

    // Emit refresh to all connected clients
    previewManager.emitRefresh(id);

    return res.json({ success: true, refreshedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Preview refresh error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Preview Proxy (separate router — no auth, loaded by iframe) ──
export const previewProxyRouter: RouterType = Router();

previewProxyRouter.use("/:id/preview-proxy", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Sandbox not found" });
    }

    const info = sandboxManager.getSandboxInfo(project.sandboxId);
    if (!info || info.status !== "running") {
      return res.status(503).json({ error: "Sandbox is not running" });
    }

    // req.url is everything after the mount point, e.g. "/" , "/src/main.tsx"
    const upstreamPath = req.url || "/";

    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: info.previewPort,
      path: upstreamPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${info.previewPort}`,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (err) => {
      console.error(`[preview-proxy:${id}] upstream error:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: "Preview server not reachable" });
      }
    });

    req.pipe(proxyReq, { end: true });
  } catch (err) {
    console.error("Preview proxy error:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});
