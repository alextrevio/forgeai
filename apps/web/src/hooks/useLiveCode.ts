"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket";

export interface LiveCodeFile {
  path: string;
  content: string;
  isTyping: boolean;
  agentType?: string;
  lastUpdate: number;
}

export function useLiveCode(projectId: string | null) {
  const [liveFiles, setLiveFiles] = useState<Map<string, LiveCodeFile>>(
    new Map()
  );
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const typingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearTypingTimer = useCallback((path: string) => {
    const existing = typingTimers.current.get(path);
    if (existing) {
      clearTimeout(existing);
      typingTimers.current.delete(path);
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    const socket = getSocket();

    const onEvent = (raw: unknown) => {
      const event = raw as { type: string; data: Record<string, unknown> };
      if (!event?.type?.startsWith("live_code:")) return;

      const data = event.data || {};

      switch (event.type) {
        case "live_code:file_start": {
          const path = data.path as string;
          const content = data.content as string;
          const agentType = data.agentType as string | undefined;

          setLiveFiles((prev) => {
            const next = new Map(prev);
            next.set(path, {
              path,
              content,
              isTyping: true,
              agentType,
              lastUpdate: Date.now(),
            });
            return next;
          });
          setActiveFile(path);
          setIsAgentTyping(true);

          // Auto-clear typing after animation duration (adaptive to content length)
          // ~10ms per tick, charsPerTick adapts, max 8s
          clearTypingTimer(path);
          const duration = Math.min(8000, Math.max(2000, content.length * 5));
          const timer = setTimeout(() => {
            setLiveFiles((prev) => {
              const next = new Map(prev);
              const file = next.get(path);
              if (file) next.set(path, { ...file, isTyping: false });
              return next;
            });
          }, duration);
          typingTimers.current.set(path, timer);
          break;
        }

        case "live_code:file_update": {
          const path = data.path as string;
          const content = data.content as string;
          const agentType = data.agentType as string | undefined;

          setLiveFiles((prev) => {
            const next = new Map(prev);
            next.set(path, {
              path,
              content,
              isTyping: true,
              agentType,
              lastUpdate: Date.now(),
            });
            return next;
          });
          setActiveFile(path);
          setIsAgentTyping(true);

          // Auto-clear typing for modifications (shorter)
          clearTypingTimer(path);
          const timer = setTimeout(() => {
            setLiveFiles((prev) => {
              const next = new Map(prev);
              const file = next.get(path);
              if (file) next.set(path, { ...file, isTyping: false });
              return next;
            });
          }, 3000);
          typingTimers.current.set(path, timer);
          break;
        }

        case "live_code:agent_typing": {
          setIsAgentTyping(data.isTyping as boolean);
          break;
        }
      }
    };

    socket.on("event", onEvent);

    return () => {
      socket.off("event", onEvent);
      // Clean up all timers
      typingTimers.current.forEach((t) => clearTimeout(t));
      typingTimers.current.clear();
    };
  }, [projectId, clearTypingTimer]);

  return {
    liveFiles,
    activeFile,
    setActiveFile,
    isAgentTyping,
  };
}
