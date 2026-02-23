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
  log: { color: "text-foreground", icon: null, bg: "" },
  info: { color: "text-blue-400", icon: <Info className="h-3 w-3" />, bg: "bg-blue-500/5" },
  warn: { color: "text-amber-400", icon: <AlertTriangle className="h-3 w-3" />, bg: "bg-amber-500/5" },
  error: { color: "text-red-400", icon: <AlertCircle className="h-3 w-3" />, bg: "bg-red-500/5" },
};

export function ConsolePanel({ entries, onClear }: ConsolePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Console ({entries.length})
        </span>
        <button
          onClick={onClear}
          className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
          title="Clear console"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Entries */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-xs">
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/50 text-xs">
            No console output yet
          </div>
        ) : (
          entries.map((entry, i) => {
            const style = levelStyles[entry.level] || levelStyles.log;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-2 px-3 py-1 border-b border-border/30 hover:bg-muted/5",
                  style.bg
                )}
              >
                <span className="text-muted-foreground/50 shrink-0 w-16 tabular-nums">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })}
                </span>
                {style.icon && (
                  <span className={cn("shrink-0 mt-0.5", style.color)}>{style.icon}</span>
                )}
                <span className={cn("flex-1 break-all whitespace-pre-wrap", style.color)}>
                  {entry.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Hook that listens for console messages from the preview iframe.
 * Inject this script into the iframe to forward console.* calls:
 *
 * ```js
 * const _origConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };
 * for (const level of ["log", "warn", "error", "info"]) {
 *   console[level] = (...args) => {
 *     _origConsole[level](...args);
 *     try { window.parent.postMessage({ __forgeai_console: true, level, message: args.map(String).join(" ") }, "*"); } catch {}
 *   };
 * }
 * ```
 */
export function useConsoleCapture(onEntry: (entry: ConsoleEntry) => void) {
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.__forgeai_console) {
        onEntry({
          level: event.data.level || "log",
          message: event.data.message || "",
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onEntry]);
}
