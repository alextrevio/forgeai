import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { Sentry } from "../lib/sentry";
import { logger } from "../lib/logger";

// Max concurrent connections per user
const MAX_CONNECTIONS_PER_USER = 5;
const userConnectionCount = new Map<string, number>();

// ── Presence tracking ──────────────────────────────────────
interface PresenceEntry {
  userId: string;
  socketId: string;
  projectId: string;
  joinedAt: number;
}

const projectPresence = new Map<string, Set<PresenceEntry>>();

function addPresence(projectId: string, entry: PresenceEntry) {
  if (!projectPresence.has(projectId)) {
    projectPresence.set(projectId, new Set());
  }
  projectPresence.get(projectId)!.add(entry);
}

function removePresenceBySocket(socketId: string) {
  for (const [projectId, entries] of projectPresence) {
    for (const entry of entries) {
      if (entry.socketId === socketId) {
        entries.delete(entry);
      }
    }
    if (entries.size === 0) {
      projectPresence.delete(projectId);
    }
  }
}

function getPresenceList(projectId: string) {
  const entries = projectPresence.get(projectId);
  if (!entries) return [];
  // Deduplicate by userId
  const seen = new Set<string>();
  const result: Array<{ userId: string; joinedAt: number }> = [];
  for (const entry of entries) {
    if (!seen.has(entry.userId)) {
      seen.add(entry.userId);
      result.push({ userId: entry.userId, joinedAt: entry.joinedAt });
    }
  }
  return result;
}

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

    // ── Team rooms ──────────────────────────────────────
    socket.on("join:team", (teamId: string) => {
      if (typeof teamId !== "string" || teamId.length > 50) return;
      socket.join(`team:${teamId}`);
    });

    socket.on("leave:team", (teamId: string) => {
      if (typeof teamId !== "string") return;
      socket.leave(`team:${teamId}`);
    });

    // ── Project rooms with presence ─────────────────────
    socket.on("join:project", (projectId: string) => {
      if (typeof projectId !== "string" || projectId.length > 50) return;
      socket.join(`project:${projectId}`);

      // Track presence
      const entry: PresenceEntry = { userId, socketId: socket.id, projectId, joinedAt: Date.now() };
      addPresence(projectId, entry);

      // Broadcast updated presence to room
      io.to(`project:${projectId}`).emit("presence:update", {
        projectId,
        viewers: getPresenceList(projectId),
      });
    });

    // Leave project room
    socket.on("leave:project", (projectId: string) => {
      if (typeof projectId !== "string") return;
      socket.leave(`project:${projectId}`);

      // Remove presence for this socket in this project
      const entries = projectPresence.get(projectId);
      if (entries) {
        for (const entry of entries) {
          if (entry.socketId === socket.id) {
            entries.delete(entry);
          }
        }
        if (entries.size === 0) {
          projectPresence.delete(projectId);
        }
      }

      // Broadcast updated presence
      io.to(`project:${projectId}`).emit("presence:update", {
        projectId,
        viewers: getPresenceList(projectId),
      });
    });

    // Get current presence for a project
    socket.on("presence:get", (projectId: string) => {
      if (typeof projectId !== "string") return;
      socket.emit("presence:update", {
        projectId,
        viewers: getPresenceList(projectId),
      });
    });

    // Handle errors
    socket.on("error", (err) => {
      logger.error({ userId, error: err.message }, "Socket error");
      Sentry.captureException(err, {
        tags: { component: 'websocket', user_id: userId },
      });
    });

    socket.on("disconnect", (reason) => {
      logger.info({ userId, reason }, "WebSocket disconnected");

      // Clean up presence for all projects this socket was in
      const affectedProjects = new Set<string>();
      for (const [projectId, entries] of projectPresence) {
        for (const entry of entries) {
          if (entry.socketId === socket.id) {
            affectedProjects.add(projectId);
          }
        }
      }
      removePresenceBySocket(socket.id);

      // Broadcast updated presence for affected projects
      for (const projectId of affectedProjects) {
        io.to(`project:${projectId}`).emit("presence:update", {
          projectId,
          viewers: getPresenceList(projectId),
        });
      }

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
