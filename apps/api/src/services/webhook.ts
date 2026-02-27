import { createHmac } from "crypto";
import { prisma } from "@forgeai/db";
import { logger } from "../lib/logger";

// ══════════════════════════════════════════════════════════════════
// WEBHOOK SERVICE — Sends events to user-configured webhook URLs
// ══════════════════════════════════════════════════════════════════

class WebhookService {
  /**
   * Dispatch an event to all active webhooks for a user that subscribe to this event type.
   * Fire-and-forget — never throws.
   */
  async dispatch(userId: string, event: string, payload: Record<string, unknown>) {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { userId, isActive: true, events: { has: event } },
      });

      if (webhooks.length === 0) return;

      const deliveries = webhooks.map((wh) => this.deliver(wh.id, wh.url, wh.secret, event, payload));
      await Promise.allSettled(deliveries);
    } catch (err) {
      logger.warn({ err, userId, event }, "Webhook dispatch failed");
    }
  }

  /**
   * Send a single webhook delivery and record the result.
   */
  private async deliver(
    webhookId: string,
    url: string,
    secret: string,
    event: string,
    payload: Record<string, unknown>
  ) {
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    const signature = this.sign(body, secret);
    const startTime = Date.now();
    let statusCode: number | null = null;
    let responseText: string | null = null;
    let success = false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Arya-Event": event,
          "X-Arya-Signature": signature,
          "X-Arya-Timestamp": new Date().toISOString(),
          "User-Agent": "Arya-Webhooks/1.0",
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      statusCode = response.status;
      responseText = await response.text().catch(() => null);
      success = response.ok;
    } catch (err: any) {
      responseText = err.message || "Request failed";
    }

    const durationMs = Date.now() - startTime;

    // Record delivery (fire-and-forget)
    prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload: { event, data: payload } as any,
        statusCode,
        response: responseText ? responseText.slice(0, 2000) : null,
        success,
        durationMs,
      },
    }).catch((err) => {
      logger.warn({ err: err.message, webhookId }, "Failed to record webhook delivery");
    });

    if (!success) {
      logger.warn({ webhookId, event, statusCode, durationMs }, "Webhook delivery failed");
    }
  }

  /**
   * Sign a payload using HMAC-SHA256.
   */
  private sign(payload: string, secret: string): string {
    return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
  }
}

// Singleton
export const webhookService = new WebhookService();
