import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import multer from "multer";
import { join, extname } from "path";
import { existsSync, mkdirSync, readFileSync, statSync } from "fs";
import { parse as csvParse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { prisma, Prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { sandboxManager } from "../sandbox/manager";
import { logger } from "../lib/logger";
import { Server as SocketIOServer } from "socket.io";

export const uploadRouter: RouterType = Router();

// ── Multer config — store files temporarily in /tmp ──────
const storage = multer.memoryStorage();

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".csv", ".xlsx", ".xls", ".docx", ".doc", ".txt", ".json",
  ".js", ".ts", ".tsx", ".jsx", ".py", ".html", ".css", ".scss",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
  ".zip", ".md", ".yaml", ".yml", ".xml", ".sql", ".sh", ".env",
  ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_FILES = 10;

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} is not supported`));
    }
  },
});

// ── Helper: get file type category ───────────────────────
function getFileCategory(filename: string): string {
  const ext = extname(filename).toLowerCase();
  if ([".pdf"].includes(ext)) return "document";
  if ([".csv", ".xlsx", ".xls"].includes(ext)) return "spreadsheet";
  if ([".docx", ".doc", ".txt", ".md"].includes(ext)) return "text";
  if ([".json", ".yaml", ".yml", ".xml"].includes(ext)) return "data";
  if ([".js", ".ts", ".tsx", ".jsx", ".py", ".html", ".css", ".scss", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".sql", ".sh"].includes(ext)) return "code";
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext)) return "image";
  if ([".zip"].includes(ext)) return "archive";
  return "other";
}

// ── Helper: get file icon ────────────────────────────────
function getFileIcon(filename: string): string {
  const category = getFileCategory(filename);
  const icons: Record<string, string> = {
    document: "pdf",
    spreadsheet: "spreadsheet",
    text: "text",
    data: "data",
    code: "code",
    image: "image",
    archive: "archive",
    other: "file",
  };
  return icons[category] || "file";
}

// ═══════════════════════════════════════════════════════════
// POST /:id/upload — Upload files to project sandbox
// ═══════════════════════════════════════════════════════════

uploadRouter.post(
  "/:id/upload",
  upload.array("files", MAX_FILES),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId: req.userId },
      });
      if (!project || !project.sandboxId) {
        return res.status(404).json({ error: "Project or sandbox not found" });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      const uploadedFiles: Array<{
        name: string;
        path: string;
        size: number;
        type: string;
        category: string;
        icon: string;
      }> = [];

      // Ensure uploads/ directory exists in sandbox
      const sandboxInfo = sandboxManager.getSandboxInfo(project.sandboxId);
      if (sandboxInfo) {
        const uploadsDir = join(sandboxInfo.workspaceDir, "uploads");
        if (!existsSync(uploadsDir)) {
          mkdirSync(uploadsDir, { recursive: true });
        }
      }

      for (const file of files) {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `uploads/${safeName}`;

        // Write file to sandbox
        await sandboxManager.writeFile(
          project.sandboxId,
          filePath,
          file.buffer.toString("binary")
        );

        // For binary files (images, zip, xlsx, etc.), write as Buffer
        const ext = extname(safeName).toLowerCase();
        const isBinary = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".zip", ".xlsx", ".xls", ".pdf", ".docx", ".doc"].includes(ext);
        if (isBinary && sandboxInfo) {
          const fullPath = join(sandboxInfo.workspaceDir, filePath);
          const { writeFileSync: wfs } = require("fs");
          wfs(fullPath, file.buffer);
        }

        uploadedFiles.push({
          name: file.originalname,
          path: filePath,
          size: file.size,
          type: file.mimetype,
          category: getFileCategory(safeName),
          icon: getFileIcon(safeName),
        });
      }

      // Create activity log
      await prisma.activityLog.create({
        data: {
          projectId,
          type: "files_uploaded",
          content: {
            files: uploadedFiles.map((f) => ({ name: f.name, size: f.size, category: f.category })),
            count: uploadedFiles.length,
          } as Prisma.InputJsonValue,
        },
      });

      // Emit WebSocket events for real-time updates
      const io: SocketIOServer = req.app.get("io");
      if (io) {
        io.to(`project:${projectId}`).emit("event", {
          type: "sandbox:file_tree_update",
          data: { projectId },
        });
        io.to(`project:${projectId}`).emit("event", {
          type: "files:uploaded",
          data: { files: uploadedFiles },
        });
      }

      return res.json({
        success: true,
        files: uploadedFiles,
      });
    } catch (err: any) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File too large (max 50MB per file)" });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ error: "Too many files (max 10 at once)" });
      }
      logger.error(err, "File upload error");
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  }
);

// ═══════════════════════════════════════════════════════════
// GET /:id/files/content — Read file content with parsing
// ═══════════════════════════════════════════════════════════

uploadRouter.get("/:id/files/content", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ error: "Missing path query parameter" });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const sandboxInfo = sandboxManager.getSandboxInfo(project.sandboxId);
    if (!sandboxInfo) {
      return res.status(404).json({ error: "Sandbox not found" });
    }

    const fullPath = join(sandboxInfo.workspaceDir, filePath);
    if (!existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const ext = extname(filePath).toLowerCase();
    const stat = statSync(fullPath);

    // Images — return base64
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) {
      const buffer = readFileSync(fullPath);
      const base64 = buffer.toString("base64");
      const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
      };
      return res.json({
        type: "image",
        path: filePath,
        size: stat.size,
        mimeType: mimeTypes[ext] || "application/octet-stream",
        content: `data:${mimeTypes[ext] || "application/octet-stream"};base64,${base64}`,
      });
    }

    // CSV — parse and return JSON
    if (ext === ".csv") {
      try {
        const raw = readFileSync(fullPath, "utf-8");
        const records = csvParse(raw, {
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
        }) as Record<string, unknown>[];
        const headers = records.length > 0 ? Object.keys(records[0] as object) : [];
        const totalRows = records.length;
        const previewRows = records.slice(0, 100);
        return res.json({
          type: "spreadsheet",
          path: filePath,
          size: stat.size,
          headers,
          rows: previewRows,
          totalRows,
          truncated: totalRows > 100,
        });
      } catch (parseErr) {
        // Fallback to raw text
        const raw = readFileSync(fullPath, "utf-8");
        return res.json({ type: "text", path: filePath, size: stat.size, content: raw.slice(0, 500000) });
      }
    }

    // XLSX/XLS — parse and return JSON
    if ([".xlsx", ".xls"].includes(ext)) {
      try {
        const workbook = XLSX.readFile(fullPath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const records: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);
        const headers = records.length > 0 ? Object.keys(records[0]) : [];
        const totalRows = records.length;
        const previewRows = records.slice(0, 100);
        return res.json({
          type: "spreadsheet",
          path: filePath,
          size: stat.size,
          headers,
          rows: previewRows,
          totalRows,
          truncated: totalRows > 100,
          sheets: workbook.SheetNames,
        });
      } catch (parseErr) {
        return res.json({ type: "binary", path: filePath, size: stat.size, error: "Could not parse spreadsheet" });
      }
    }

    // Text files — return raw content
    const textExts = [".txt", ".md", ".json", ".js", ".ts", ".tsx", ".jsx", ".py", ".html", ".css", ".scss",
      ".yaml", ".yml", ".xml", ".sql", ".sh", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".env"];
    if (textExts.includes(ext)) {
      const content = readFileSync(fullPath, "utf-8");
      return res.json({
        type: "text",
        path: filePath,
        size: stat.size,
        content: content.slice(0, 500000), // Limit to 500KB of text
      });
    }

    // PDF/DOCX — return metadata only (agents can read these separately)
    return res.json({
      type: "binary",
      path: filePath,
      size: stat.size,
      extension: ext,
    });
  } catch (err) {
    logger.error(err, "Read file content error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /:id/uploads — List uploaded files
// ═══════════════════════════════════════════════════════════

uploadRouter.get("/:id/uploads", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const sandboxInfo = sandboxManager.getSandboxInfo(project.sandboxId);
    if (!sandboxInfo) {
      return res.json({ files: [] });
    }

    const uploadsDir = join(sandboxInfo.workspaceDir, "uploads");
    if (!existsSync(uploadsDir)) {
      return res.json({ files: [] });
    }

    const { readdirSync } = require("fs");
    const fileNames: string[] = readdirSync(uploadsDir);
    const files = fileNames.map((name: string) => {
      const fullPath = join(uploadsDir, name);
      const stat = statSync(fullPath);
      return {
        name,
        path: `uploads/${name}`,
        size: stat.size,
        category: getFileCategory(name),
        icon: getFileIcon(name),
        uploadedAt: stat.mtime.toISOString(),
      };
    });

    return res.json({ files });
  } catch (err) {
    logger.error(err, "List uploads error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
