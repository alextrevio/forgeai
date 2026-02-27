import { Server as SocketIOServer } from "socket.io";
import { prisma } from "@forgeai/db";
import { sandboxManager } from "../sandbox/manager";
import { logger } from "../lib/logger";
import type { FileNode, CommandResult } from "@forgeai/sandbox-manager";

// ══════════════════════════════════════════════════════════════════
// PROJECT SANDBOX — High-level wrapper over SandboxManager
// Provides project-scoped file ops, command execution, preview,
// and WebSocket event emission for real-time frontend updates.
// ══════════════════════════════════════════════════════════════════

export interface SnapshotData {
  files: Record<string, string>;
  timestamp: string;
}

export class ProjectSandbox {
  private projectId: string;
  private sandboxId: string | null = null;
  private io: SocketIOServer | null = null;

  constructor(projectId: string, io?: SocketIOServer) {
    this.projectId = projectId;
    this.io = io || null;
  }

  // ── Initialization ──────────────────────────────────────────────

  /**
   * Initialize the sandbox for this project. Creates one if it doesn't exist,
   * otherwise ensures the existing one is running.
   */
  async init(framework = "react-vite"): Promise<string> {
    const project = await prisma.project.findUnique({
      where: { id: this.projectId },
      select: { sandboxId: true, framework: true },
    });

    if (project?.sandboxId) {
      this.sandboxId = project.sandboxId;
      sandboxManager.resetTTL(this.projectId);
      await sandboxManager.ensureSandboxRunning(this.projectId);
      return this.sandboxId;
    }

    // Create new sandbox
    const fw = project?.framework || framework;
    const sandbox = await sandboxManager.createSandbox(this.projectId, fw);
    this.sandboxId = sandbox.containerId;

    await prisma.project.update({
      where: { id: this.projectId },
      data: { sandboxId: this.sandboxId },
    });

    this.emitEvent("sandbox:status", { status: "running" });
    return this.sandboxId;
  }

  /**
   * Attach to an existing sandbox without creating one.
   */
  attach(sandboxId: string): void {
    this.sandboxId = sandboxId;
  }

  // ── File Operations ─────────────────────────────────────────────

  async createFile(path: string, content: string): Promise<void> {
    this.ensureReady();
    await sandboxManager.writeFile(this.sandboxId!, path, content);
    this.emitFileTreeUpdate();
    this.emitEvent("sandbox:file_changed", { path, action: "create" });
  }

  async readFile(path: string): Promise<string> {
    this.ensureReady();
    return sandboxManager.readFile(this.sandboxId!, path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.ensureReady();
    await sandboxManager.writeFile(this.sandboxId!, path, content);
    this.emitEvent("sandbox:file_changed", { path, action: "edit" });
  }

  /**
   * Search-and-replace within a file. Returns true if replacement was made.
   */
  async modifyFile(path: string, search: string, replace: string): Promise<boolean> {
    this.ensureReady();
    try {
      const existing = await sandboxManager.readFile(this.sandboxId!, path);
      if (!existing.includes(search)) return false;
      const modified = existing.replace(search, replace);
      await sandboxManager.writeFile(this.sandboxId!, path, modified);
      this.emitEvent("sandbox:file_changed", { path, action: "edit" });
      return true;
    } catch (err) {
      logger.warn({ err, path }, "ProjectSandbox: modifyFile failed");
      return false;
    }
  }

  async deleteFile(path: string): Promise<void> {
    this.ensureReady();
    await sandboxManager.deleteFile(this.sandboxId!, path);
    this.emitFileTreeUpdate();
    this.emitEvent("sandbox:file_changed", { path, action: "delete" });
  }

  async fileExists(path: string): Promise<boolean> {
    this.ensureReady();
    try {
      await sandboxManager.readFile(this.sandboxId!, path);
      return true;
    } catch {
      return false;
    }
  }

  async getFileTree(): Promise<FileNode[]> {
    this.ensureReady();
    return sandboxManager.getFileTree(this.sandboxId!);
  }

  // ── Command Execution ───────────────────────────────────────────

  async exec(command: string, cwd?: string): Promise<CommandResult> {
    this.ensureReady();
    const result = await sandboxManager.executeCommand(this.sandboxId!, command, cwd);
    return result;
  }

  // ── Preview ─────────────────────────────────────────────────────

  async startPreview(): Promise<string> {
    this.ensureReady();
    await sandboxManager.ensureSandboxRunning(this.projectId);
    return this.getPreviewUrl();
  }

  async getPreviewUrl(): Promise<string> {
    this.ensureReady();
    return sandboxManager.getPreviewUrl(this.sandboxId!);
  }

  // ── Snapshot ────────────────────────────────────────────────────

  /**
   * Capture a snapshot of all project files (excluding node_modules, .git, dist).
   * Returns a Record<path, content> map.
   */
  async getSnapshot(): Promise<SnapshotData> {
    this.ensureReady();
    const tree = await sandboxManager.getFileTree(this.sandboxId!);
    const files: Record<string, string> = {};

    const collectFiles = async (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === "file") {
          try {
            files[node.path] = await sandboxManager.readFile(this.sandboxId!, node.path);
          } catch {
            // Skip unreadable files (binary, etc.)
          }
        } else if (node.children) {
          await collectFiles(node.children);
        }
      }
    };

    await collectFiles(tree);
    return { files, timestamp: new Date().toISOString() };
  }

  /**
   * Restore files from a snapshot.
   */
  async restoreSnapshot(files: Record<string, string>): Promise<void> {
    this.ensureReady();
    await sandboxManager.restoreFiles(this.sandboxId!, files);
    this.emitFileTreeUpdate();
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  async destroy(): Promise<void> {
    if (this.sandboxId) {
      await sandboxManager.destroySandbox(this.projectId);
      this.emitEvent("sandbox:status", { status: "destroyed" });
      this.sandboxId = null;
    }
  }

  resetTTL(): void {
    if (this.sandboxId) {
      sandboxManager.resetTTL(this.projectId);
    }
  }

  getSandboxId(): string | null {
    return this.sandboxId;
  }

  isReady(): boolean {
    return this.sandboxId !== null;
  }

  // ── Dev server output callback ──────────────────────────────────

  onDevServerOutput(callback: (output: string) => void): void {
    if (this.sandboxId) {
      sandboxManager.onDevServerOutput(this.projectId, callback);
    }
  }

  // ── Internals ───────────────────────────────────────────────────

  private ensureReady(): void {
    if (!this.sandboxId) {
      throw new Error(`ProjectSandbox for project ${this.projectId} is not initialized`);
    }
  }

  private emitEvent(type: string, data: Record<string, unknown>): void {
    if (this.io) {
      this.io.to(`project:${this.projectId}`).emit("event", { type, data });
    }
  }

  private emitFileTreeUpdate(): void {
    this.emitEvent("sandbox:file_tree_update", { projectId: this.projectId });
  }
}

/**
 * Factory: Create a ProjectSandbox and optionally auto-attach if the project
 * already has a sandboxId in the database.
 */
export async function getProjectSandbox(
  projectId: string,
  io?: SocketIOServer
): Promise<ProjectSandbox> {
  const sandbox = new ProjectSandbox(projectId, io);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { sandboxId: true },
  });

  if (project?.sandboxId) {
    sandbox.attach(project.sandboxId);
  }

  return sandbox;
}
