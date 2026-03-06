import { prisma } from "@forgeai/db";
import { Server as SocketIOServer } from "socket.io";
import { getProjectSandbox } from "./sandbox";
import { logger } from "../lib/logger";

interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted";
  linesAdded: number;
  linesRemoved: number;
}

export class VersionService {
  /** Create a version/snapshot of the current project state */
  async createVersion(params: {
    projectId: string;
    label?: string;
    description?: string;
    trigger: "engine_complete" | "manual" | "auto_save";
    engineRunId?: string;
    io?: SocketIOServer;
  }): Promise<any> {
    // 1. Get all files from the sandbox
    let files: Record<string, string> = {};
    try {
      const sandbox = await getProjectSandbox(params.projectId, params.io);
      const snapshot = await sandbox.getSnapshot();
      files = snapshot.files;
    } catch (err) {
      logger.warn({ err, projectId: params.projectId }, "Version: failed to get sandbox snapshot");
      return null;
    }

    if (Object.keys(files).length === 0) return null;

    // 2. Get next version number
    const lastVersion = await prisma.projectVersion.findFirst({
      where: { projectId: params.projectId },
      orderBy: { version: "desc" },
      select: { version: true, files: true },
    });
    const nextVersion = (lastVersion?.version || 0) + 1;

    // 3. Auto-generate description if not provided
    let description = params.description;
    if (!description && lastVersion?.files) {
      description = this.generateDiffDescription(
        lastVersion.files as Record<string, string>,
        files
      );
    }

    // 4. Calculate size
    const totalSize = Object.values(files).reduce(
      (sum, content) => sum + (content?.length || 0),
      0
    );

    // 5. Create version record
    const version = await prisma.projectVersion.create({
      data: {
        projectId: params.projectId,
        version: nextVersion,
        label: params.label || `Versión ${nextVersion}`,
        description: description || null,
        files: files as any,
        fileCount: Object.keys(files).length,
        totalSize,
        trigger: params.trigger,
        engineRunId: params.engineRunId || null,
      },
    });

    logger.info(
      { projectId: params.projectId, version: nextVersion, fileCount: Object.keys(files).length },
      "Version: created"
    );

    return version;
  }

  /** List versions for a project (without file contents) */
  async listVersions(projectId: string) {
    return prisma.projectVersion.findMany({
      where: { projectId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        label: true,
        description: true,
        fileCount: true,
        totalSize: true,
        trigger: true,
        createdAt: true,
      },
    });
  }

  /** Get a specific version with file contents */
  async getVersion(projectId: string, versionId: string): Promise<any> {
    return prisma.projectVersion.findFirst({
      where: { id: versionId, projectId },
    });
  }

  /** Restore a version — saves current state first, then overwrites sandbox */
  async restoreVersion(
    projectId: string,
    versionId: string,
    io?: SocketIOServer
  ): Promise<any> {
    // 1. Save current state as auto_save before restoring
    await this.createVersion({
      projectId,
      label: "Auto-save antes de restaurar",
      trigger: "auto_save",
      io,
    });

    // 2. Get the version to restore
    const version = await prisma.projectVersion.findFirst({
      where: { id: versionId, projectId },
    });
    if (!version) throw new Error("Version not found");

    // 3. Restore files to sandbox
    const files = version.files as Record<string, string>;
    const sandbox = await getProjectSandbox(projectId, io);
    await sandbox.restoreSnapshot(files);

    // 4. Emit events
    if (io) {
      io.to(`project:${projectId}`).emit("event", {
        type: "version:restored",
        data: { version: version.version, label: version.label },
      });
      io.to(`project:${projectId}`).emit("event", {
        type: "preview:reload",
        data: {},
      });
    }

    logger.info(
      { projectId, restoredVersion: version.version },
      "Version: restored"
    );

    return version;
  }

  /** Compare two versions and return file diffs */
  async compareVersions(
    projectId: string,
    versionIdA: string,
    versionIdB: string
  ): Promise<FileDiff[]> {
    const [vA, vB] = await Promise.all([
      this.getVersion(projectId, versionIdA),
      this.getVersion(projectId, versionIdB),
    ]);
    if (!vA || !vB) throw new Error("Version not found");

    const filesA = (vA.files as Record<string, string>) || {};
    const filesB = (vB.files as Record<string, string>) || {};

    const allPaths = new Set([...Object.keys(filesA), ...Object.keys(filesB)]);
    const diffs: FileDiff[] = [];

    for (const path of allPaths) {
      const contentA = filesA[path];
      const contentB = filesB[path];

      if (!contentA && contentB) {
        diffs.push({
          path,
          status: "added",
          linesAdded: contentB.split("\n").length,
          linesRemoved: 0,
        });
      } else if (contentA && !contentB) {
        diffs.push({
          path,
          status: "deleted",
          linesAdded: 0,
          linesRemoved: contentA.split("\n").length,
        });
      } else if (contentA && contentB && contentA !== contentB) {
        const linesA = contentA.split("\n").length;
        const linesB = contentB.split("\n").length;
        diffs.push({
          path,
          status: "modified",
          linesAdded: Math.max(0, linesB - linesA),
          linesRemoved: Math.max(0, linesA - linesB),
        });
      }
    }

    return diffs.sort((a, b) => {
      const order = { added: 0, modified: 1, deleted: 2 };
      return order[a.status] - order[b.status];
    });
  }

  /** Generate a human-readable description of what changed */
  private generateDiffDescription(
    oldFiles: Record<string, string>,
    newFiles: Record<string, string>
  ): string {
    const allPaths = new Set([
      ...Object.keys(oldFiles),
      ...Object.keys(newFiles),
    ]);

    const added = [...allPaths].filter((p) => !oldFiles[p] && newFiles[p]);
    const removed = [...allPaths].filter((p) => oldFiles[p] && !newFiles[p]);
    const modified = [...allPaths].filter(
      (p) => oldFiles[p] && newFiles[p] && oldFiles[p] !== newFiles[p]
    );

    const parts: string[] = [];
    if (added.length > 0) parts.push(`${added.length} archivo(s) nuevo(s)`);
    if (modified.length > 0)
      parts.push(`${modified.length} archivo(s) modificado(s)`);
    if (removed.length > 0)
      parts.push(`${removed.length} archivo(s) eliminado(s)`);

    return parts.join(", ") || "Sin cambios";
  }
}

export const versionService = new VersionService();
