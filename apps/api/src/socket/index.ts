import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

// Max concurrent connections per user
const MAX_CONNECTIONS_PER_USER = 5;
const userConnectionCount = new Map<string, number>();

export function setupSocketHandlers(io: SocketIOServer) {
  // Set message size limit
  io.engine.on("connection", (rawSocket: any) => {
    rawSocket.maxHttpBufferSize = 1e6; // 1MB
  });

  // Authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      (socket as any).userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId as string;

    // Enforce per-user connection limit
    const currentCount = userConnectionCount.get(userId) || 0;
    if (currentCount >= MAX_CONNECTIONS_PER_USER) {
      logger.warn({ userId }, "Max connections exceeded, disconnecting");
      socket.disconnect(true);
      return;
    }
    userConnectionCount.set(userId, currentCount + 1);

    logger.info({ userId, socketId: socket.id }, "WebSocket connected");

    // Join user-specific room for notifications
    socket.join(`user:${userId}`);

    // Join project room
    socket.on("join:project", (projectId: string) => {
      if (typeof projectId !== "string" || projectId.length > 50) return;
      socket.join(`project:${projectId}`);
    });

    // Leave project room
    socket.on("leave:project", (projectId: string) => {
      if (typeof projectId !== "string") return;
      socket.leave(`project:${projectId}`);
    });

    // Handle errors
    socket.on("error", (err) => {
      logger.error({ userId, error: err.message }, "Socket error");
    });

    socket.on("disconnect", (reason) => {
      logger.info({ userId, reason }, "WebSocket disconnected");
      // Decrement connection count
      const count = userConnectionCount.get(userId) || 1;
      if (count <= 1) {
        userConnectionCount.delete(userId);
      } else {
        userConnectionCount.set(userId, count - 1);
      }
    });
  });
}
