import { Server as SocketIOServer } from "socket.io";
import { sandboxManager } from "../sandbox/manager";
import { logger } from "../lib/logger";

// ══════════════════════════════════════════════════════════════════
// PREVIEW MANAGER — Higher-level preview lifecycle management
//
// Wraps SandboxManager's Vite dev server with:
//  • Framework detection (vite/next/static)
//  • Health monitoring with readiness detection
//  • preview:ready / preview:refresh WebSocket events
//  • Debounced auto-refresh on file changes
//  • Status tracking per project
// ══════════════════════════════════════════════════════════════════

export type PreviewStatus = "starting" | "ready" | "error" | "stopped";

export interface PreviewInfo {
  projectId: string;
  status: PreviewStatus;
  framework: "vite" | "next" | "static" | "unknown";
  previewUrl: string | null;
  port: number | null;
  startedAt: Date | null;
  readyAt: Date | null;
  lastRefreshAt: Date | null;
  errorMessage: string | null;
}

const HEALTH_CHECK_INTERVAL = 5000; // 5s between health checks while starting
const HEALTH_CHECK_MAX_ATTEMPTS = 12; // 60s max wait for server readiness
const REFRESH_DEBOUNCE_MS = 800; // Debounce rapid file changes

class PreviewManager {
  private previews: Map<string, PreviewInfo> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private refreshDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private io: SocketIOServer | null = null;

  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  /**
   * Detect the framework used in a sandbox by checking project files.
   */
  async detectFramework(sandboxId: string): Promise<PreviewInfo["framework"]> {
    try {
      const pkgContent = await sandboxManager.readFile(sandboxId, "package.json");
      const pkg = JSON.parse(pkgContent);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (allDeps["next"]) return "next";
      if (allDeps["vite"] || allDeps["@vitejs/plugin-react"]) return "vite";
      return "static";
    } catch {
      return "unknown";
    }
  }

  /**
   * Initialize preview tracking for a project. Called when sandbox is created
   * or when the engine starts working on a project.
   */
  async initPreview(projectId: string, sandboxId: string): Promise<PreviewInfo> {
    const framework = await this.detectFramework(sandboxId);
    const sandboxInfo = sandboxManager.getSandboxInfo(sandboxId);
    const port = sandboxInfo?.previewPort ?? null;

    const info: PreviewInfo = {
      projectId,
      status: "starting",
      framework,
      previewUrl: port ? `/api/projects/${projectId}/preview-proxy/` : null,
      port,
      startedAt: new Date(),
      readyAt: null,
      lastRefreshAt: null,
      errorMessage: null,
    };

    this.previews.set(projectId, info);

    // Start health checking to detect when the server is ready
    this.startHealthCheck(projectId, sandboxId);

    return info;
  }

  /**
   * Get the current preview status for a project.
   */
  getPreviewInfo(projectId: string): PreviewInfo | null {
    return this.previews.get(projectId) ?? null;
  }

  /**
   * Check if the preview server is healthy and responding.
   */
  async checkHealth(projectId: string): Promise<boolean> {
    const info = this.previews.get(projectId);
    if (!info || !info.port) return false;

    try {
      const isRunning = await sandboxManager.ensureSandboxRunning(projectId);
      return isRunning;
    } catch {
      return false;
    }
  }

  /**
   * Trigger a preview refresh. Debounced to avoid excessive reloads
   * when multiple files change in quick succession.
   */
  scheduleRefresh(projectId: string): void {
    const existing = this.refreshDebounceTimers.get(projectId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.refreshDebounceTimers.delete(projectId);
      this.emitRefresh(projectId);
    }, REFRESH_DEBOUNCE_MS);

