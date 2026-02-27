import { io, Socket } from "socket.io-client";
import * as Sentry from "@sentry/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem("accessToken");
    socket = io(API_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    // Re-send fresh token on each reconnect attempt
    socket.on("reconnect_attempt", () => {
      const freshToken = localStorage.getItem("accessToken");
      if (socket) {
        socket.auth = { token: freshToken };
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
