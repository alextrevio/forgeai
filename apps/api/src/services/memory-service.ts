import { prisma } from "@forgeai/db";
import { logger } from "../lib/logger";

interface MemoryRecord {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  usageCount: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class MemoryService {
  /** Get all memories for a user, grouped by category */
  async getUserMemories(userId: string): Promise<MemoryRecord[]> {
    return prisma.userMemory.findMany({
      where: { userId },
      orderBy: [{ category: "asc" }, { usageCount: "desc" }],
    });
  }

  /** Build a context string from user memories to inject into the planner prompt */
  async getRelevantMemories(userId: string): Promise<string> {
    const memories = await prisma.userMemory.findMany({
      where: { userId },
      orderBy: { usageCount: "desc" },
      take: 20,
    });

    if (memories.length === 0) return "";

    let context = "\n\nCONTEXTO DEL USUARIO (memorias de proyectos anteriores):\n";

    const byCategory = this.groupByCategory(memories);
    for (const [category, items] of Object.entries(byCategory)) {
      context += `\n${this.categoryLabel(category)}:\n`;
      for (const item of items) {
        context += `- ${item.key}: ${item.value}\n`;
      }
    }

    context +=
      "\nUsa este contexto para personalizar tu respuesta. No menciones que tienes memorias, simplemente actúa con este conocimiento.\n";

    // Bump usage counts (fire-and-forget)
    const ids = memories.map((m) => m.id);
    prisma.userMemory
      .updateMany({
        where: { id: { in: ids } },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return context;
  }

  /** Upsert a single memory */
  async saveMemory(
    userId: string,
    category: string,
    key: string,
    value: string,
    source: string = "auto"
  ): Promise<MemoryRecord> {
    return prisma.userMemory.upsert({
      where: { userId_category_key: { userId, category, key } },
      create: {
        userId,
        category,
        key,
        value,
        source,
        confidence: source === "manual" ? 1.0 : 0.8,
      },
      update: {
        value,
        source,
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        ...(source === "manual" ? { confidence: 1.0 } : {}),
      },
    });
  }

  /** Extract memories automatically from a completed project */
  async extractMemoriesFromProject(
    userId: string,
    projectId: string
  ): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { tasks: true },
      });
      if (!project) return;

      const tasks = project.tasks || [];
      const coderTasks = tasks.filter(
        (t) => t.agentType === "coder" && t.outputResult
      );

      for (const task of coderTasks) {
        const result = task.outputResult as Record<string, unknown> | null;
        if (!result) continue;

        // Detect frameworks from files created
        if (result.filesCreated) {
          const files = Array.isArray(result.filesCreated)
            ? (result.filesCreated as string[])
            : [];
          if (files.some((f) => f.includes("tsx") || f.includes("jsx"))) {
            await this.saveMemory(userId, "stack", "frontend_framework", "React");
          }
          if (files.some((f) => f.includes(".vue"))) {
            await this.saveMemory(userId, "stack", "frontend_framework", "Vue");
          }
          if (files.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
            await this.saveMemory(userId, "stack", "language", "TypeScript");
          }
          if (files.some((f) => f.includes("tailwind"))) {
            await this.saveMemory(userId, "stack", "css_framework", "Tailwind CSS");
          }
          if (files.some((f) => f.includes("prisma"))) {
            await this.saveMemory(userId, "stack", "orm", "Prisma");
          }
          if (files.some((f) => f.includes("next.config") || f.includes("_app"))) {
            await this.saveMemory(userId, "stack", "meta_framework", "Next.js");
          }
        }

        // Detect packages installed
        if (result.packagesInstalled) {
          const packages = Array.isArray(result.packagesInstalled)
            ? (result.packagesInstalled as string[])
            : [];
          for (const pkg of packages.slice(0, 10)) {
            await this.saveMemory(userId, "stack", `package_${pkg}`, pkg);
          }
        }
      }

      // Store the project type / framework preference
      if (project.framework) {
        await this.saveMemory(
          userId,
          "preferences",
          "preferred_framework",
          project.framework
        );
      }

      if (project.name) {
        await this.saveMemory(
          userId,
          "context",
          "last_project_type",
          project.name
        );
      }

      logger.info({ userId, projectId }, "Memory: extracted memories from project");
    } catch (err) {
      logger.warn({ err, userId, projectId }, "Memory: failed to extract memories");
    }
  }

  /** Delete a specific memory (only if it belongs to the user) */
  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    await prisma.userMemory.deleteMany({
      where: { id: memoryId, userId },
    });
  }

  /** Clear all memories for a user */
  async clearAllMemories(userId: string): Promise<void> {
    await prisma.userMemory.deleteMany({ where: { userId } });
  }

  /** Get a summary string for the dashboard indicator */
  async getMemorySummary(userId: string): Promise<string | null> {
    const stackMemories = await prisma.userMemory.findMany({
      where: { userId, category: "stack" },
      orderBy: { usageCount: "desc" },
      take: 5,
      select: { value: true },
    });

    if (stackMemories.length === 0) return null;

    return stackMemories.map((m) => m.value).join(" + ");
  }

  private groupByCategory(
    memories: MemoryRecord[]
  ): Record<string, MemoryRecord[]> {
    return memories.reduce(
      (acc, m) => {
        if (!acc[m.category]) acc[m.category] = [];
        acc[m.category].push(m);
        return acc;
      },
      {} as Record<string, MemoryRecord[]>
    );
  }

  private categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      preferences: "Preferencias",
      stack: "Stack tecnológico",
      patterns: "Patrones de código",
      context: "Contexto",
      feedback: "Feedback",
    };
    return labels[category] || category;
  }
}

export const memoryService = new MemoryService();
