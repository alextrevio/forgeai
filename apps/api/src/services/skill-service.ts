import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { prisma } from "@forgeai/db";
import { logger } from "../lib/logger";

// ══════════════════════════════════════════════════════════════════
// SKILL SERVICE — Loads, queries, and seeds skills
// ══════════════════════════════════════════════════════════════════

export interface SkillFrontmatter {
  name: string;
  slug: string;
  agentType: string;
  category: string;
  tags: string[];
  tools: string[];
  description: string;
}

export interface SkillData extends SkillFrontmatter {
  content: string;
}

// ── Frontmatter Parser ────────────────────────────────────────────

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content: raw };

  const fm: Record<string, unknown> = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: unknown = line.slice(colonIdx + 1).trim();

    // Parse arrays: [item1, item2]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }

    fm[key] = value;
  }

  return { frontmatter: fm, content: match[2].trim() };
}

// ── Load builtin skills from filesystem ───────────────────────────

function loadBuiltinSkills(): SkillData[] {
  const skillsDir = join(__dirname, "..", "skills");
  const skills: SkillData[] = [];

  let files: string[];
  try {
    files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  } catch {
    logger.warn({ dir: skillsDir }, "SkillService: skills directory not found");
    return [];
  }

  for (const file of files) {
    try {
      const raw = readFileSync(join(skillsDir, file), "utf-8");
      const { frontmatter, content } = parseFrontmatter(raw);

      const slug = (frontmatter.slug as string) || file.replace(".md", "");
      const tags = Array.isArray(frontmatter.tags) ? (frontmatter.tags as string[]) : [];
      const tools = Array.isArray(frontmatter.tools) ? (frontmatter.tools as string[]) : [];

      skills.push({
        name: (frontmatter.name as string) || slug,
        slug,
        agentType: (frontmatter.agentType as string) || "coder",
        category: (frontmatter.category as string) || "web",
        tags,
        tools,
        description: (frontmatter.description as string) || "",
        content,
      });
    } catch (err) {
      logger.warn({ file, error: err }, "SkillService: failed to load skill file");
    }
  }

  return skills;
}

// ══════════════════════════════════════════════════════════════════
// SKILL SERVICE CLASS
// ══════════════════════════════════════════════════════════════════

export class SkillService {
  private builtinSkills: SkillData[] = [];

  constructor() {
    this.builtinSkills = loadBuiltinSkills();
    logger.info({ count: this.builtinSkills.length }, "SkillService: loaded builtin skills");
  }

  /**
   * Seed builtin skills into the database (upsert).
   * Call this once at startup.
   */
  async seedBuiltins(): Promise<void> {
    for (const skill of this.builtinSkills) {
      try {
        await prisma.skill.upsert({
          where: { slug: skill.slug },
          create: {
            name: skill.name,
            slug: skill.slug,
            description: skill.description,
            content: skill.content,
            agentType: skill.agentType,
            category: skill.category,
            tags: skill.tags,
            toolsRequired: skill.tools,
            isBuiltin: true,
            isPublic: true,
          },
          update: {
            name: skill.name,
            description: skill.description,
            content: skill.content,
            agentType: skill.agentType,
            category: skill.category,
            tags: skill.tags,
            toolsRequired: skill.tools,
          },
        });
      } catch (err) {
        logger.warn({ slug: skill.slug, error: err }, "SkillService: failed to upsert skill");
      }
    }

    logger.info({ count: this.builtinSkills.length }, "SkillService: seeded builtin skills");
  }

  /**
   * List skills with optional filters.
   */
  async listSkills(filters?: {
    category?: string;
    agentType?: string;
    tag?: string;
    isBuiltin?: boolean;
    search?: string;
  }) {
    const where: Record<string, unknown> = { isPublic: true };

    if (filters?.category) where.category = filters.category;
    if (filters?.agentType) where.agentType = filters.agentType;
    if (filters?.isBuiltin !== undefined) where.isBuiltin = filters.isBuiltin;
    if (filters?.tag) where.tags = { has: filters.tag };
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return prisma.skill.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        agentType: true,
        category: true,
        tags: true,
        toolsRequired: true,
        isBuiltin: true,
        installCount: true,
        rating: true,
        createdAt: true,
      },
      orderBy: [{ isBuiltin: "desc" }, { installCount: "desc" }],
    });
  }

  /**
   * Get a single skill by slug (with full content).
   */
  async getSkillBySlug(slug: string) {
    return prisma.skill.findUnique({ where: { slug } });
  }

  /**
   * Create a custom skill (user-authored).
   */
  async createSkill(data: {
    name: string;
    slug: string;
    description: string;
    content: string;
    agentType: string;
    category: string;
    tags: string[];
    toolsRequired: string[];
    authorId: string;
  }) {
    return prisma.skill.create({
      data: {
        ...data,
        isBuiltin: false,
        isPublic: true,
      },
    });
  }

  /**
   * Find skills relevant to a user prompt.
   * Uses keyword matching against skill tags, categories, and names.
   */
  async findRelevantSkills(prompt: string, limit = 2): Promise<SkillData[]> {
    const lower = prompt.toLowerCase();

    // Keyword mapping: prompt keywords → skill slugs
    const KEYWORD_MAP: Record<string, string[]> = {
      "e-commerce": ["ecommerce"],
      "ecommerce": ["ecommerce"],
      "tienda": ["ecommerce"],
      "shop": ["ecommerce"],
      "carrito": ["ecommerce"],
      "checkout": ["ecommerce"],
      "dashboard": ["dashboard"],
      "analytics": ["dashboard"],
      "métricas": ["dashboard"],
      "kpi": ["dashboard"],
      "gráficos": ["dashboard"],
      "charts": ["dashboard"],
      "landing": ["landing-page"],
      "landing page": ["landing-page"],
      "página de aterrizaje": ["landing-page"],
      "saas": ["landing-page"],
      "blog": ["blog"],
      "artículos": ["blog"],
      "posts": ["blog"],
      "markdown": ["blog"],
      "react": ["react-app"],
      "aplicación web": ["react-app"],
      "web app": ["react-app"],
      "frontend": ["react-app"],
      "api": ["express-api"],
      "rest api": ["express-api"],
      "backend": ["express-api"],
      "servidor": ["express-api"],
      "express": ["express-api"],
      "portfolio": ["landing-page", "react-app"],
    };

    const matchedSlugs = new Set<string>();

    for (const [keyword, slugs] of Object.entries(KEYWORD_MAP)) {
      if (lower.includes(keyword)) {
        for (const slug of slugs) matchedSlugs.add(slug);
      }
    }

    if (matchedSlugs.size === 0) return [];

    // Fetch matched skills from DB
    const skills = await prisma.skill.findMany({
      where: { slug: { in: [...matchedSlugs] } },
      take: limit,
    });

    return skills.map((s) => ({
      name: s.name,
      slug: s.slug,
      agentType: s.agentType,
      category: s.category,
      tags: s.tags,
      tools: s.toolsRequired,
      description: s.description,
      content: s.content,
    }));
  }
}

// Singleton
export const skillService = new SkillService();
