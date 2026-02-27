"use client";

import { useState, useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

interface PresenceViewer {
  userId: string;
  joinedAt: number;
}

interface PresenceIndicatorsProps {
  projectId: string | null;
}

const COLORS = [
  "bg-[#7c3aed]",
  "bg-[#3b82f6]",
  "bg-[#22c55e]",
  "bg-[#f59e0b]",
  "bg-[#ef4444]",
  "bg-[#ec4899]",
];

function getColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function PresenceIndicators({ projectId }: PresenceIndicatorsProps) {
  const [viewers, setViewers] = useState<PresenceViewer[]>([]);

  useEffect(() => {
    if (!projectId) return;
    const socket = getSocket();

    const onPresence = (data: { projectId: string; viewers: PresenceViewer[] }) => {
      if (data.projectId === projectId) {
        setViewers(data.viewers || []);
      }
    };

    socket.on("presence:update", onPresence);

    // Request current presence
    socket.emit("presence:get", projectId);

    return () => {
      socket.off("presence:update", onPresence);
    };
  }, [projectId]);

  if (viewers.length <= 1) return null;

  const MAX_VISIBLE = 5;
  const visible = viewers.slice(0, MAX_VISIBLE);
  const overflow = viewers.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((viewer) => (
        <div
          key={viewer.userId}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0A0A0A] text-[9px] font-semibold text-white shrink-0",
            getColor(viewer.userId)
          )}
          title={viewer.userId}
        >
          {viewer.userId.charAt(0).toUpperCase()}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0A0A0A] bg-[#2A2A2A] text-[9px] font-semibold text-[#8888a0] shrink-0">
          +{overflow}
        </div>
      )}
    </div>
  );
}
