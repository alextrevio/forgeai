import { Router } from "express";
import { prisma } from "@forgeai/db";

const router = Router();

// GET /api/notifications — List notifications for current user
router.get("/", async (req, res, next) => {
  try {
    const userId = (req as any).userId;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, read: false },
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/notifications/:id/read — Mark a notification as read
router.patch("/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    await prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all — Mark all notifications as read
router.post("/read-all", async (req, res, next) => {
  try {
    const userId = (req as any).userId;

    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export { router as notificationRouter };
