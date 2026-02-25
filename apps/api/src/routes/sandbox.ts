import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";
import http from "http";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { sandboxManager } from "../sandbox/manager";

// Max file content size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
    return res.json({ success: true });
  } catch (err) {
    console.error("Write file error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get preview URL — returns the proxy URL (reachable from browser)
sandboxRouter.get("/:id/preview", async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    // Return a browser-reachable proxy URL instead of localhost:port
    const url = `/api/projects/${id}/preview-proxy/`;
    return res.json({ url });
  } catch (err) {
    console.error("Get preview error:", err);
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
