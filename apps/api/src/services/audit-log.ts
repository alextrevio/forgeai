import { prisma, Prisma } from "@forgeai/db";
import { logger } from "../lib/logger";

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG SERVICE
// Fire-and-forget audit trail for team actions
// ═══════════════════════════════════════════════════════════════════

interface AuditEntry {
  teamId?: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

class AuditLogService {
  /** Fire-and-forget log entry */
  log(entry: AuditEntry): void {
    prisma.auditLog
      .create({
        data: {
          teamId: entry.teamId ?? null,
          userId: entry.userId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          details: (entry.details ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          ip: entry.ip ?? null,
        },
      })
      .catch((err) => {
        logger.warn({ err, action: entry.action }, "Failed to write audit log");
      });
  }

  /** Cursor-paginated team audit logs */
  async getTeamLogs(
    teamId: string,
    opts: { limit?: number; before?: string } = {}
  ): Promise<{ logs: any[]; hasMore: boolean; nextCursor: string | null }> {
    const limit = Math.min(opts.limit || 50, 200);

    const logs = await prisma.auditLog.findMany({
      where: { teamId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(opts.before && { cursor: { id: opts.before }, skip: 1 }),
      select: {
        id: true,
        userId: true,
        action: true,
        resource: true,
        resourceId: true,
        details: true,
        ip: true,
        createdAt: true,
      },
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { logs: items, hasMore, nextCursor };
  }
}

// Singleton export
export const auditLogService = new AuditLogService();
