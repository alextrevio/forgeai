"use client";

import { useEffect, useState } from "react";
import { WifiOff, Loader2 } from "lucide-react";
import { getSocket } from "@/lib/socket";

export function ReconnectBanner() {
  const [disconnected, setDisconnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    const onDisconnect = () => {
      setDisconnected(true);
      setReconnecting(true);
    };

    const onConnect = () => {
      setDisconnected(false);
      setReconnecting(false);
    };

    const onReconnectAttempt = () => {
      setReconnecting(true);
    };

    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);

    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
    };
  }, []);

  if (!disconnected) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[90] bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center justify-center gap-2">
      {reconnecting ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-warning" />
          <span className="text-xs text-warning">Reconnecting...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-warning" />
          <span className="text-xs text-warning">Connection lost. Attempting to reconnect...</span>
        </>
      )}
    </div>
  );
}
