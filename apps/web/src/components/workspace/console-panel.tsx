"use client";

import { useRef, useEffect } from "react";
import { Trash2, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConsoleEntry {
  level: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: number;
}

interface ConsolePanelProps {
  entries: ConsoleEntry[];
  onClear: () => void;
}

const levelStyles: Record<string, { color: string; icon: React.ReactNode; bg: string }> = {
  log: { color: "text-[#8888a0]", icon: null, bg: "" },
  info: { color: "text-[#60a5fa]", icon: <Info className="h-3 w-3" />, bg: "bg-[#60a5fa]/5" },
  warn: { color: "text-[#fbbf24]", icon: <AlertTriangle className="h-3 w-3" />, bg: "bg-[#fbbf24]/5" },
  error: { color: "text-[#f87171]", icon: <AlertCircle className="h-3 w-3" />, bg: "bg-[#f87171]/5" },
};

export function ConsolePanel({ entries: rawEntries, onClear }: ConsolePanelProps) {
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col bg-[#08080d]">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium text-[#8888a0]/60 uppercase tracking-wider">Console ({entries.length})</span>
        <button onClick={onClear} className="rounded-lg p-1 text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#161619] transition-all duration-150" title="Clear console">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[11px]">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[#8888a0]/20 text-[11px]">No console output yet</div>
        ) : (
          entries.map((entry, i) => {
            const style = levelStyles[entry.level] || levelStyles.log;
            return (
              <div key={i} className={cn("flex items-start gap-2 px-3 py-1 border-b border-[#1a1a1f]/30 hover:bg-[#161619]/30 transition-colors", style.bg)}>
                <span className="text-[#8888a0]/30 shrink-0 w-16 tabular-nums">{new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                {style.icon && <span className={cn("shrink-0 mt-0.5", style.color)}>{style.icon}</span>}
                <span className={cn("flex-1 break-all whitespace-pre-wrap", style.color)}>{entry.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function useConsoleCapture(onEntry: (entry: ConsoleEntry) => void) {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.__forgeai_console) {
        onEntry({ level: event.data.level || "log", message: event.data.message || "", timestamp: Date.now() });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onEntry]);
}
