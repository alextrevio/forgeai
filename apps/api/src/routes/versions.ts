import { Router, Response } from "express";
import { prisma } from "@forgeai/db";
import { versionService } from "../services/version-service";
import type { AuthRequest } from "../middleware/auth";

export const versionRouter = Router();

/** Verify user owns the project */
async function verifyOwnership(
  req: AuthRequest,
  res: Response,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: req.userId! },
    select: { id: true },
  });
  if (!project) {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    return false;
  }
  return true;
}

// GET /api/projects/:id/versions — list all versions
versionRouter.get("/:id/versions", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    if (!(await verifyOwnership(req, res, projectId))) return;

    const versions = await versionService.listVersions(projectId);
    res.json({ versions });
  } catch (err: any) {
    res
      .status(500)
      .json({ error: { code: "INTERNAL", message: err.message } });
  }
});

// GET /api/projects/:id/versions/:versionId — get version detail
versionRouter.get(
  "/:id/versions/:versionId",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const versionId = req.params.versionId as string;
      if (!(await verifyOwnership(req, res, projectId))) return;

      const version = await versionService.getVersion(projectId, versionId);
      if (!version) {
        return res
          .status(404)
          .json({
            error: { code: "NOT_FOUND", message: "Version not found" },
          });
      }
      res.json({ version });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL", message: err.message } });
    }
  }
);

// POST /api/projects/:id/versions — create manual version
versionRouter.post(
  "/:id/versions",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = req.params.id as string;
      if (!(await verifyOwnership(req, res, projectId))) return;

      const io = req.app.get("io");
      const version = await versionService.createVersion({
        projectId,
        label: req.body.label || undefined,
        trigger: "manual",
        io,
      });

      if (!version) {
        return res.status(400).json({
          error: {
            code: "NO_SANDBOX",
            message: "No sandbox found for this project",
          },
        });
      }

      res.json({ version });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL", message: err.message } });
    }
  }
);

// POST /api/projects/:id/versions/:versionId/restore — restore version
versionRouter.post(
  "/:id/versions/:versionId/restore",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const versionId = req.params.versionId as string;
      if (!(await verifyOwnership(req, res, projectId))) return;

      const io = req.app.get("io");
      const version = await versionService.restoreVersion(
        projectId,
        versionId,
        io
      );
      res.json({ restored: true, version: version.version });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL", message: err.message } });
    }
  }
);

// GET /api/projects/:id/versions/compare?a=ID&b=ID — compare two versions
versionRouter.get(
  "/:id/versions-compare",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = req.params.id as string;
      const a = req.query.a as string;
      const b = req.query.b as string;
      if (!a || !b) {
        return res.status(400).json({
          error: {
            code: "VALIDATION",
            message: 'Query params "a" and "b" are required',
          },
        });
      }
      if (!(await verifyOwnership(req, res, projectId))) return;

      const diffs = await versionService.compareVersions(projectId, a, b);
      res.json({ diffs });
    } catch (err: any) {
      res
        .status(500)
        .json({ error: { code: "INTERNAL", message: err.message } });
    }
  }
);
