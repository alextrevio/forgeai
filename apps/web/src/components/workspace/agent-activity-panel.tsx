"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  FileText,
  FilePlus2,
  FileEdit,
  Trash2,
  Terminal,
  ChevronDown,
  ChevronRight,
  Brain,
  Activity,
  Sparkles,
  X,
} from "lucide-react";
import { useProjectStore, type ActivityItem } from "@/stores/project-store";
import { cn } from "@/lib/utils";

function safeArray<T>(data: T[]): T[];
function safeArray<T>(data: T[] | null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

// ─── Relative time ─────────────────────────────────────────────
function relativeTime(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 5) return "ahora";
  if (diff < 60) return `hace ${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `hace ${hrs}h`;
}

// ─── Thinking messages rotation ───────────────────────────────
const THINKING_MESSAGES = [
  "Analizando la estructura del proyecto...",
  "Diseñando los componentes...",
  "Planificando la implementación...",
  "Evaluando dependencias...",
  "Optimizando la arquitectura...",
  "Revisando mejores prácticas...",
  "Preparando los cambios...",
];

function ThinkingIndicator({ text }: { text: string | null }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (text) return; // If explicit thinking text, don't rotate
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIdx((i) => (i + 1) % THINKING_MESSAGES.length);
        setFade(true);
      }, 200);
    }, 3000);
    return () => clearInterval(interval);
  }, [text]);

  const displayText = text || THINKING_MESSAGES[msgIdx];

  return (
    <div className="flex items-start gap-3 px-3 py-3 bg-[#7c3aed]/5 border border-[#7c3aed]/10 rounded-lg activity-item-enter">
      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center shrink-0">
        <Brain className="h-3.5 w-3.5 text-white animate-thinking-pulse" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[12px] font-semibold text-[#EDEDED]">Arya está pensando</span>
          <span className="inline-flex gap-[3px] items-center">
            <span className="h-[4px] w-[4px] rounded-full bg-[#a78bfa] animate-dot-1" />
            <span className="h-[4px] w-[4px] rounded-full bg-[#a78bfa] animate-dot-2" />
            <span className="h-[4px] w-[4px] rounded-full bg-[#a78bfa] animate-dot-3" />
          </span>
        </div>
        <p className={cn(
          "text-[11px] text-[#a78bfa] transition-opacity duration-200 truncate",
          fade ? "opacity-100" : "opacity-0"
        )}>
          {displayText}
        </p>
      </div>
    </div>
  );
}

// ─── Plan Steps Section ────────────────────────────────────────
function PlanStepsSection() {
  const currentPlan = useProjectStore((s) => s.currentPlan);
  const steps = useMemo(() => safeArray(currentPlan?.steps || []), [currentPlan]);

  if (steps.length === 0) return null;

  return (
    <div className="space-y-0">
      <div className="px-3 py-2">
        <span className="text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider">Plan de ejecución</span>
      </div>
      <div className="relative px-3">
        {/* Vertical connector line */}
        <div className="absolute left-[27px] top-0 bottom-0 w-px bg-[#2A2A2A]" />

        {steps.map((step, i) => {
          const isRunning = step.status === "in_progress";
          const isDone = step.status === "completed";
          const isFailed = step.status === "failed";

          return (
            <div
              key={step.id}
              className={cn(
                "relative flex items-start gap-3 py-2 pl-0 activity-item-enter",
                isRunning && "bg-[#7c3aed]/5 -mx-3 px-3 border-l-2 border-[#7c3aed] rounded-r-lg",
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {/* Status icon */}
              <div className="relative z-10 shrink-0 mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-[#22c55e] animate-check-scale" />
                ) : isRunning ? (
                  <Loader2 className="h-4 w-4 text-[#7c3aed] animate-spin" />
                ) : isFailed ? (
                  <XCircle className="h-4 w-4 text-[#ef4444]" />
                ) : (
                  <Circle className="h-4 w-4 text-[#4a4a5e]" />
                )}
              </div>

              {/* Step text */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[12px] leading-relaxed",
                  isDone ? "text-[#8888a0]" :
                  isRunning ? "text-[#EDEDED] font-medium" :
                  isFailed ? "text-[#ef4444]" :
                  "text-[#4a4a5e]"
                )}>
                  {step.description}
                </p>
                {isRunning && step.filesAffected && safeArray(step.filesAffected).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {safeArray(step.filesAffected).slice(0, 3).map((f: string) => (
                      <span key={f} className="text-[10px] text-[#8888a0] bg-[#1A1A1A] rounded px-1.5 py-0.5 font-mono">
                        {f.split("/").pop()}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Step number */}
              <span className="text-[10px] text-[#4a4a5e] tabular-nums shrink-0 mt-0.5">
                {i + 1}/{steps.length}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── File Activity Item ───────────────────────────────────────
function FileActivityItem({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);

  const actionConfig = {
    create: { icon: FilePlus2, label: "nuevo", color: "text-[#22c55e]", badgeBg: "bg-[#22c55e]/10 text-[#22c55e]", verb: "Creando" },
    edit: { icon: FileEdit, label: "modificado", color: "text-[#3b82f6]", badgeBg: "bg-[#3b82f6]/10 text-[#3b82f6]", verb: "Editando" },
    delete: { icon: Trash2, label: "eliminado", color: "text-[#ef4444]", badgeBg: "bg-[#ef4444]/10 text-[#ef4444]", verb: "Eliminando" },
  };

  const config = actionConfig[item.fileAction || "edit"];
  const Icon = config.icon;
  const fileName = item.filePath?.split("/").pop() || "archivo";
  const dirPath = item.filePath?.split("/").slice(0, -1).join("/") || "";

  return (
    <div className="activity-item-enter">
      <button
        onClick={() => item.fileDiff && setExpanded(!expanded)}
        className={cn(
          "flex items-start gap-2.5 w-full text-left px-3 py-2 rounded-lg transition-colors",
          item.fileDiff ? "hover:bg-[#1A1A1A]/50 cursor-pointer" : "cursor-default"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#EDEDED] truncate font-mono">
              {fileName}
            </span>
            <span className={cn("text-[9px] font-medium rounded-full px-1.5 py-0.5", config.badgeBg)}>
              {config.label}
            </span>
          </div>
          {dirPath && (
            <p className="text-[10px] text-[#4a4a5e] font-mono truncate mt-0.5">{dirPath}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#4a4a5e]">{relativeTime(item.timestamp)}</span>
          {item.fileDiff && (
            <ChevronRight className={cn(
              "h-3 w-3 text-[#4a4a5e] transition-transform duration-200",
              expanded && "rotate-90"
            )} />
          )}
        </div>
      </button>

      {/* Collapsible diff preview */}
      {expanded && item.fileDiff && (
        <div className="mx-3 mb-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] overflow-hidden animate-fade-in">
          <pre className="text-[10px] font-mono leading-relaxed p-3 overflow-x-auto max-h-[200px] overflow-y-auto">
            {item.fileDiff.split("\n").map((line, i) => (
              <div
                key={i}
                className={cn(
                  "px-1",
                  line.startsWith("+") && !line.startsWith("+++") && "text-[#22c55e] bg-[#22c55e]/5",
                  line.startsWith("-") && !line.startsWith("---") && "text-[#ef4444] bg-[#ef4444]/5",
                  line.startsWith("@@") && "text-[#7c3aed]",
                  !line.startsWith("+") && !line.startsWith("-") && !line.startsWith("@@") && "text-[#8888a0]"
                )}
              >
                {line}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Terminal Command Item ────────────────────────────────────
function TerminalCommandItem({ item }: { item: ActivityItem }) {
  const [expanded, setExpanded] = useState(false);
  const outputLines = (item.output || "").split("\n").filter(Boolean);
  const previewLines = outputLines.slice(-3);
  const hasMore = outputLines.length > 3;

  return (
    <div className="activity-item-enter">
      <button
        onClick={() => hasMore && setExpanded(!expanded)}
        className={cn(
          "flex items-start gap-2.5 w-full text-left px-3 py-2 rounded-lg transition-colors",
          hasMore ? "hover:bg-[#1A1A1A]/50 cursor-pointer" : "cursor-default"
        )}
      >
        <Terminal className="h-4 w-4 text-[#f59e0b] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-[#7c3aed] font-mono">$</span>
            <span className="text-[12px] text-[#EDEDED] font-mono truncate">{item.command}</span>
          </div>
          {/* Preview: last 3 lines */}
          {previewLines.length > 0 && !expanded && (
            <div className="mt-1 space-y-0">
              {previewLines.map((line, i) => (
                <p key={i} className="text-[10px] text-[#8888a0]/60 font-mono truncate">{line}</p>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[#4a4a5e]">{relativeTime(item.timestamp)}</span>
          {hasMore && (
            <ChevronDown className={cn(
              "h-3 w-3 text-[#4a4a5e] transition-transform duration-200",
              expanded && "rotate-180"
            )} />
          )}
        </div>
      </button>

      {/* Expanded full output */}
      {expanded && (
        <div className="mx-3 mb-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] overflow-hidden animate-fade-in">
          <pre className="text-[10px] font-mono leading-relaxed p-3 text-[#8888a0] overflow-x-auto max-h-[200px] overflow-y-auto">
            {item.output}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Activity Item Renderer ──────────────────────────────────
function ActivityItemRenderer({ item }: { item: ActivityItem }) {
  switch (item.type) {
    case "file_change":
      return <FileActivityItem item={item} />;
    case "terminal_cmd":
      return <TerminalCommandItem item={item} />;
    case "agent_switch":
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 activity-item-enter">
          <Sparkles className="h-3 w-3 text-[#7c3aed]" />
          <span className="text-[11px] text-[#8888a0]">
            {item.agent === "coder" ? "Codificando" :
             item.agent === "designer" ? "Diseñando" :
             item.agent === "debugger" ? "Depurando" :
             item.agent === "deployer" ? "Desplegando" :
             item.agent === "reviewer" ? "Revisando" :
             item.agent === "planner" ? "Planificando" :
             item.agent}
          </span>
          <span className="text-[10px] text-[#4a4a5e] ml-auto">{relativeTime(item.timestamp)}</span>
        </div>
      );
    case "complete":
      return (
        <div className="flex items-start gap-2.5 px-3 py-2 activity-item-enter">
          <CheckCircle2 className="h-4 w-4 text-[#22c55e] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] text-[#22c55e] font-medium">Completado</span>
            {item.summary && (
              <p className="text-[11px] text-[#8888a0] mt-0.5 line-clamp-2">{item.summary}</p>
            )}
          </div>
          <span className="text-[10px] text-[#4a4a5e] shrink-0">{relativeTime(item.timestamp)}</span>
        </div>
      );
    case "error":
      return (
        <div className="flex items-start gap-2.5 px-3 py-2 activity-item-enter">
          <XCircle className="h-4 w-4 text-[#ef4444] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[12px] text-[#ef4444] font-medium">Error</span>
            {item.errorMessage && (
              <p className="text-[11px] text-[#8888a0] mt-0.5 line-clamp-2">{item.errorMessage}</p>
            )}
          </div>
          <span className="text-[10px] text-[#4a4a5e] shrink-0">{relativeTime(item.timestamp)}</span>
        </div>
      );
    default:
      return null;
  }
}

// ─── Main Panel ──────────────────────────────────────────────
export function AgentActivityPanel({ onClose }: { onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAgentRunning = useProjectStore((s) => s.isAgentRunning);
  const agentThinking = useProjectStore((s) => s.agentThinking);
  const activityItems = useProjectStore((s) => s.activityItems);
  const currentPlan = useProjectStore((s) => s.currentPlan);

  const items = useMemo(() => safeArray(activityItems), [activityItems]);
  const hasPlan = currentPlan && safeArray(currentPlan.steps).length > 0;

  // File changes and terminal commands from the feed
  const fileChanges = useMemo(() => items.filter((i) => i.type === "file_change"), [items]);
  const terminalCmds = useMemo(() => items.filter((i) => i.type === "terminal_cmd"), [items]);
  const otherItems = useMemo(() => items.filter((i) =>
    i.type !== "file_change" && i.type !== "terminal_cmd" && i.type !== "thinking" && i.type !== "plan"
  ), [items]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activityItems, currentPlan]);

  // Update relative times
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-full flex-col bg-[#0E0E0E] animate-slide-in-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#7c3aed]" />
          <span className="text-[13px] font-semibold text-[#EDEDED]">Actividad del agente</span>
          {isAgentRunning && (
            <div className="h-2 w-2 rounded-full bg-[#22c55e] live-pulse" />
          )}
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center h-6 w-6 rounded-md text-[#8888a0] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2 space-y-1">
        {/* Thinking indicator */}
        {isAgentRunning && (
          <div className="px-2 mb-2">
            <ThinkingIndicator text={agentThinking} />
          </div>
        )}

        {/* Plan steps */}
        {hasPlan && <PlanStepsSection />}

        {/* Divider if plan exists */}
        {hasPlan && (fileChanges.length > 0 || terminalCmds.length > 0) && (
          <div className="h-px bg-[#2A2A2A] mx-3 my-2" />
        )}

        {/* File activity */}
        {fileChanges.length > 0 && (
          <div>
            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider">
                Archivos ({fileChanges.length})
              </span>
            </div>
            {fileChanges.map((item) => (
              <ActivityItemRenderer key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Terminal commands */}
        {terminalCmds.length > 0 && (
          <div>
            {fileChanges.length > 0 && <div className="h-px bg-[#2A2A2A] mx-3 my-2" />}
            <div className="px-3 py-2">
              <span className="text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider">
                Terminal ({terminalCmds.length})
              </span>
            </div>
            {terminalCmds.map((item) => (
              <ActivityItemRenderer key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Other activity items (agent switches, completions, errors) */}
        {otherItems.length > 0 && (
          <div>
            {(fileChanges.length > 0 || terminalCmds.length > 0) && (
              <div className="h-px bg-[#2A2A2A] mx-3 my-2" />
            )}
            {otherItems.map((item) => (
              <ActivityItemRenderer key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isAgentRunning && items.length === 0 && !hasPlan && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Activity className="h-10 w-10 text-[#8888a0]/10 mb-4" />
            <p className="text-[13px] text-[#8888a0]/40 mb-1">Sin actividad</p>
            <p className="text-[11px] text-[#4a4a5e]">
              La actividad del agente aparecerá aquí cuando Arya comience a trabajar.
            </p>
          </div>
        )}
      </div>

      {/* Footer with summary stats */}
      {items.length > 0 && (
        <div className="border-t border-[#2A2A2A] px-4 py-2 flex items-center gap-3 shrink-0">
          {fileChanges.length > 0 && (
            <span className="text-[10px] text-[#8888a0] flex items-center gap-1">
              <FileText className="h-3 w-3" /> {fileChanges.length} archivos
            </span>
          )}
          {terminalCmds.length > 0 && (
            <span className="text-[10px] text-[#8888a0] flex items-center gap-1">
              <Terminal className="h-3 w-3" /> {terminalCmds.length} comandos
            </span>
          )}
          {hasPlan && (
            <span className="text-[10px] text-[#8888a0] ml-auto tabular-nums">
              {safeArray(currentPlan!.steps).filter((s) => s.status === "completed").length}/{safeArray(currentPlan!.steps).length} pasos
            </span>
          )}
        </div>
      )}
    </div>
  );
}
