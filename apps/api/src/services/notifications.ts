import { Server as SocketIOServer } from "socket.io";
import { prisma } from "@forgeai/db";
import { logger } from "../lib/logger";

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION SERVICE
// Centralizes all notification channels: in-app, email, push
// ═══════════════════════════════════════════════════════════════════

interface NotificationPayload {
  title: string;
  message: string;
  type: string;
  projectId?: string;
}

class NotificationService {
  private io: SocketIOServer | null = null;

  /** Set the Socket.IO instance (called once at startup) */
  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  // ── In-App (WebSocket + DB) ──────────────────────────────────

  async notifyInApp(userId: string, payload: NotificationPayload): Promise<void> {
    try {
      // Persist to DB
      const notification = await prisma.notification.create({
        data: {
          userId,
          title: payload.title,
          message: payload.message,
          type: payload.type,
          projectId: payload.projectId,
        },
      });

      // Push via WebSocket to all user's connected tabs
      if (this.io) {
        this.io.to(`user:${userId}`).emit("notification", {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          projectId: notification.projectId,
          read: false,
          createdAt: notification.createdAt.toISOString(),
        });
      }
    } catch (err) {
      logger.error({ err, userId, type: payload.type }, "Failed to send in-app notification");
    }
  }

  // ── Email (Resend — optional) ────────────────────────────────

  async notifyEmail(userId: string, subject: string, body: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (!user?.email) return;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Arya AI <notifications@forgeai.dev>",
          to: [user.email],
          subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#7c3aed;margin-bottom:16px">${subject}</h2>
            <p style="color:#333;line-height:1.6">${body}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
            <p style="color:#999;font-size:12px">Arya AI — Tu asistente de desarrollo inteligente</p>
          </div>`,
        }),
      });

      if (!res.ok) {
        logger.warn({ status: res.status, userId }, "Resend email failed");
      }
    } catch (err) {
      logger.warn({ err, userId }, "Email notification error (non-critical)");
    }
  }

  // ── Push (Web Push API — placeholder) ────────────────────────

  async notifyPush(userId: string, payload: NotificationPayload): Promise<void> {
    // Web Push requires storing push subscriptions per user
    // This is a placeholder for future implementation:
    // 1. User subscribes via service worker → POST /api/push/subscribe
    // 2. Store PushSubscription in DB (endpoint, keys.p256dh, keys.auth)
    // 3. Use web-push library to send notifications
    // For now, this is a no-op
    void userId;
    void payload;
  }

  // ═══════════════════════════════════════════════════════════════
  // HIGH-LEVEL NOTIFICATION TRIGGERS
  // ═══════════════════════════════════════════════════════════════

  /** Notify when the engine completes or fails */
  async onEngineComplete(projectId: string, status: "completed" | "failed", failedCount?: number): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, userId: true },
      });
      if (!project) return;

      const isSuccess = status === "completed" && (!failedCount || failedCount === 0);

      const payload: NotificationPayload = {
        title: isSuccess ? "Proyecto completado" : status === "failed" ? "Error en proyecto" : "Proyecto completado con errores",
        message: isSuccess
          ? `Tu proyecto "${project.name}" se ha completado exitosamente.`
          : status === "failed"
            ? `Tu proyecto "${project.name}" tuvo un error durante la ejecucion.`
            : `Tu proyecto "${project.name}" se completo con ${failedCount} tarea(s) fallida(s).`,
        type: isSuccess ? "engine_complete" : "engine_failed",
        projectId,
      };

      // Send in-app notification (always)
      await this.notifyInApp(project.userId, payload);

      // Send email notification for failures or completions
      await this.notifyEmail(
        project.userId,
        payload.title,
        payload.message
      );
    } catch (err) {
      logger.error({ err, projectId }, "Failed to send engine completion notification");
    }
  }

  /** Notify when an individual task completes */
  async onTaskComplete(projectId: string, taskTitle: string, taskStatus: "completed" | "failed"): Promise<void> {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, userId: true },
      });
      if (!project) return;

      await this.notifyInApp(project.userId, {
        title: taskStatus === "completed" ? "Tarea completada" : "Tarea fallida",
        message: `"${taskTitle}" en "${project.name}" ${taskStatus === "completed" ? "se completo" : "fallo"}.`,
        type: taskStatus === "completed" ? "task_complete" : "task_failed",
        projectId,
      });
    } catch (err) {
      logger.error({ err, projectId }, "Failed to send task notification");
    }
  }
}

// Singleton export
export const notificationService = new NotificationService();