    this.refreshDebounceTimers.set(projectId, timer);
  }

  /**
   * Immediately emit a preview refresh event.
   */
  emitRefresh(projectId: string): void {
    const info = this.previews.get(projectId);
    if (!info) return;

    info.lastRefreshAt = new Date();
    this.previews.set(projectId, info);

    this.emit(projectId, "preview:refresh", {
      projectId,
      url: info.previewUrl,
      timestamp: info.lastRefreshAt.toISOString(),
    });
  }

  /**
   * Mark the preview as ready and emit preview:ready event.
   */
  markReady(projectId: string): void {
    const info = this.previews.get(projectId);
    if (!info) return;
    if (info.status === "ready") return; // Already ready, don't re-emit

    info.status = "ready";
    info.readyAt = new Date();
    info.errorMessage = null;
    this.previews.set(projectId, info);

    logger.info({ projectId, framework: info.framework, port: info.port }, "Preview server ready");

    this.emit(projectId, "preview:ready", {
      projectId,
      url: info.previewUrl,
      framework: info.framework,
      port: info.port,
    });
  }

  /**
   * Mark the preview as errored.
   */
  markError(projectId: string, message: string): void {
    const info = this.previews.get(projectId);
    if (!info) return;

    info.status = "error";
    info.errorMessage = message;
    this.previews.set(projectId, info);

    logger.warn({ projectId, error: message }, "Preview server error");
  }

  /**
   * Clean up preview tracking for a project.
   */
  cleanup(projectId: string): void {
    this.stopHealthCheck(projectId);

    const debounceTimer = this.refreshDebounceTimers.get(projectId);
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      this.refreshDebounceTimers.delete(projectId);
    }

    const info = this.previews.get(projectId);
    if (info) {
      info.status = "stopped";
      this.previews.set(projectId, info);
    }
  }

  /**
   * Remove preview tracking entirely.
   */
  remove(projectId: string): void {
    this.cleanup(projectId);
    this.previews.delete(projectId);
  }

  /**
   * Get all active preview sessions (for admin).
   */
  getAllPreviews(): PreviewInfo[] {
    return Array.from(this.previews.values());
  }

  // ── Health Check Loop ────────────────────────────────────────────

  private startHealthCheck(projectId: string, sandboxId: string): void {
    this.stopHealthCheck(projectId);

    let attempts = 0;

    const check = async () => {
      attempts++;
      const info = this.previews.get(projectId);
      if (!info || info.status === "ready" || info.status === "stopped") {
        this.stopHealthCheck(projectId);
        return;
      }

      try {
        const sandboxInfo = sandboxManager.getSandboxInfo(sandboxId);
        if (!sandboxInfo || sandboxInfo.status !== "running") {
          if (attempts >= HEALTH_CHECK_MAX_ATTEMPTS) {
            this.markError(projectId, "Sandbox not running after timeout");
            this.stopHealthCheck(projectId);
          }
          return;
        }

        const isHealthy = await sandboxManager.ensureSandboxRunning(projectId);
        if (isHealthy) {
          this.markReady(projectId);
          this.stopHealthCheck(projectId);
          return;
        }
      } catch (err) {
        logger.debug({ projectId, attempt: attempts, err }, "Preview health check failed");
      }

      if (attempts >= HEALTH_CHECK_MAX_ATTEMPTS) {
        this.markError(projectId, "Preview server did not become ready within timeout");
        this.stopHealthCheck(projectId);
      }
    };

    // Initial check after a short delay
    const timer = setInterval(check, HEALTH_CHECK_INTERVAL);
    this.healthCheckTimers.set(projectId, timer);

    // Also do an immediate check after 2s
    setTimeout(check, 2000);
  }

  private stopHealthCheck(projectId: string): void {
    const timer = this.healthCheckTimers.get(projectId);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(projectId);
    }
  }

  // ── WebSocket ────────────────────────────────────────────────────

  private emit(projectId: string, type: string, data: Record<string, unknown>): void {
    if (this.io) {
      this.io.to(`project:${projectId}`).emit("event", { type, data });
    }
  }
}

// Singleton instance
export const previewManager = new PreviewManager();
