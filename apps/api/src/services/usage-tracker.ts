import { prisma } from "@forgeai/db";
import { logger } from "../lib/logger";

// ═══════════════════════════════════════════════════════════════════
// PRICING — USD per 1M tokens
// ═══════════════════════════════════════════════════════════════════

const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.25, output: 1.25 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10.0 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

// Default pricing for unknown models
const DEFAULT_PRICING = { input: 3.0, output: 15.0 };

// Budget per plan (USD) — used as default monthlyBudget
export const PLAN_BUDGETS: Record<string, number> = {
  FREE: 10.0,
  PRO: 50.0,
  BUSINESS: 200.0,
  ENTERPRISE: 10000.0,
};

// ═══════════════════════════════════════════════════════════════════
// USAGE TRACKER
// ═══════════════════════════════════════════════════════════════════

interface TrackUsageParams {
  userId: string;
  projectId?: string;
  taskId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  agentType?: string;
  action: string; // chat, engine_plan, engine_task
}

class UsageTracker {
  /** Calculate cost in USD for a given model and token counts */
  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = PRICING[model] || DEFAULT_PRICING;
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal precision
  }

  /** Estimate token count from text (rough: ~4 chars per token for English) */
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** Track a usage record, check spending cap, update totals */
  async trackUsage(params: TrackUsageParams) {
    const totalTokens = params.inputTokens + params.outputTokens;
    const costUsd = this.calculateCost(params.model, params.inputTokens, params.outputTokens);

    // Check spending cap
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { monthlyBudget: true, totalSpent: true, plan: true },
    });

    if (user && user.totalSpent + costUsd > user.monthlyBudget) {
      logger.warn({ userId: params.userId, totalSpent: user.totalSpent, costUsd, budget: user.monthlyBudget }, "Spending cap reached");
      throw new SpendingCapError(user.monthlyBudget, user.totalSpent);
    }

    // Record usage
    const record = await prisma.usageRecord.create({
      data: {
        userId: params.userId,
        projectId: params.projectId,
        taskId: params.taskId,
        provider: params.provider,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens,
        costUsd,
        agentType: params.agentType,
        action: params.action,
      },
    });

    // Update user total
    await prisma.user.update({
      where: { id: params.userId },
      data: { totalSpent: { increment: costUsd } },
    });

    // Update project totals if applicable
    if (params.projectId) {
      await prisma.project.update({
        where: { id: params.projectId },
        data: {
          totalTokensUsed: { increment: totalTokens },
          estimatedCost: { increment: costUsd },
        },
      }).catch(() => {}); // Non-critical if project doesn't exist
    }

    // Update task token count if applicable
    if (params.taskId) {
      await prisma.task.update({
        where: { id: params.taskId },
        data: { tokensUsed: { increment: totalTokens } },
      }).catch(() => {});
    }

    return record;
  }

  /** Get usage summary for a user */
  async getUserSummary(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, monthlyBudget: true, totalSpent: true, creditsUsed: true, creditsLimit: true },
    });
    if (!user) return null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregate by day
    const records = await prisma.usageRecord.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { costUsd: true, totalTokens: true, inputTokens: true, outputTokens: true, model: true, agentType: true, projectId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by day
    const dailyCost: Record<string, { cost: number; tokens: number }> = {};
    const byModel: Record<string, { cost: number; tokens: number; count: number }> = {};
    const byAgent: Record<string, { cost: number; tokens: number; count: number }> = {};
    const byProject: Record<string, { cost: number; tokens: number; count: number }> = {};

    for (const r of records) {
      const day = r.createdAt.toISOString().split("T")[0];
      if (!dailyCost[day]) dailyCost[day] = { cost: 0, tokens: 0 };
      dailyCost[day].cost += r.costUsd;
      dailyCost[day].tokens += r.totalTokens;

      const model = r.model || "unknown";
      if (!byModel[model]) byModel[model] = { cost: 0, tokens: 0, count: 0 };
      byModel[model].cost += r.costUsd;
      byModel[model].tokens += r.totalTokens;
      byModel[model].count++;

      const agent = r.agentType || "other";
      if (!byAgent[agent]) byAgent[agent] = { cost: 0, tokens: 0, count: 0 };
      byAgent[agent].cost += r.costUsd;
      byAgent[agent].tokens += r.totalTokens;
      byAgent[agent].count++;

      if (r.projectId) {
        if (!byProject[r.projectId]) byProject[r.projectId] = { cost: 0, tokens: 0, count: 0 };
        byProject[r.projectId].cost += r.costUsd;
        byProject[r.projectId].tokens += r.totalTokens;
        byProject[r.projectId].count++;
      }
    }

    // Top projects by cost
    const projectIds = Object.keys(byProject);
    let topProjects: Array<{ id: string; name: string; cost: number; tokens: number }> = [];
    if (projectIds.length > 0) {
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(projects.map((p) => [p.id, p.name]));
      topProjects = projectIds
        .map((id) => ({ id, name: nameMap.get(id) || "Unknown", cost: byProject[id].cost, tokens: byProject[id].tokens }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10);
    }

    return {
      plan: user.plan,
      monthlyBudget: user.monthlyBudget,
      totalSpent: user.totalSpent,
      creditsUsed: user.creditsUsed,
      creditsLimit: user.creditsLimit,
      dailyCost,
      byModel,
      byAgent,
      topProjects,
    };
  }

  /** Get paginated usage records */
  async getRecords(userId: string, opts: { limit?: number; offset?: number; projectId?: string }) {
    const where: any = { userId };
    if (opts.projectId) where.projectId = opts.projectId;

    const [records, total] = await Promise.all([
      prisma.usageRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: opts.limit || 50,
        skip: opts.offset || 0,
        select: {
          id: true,
          provider: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          costUsd: true,
          agentType: true,
          action: true,
          projectId: true,
          taskId: true,
          createdAt: true,
        },
      }),
      prisma.usageRecord.count({ where }),
    ]);

    return { records, total };
  }

  /** Get usage for a specific project */
  async getProjectUsage(projectId: string) {
    const records = await prisma.usageRecord.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        costUsd: true,
        agentType: true,
        action: true,
        createdAt: true,
      },
    });

    const totalCost = records.reduce((sum, r) => sum + r.costUsd, 0);
    const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);

    return { records, totalCost, totalTokens };
  }
}

// ── Custom Error ──────────────────────────────────────────────────

export class SpendingCapError extends Error {
  budget: number;
  spent: number;
  constructor(budget: number, spent: number) {
    super("SPENDING_CAP_REACHED");
    this.name = "SpendingCapError";
    this.budget = budget;
    this.spent = spent;
  }
}

// Singleton
export const usageTracker = new UsageTracker();
