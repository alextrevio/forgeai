import { Router, Request, Response } from "express";
import { skillService } from "../services/skill-service";
import { logger } from "../lib/logger";

// ══════════════════════════════════════════════════════════════════
// SKILLS ROUTES
// ══════════════════════════════════════════════════════════════════

export const skillsRouter = Router();

// ── GET /api/skills — List skills with filters ────────────────────

skillsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { category, agentType, tag, builtin, search } = req.query;

    const skills = await skillService.listSkills({
      category: category as string | undefined,
      agentType: agentType as string | undefined,
      tag: tag as string | undefined,
      isBuiltin: builtin === "true" ? true : builtin === "false" ? false : undefined,
      search: search as string | undefined,
    });

    res.json({ skills });
  } catch (err) {
    logger.error(err, "Skills: list failed");
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to list skills" } });
  }
});

// ── GET /api/skills/:slug — Get skill detail ──────────────────────

skillsRouter.get("/:slug", async (req: Request, res: Response) => {
  try {
    const skill = await skillService.getSkillBySlug(req.params.slug as string);

    if (!skill) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Skill not found" } });
    }

    res.json({ skill });
  } catch (err) {
    logger.error(err, "Skills: get failed");
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to get skill" } });
  }
});

// ── POST /api/skills — Create custom skill ────────────────────────

skillsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { userId: string }).userId;
    const { name, slug, description, content, agentType, category, tags, toolsRequired } = req.body;

    if (!name || !slug || !description || !content || !agentType || !category) {
      return res.status(400).json({
        error: { code: "VALIDATION", message: "Missing required fields: name, slug, description, content, agentType, category" },
      });
    }

    // Check slug uniqueness
    const existing = await skillService.getSkillBySlug(slug);
    if (existing) {
      return res.status(409).json({
        error: { code: "CONFLICT", message: "A skill with this slug already exists" },
      });
    }

    const skill = await skillService.createSkill({
      name,
      slug,
      description,
      content,
      agentType,
      category,
      tags: tags || [],
      toolsRequired: toolsRequired || [],
      authorId: userId,
    });

    res.status(201).json({ skill });
  } catch (err) {
    logger.error(err, "Skills: create failed");
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to create skill" } });
  }
});
