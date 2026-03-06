import { io, Socket } from "socket.io-client";
import * as Sentry from "@sentry/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let socket: Socket | null = null;

// Connection state listeners for UI notifications
type ConnectionListener = (state: "connected" | "disconnected" | "reconnecting" | "reconnected") => void;
const connectionListeners = new Set<ConnectionListener>();

export function onConnectionChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  return () => connectionListeners.delete(listener);
}

function notifyListeners(state: "connected" | "disconnected" | "reconnecting" | "reconnected") {
  connectionListeners.forEach((l) => l(state));
}

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem("accessToken");
    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    // Re-send fresh token on each reconnect attempt
    socket.on("reconnect_attempt", () => {
      const freshToken = localStorage.getItem("accessToken");
      if (socket) {
        socket.auth = { token: freshToken };
      }
      notifyListeners("reconnecting");
    });

    socket.on("connect", () => {
      notifyListeners("connected");
    });

    socket.on("reconnect", () => {
      notifyListeners("reconnected");
    });

    socket.on("disconnect", (reason) => {
      if (reason !== "io client disconnect") {
        notifyListeners("disconnected");
      }
    });

    socket.on("connect_error", (err) => {
      Sentry.captureException(err, {
        tags: { component: "websocket", event: "connect_error" },
      });
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
