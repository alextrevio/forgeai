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
  FileX2,
  Terminal,
  ChevronDown,
  ChevronRight,
  Brain,
  Sparkles,
  Activity,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";
import {
  useEngineActivity,
  type EngineActivity,
  type EnginePlanStep,
} from "@/hooks/useEngineActivity";
import { useProjectStore } from "@/stores/project-store";
import { AgentBadge, AgentAvatar, getAgentStyle } from "./agent-badge";
import { cn } from "@/lib/utils";

// ─── Relative time ───────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 5) return "ahora";
  if (diff < 60) return `${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(1);
  return `${secs}s`;
}

const AGENT_LABELS: Record<string, string> = {
  planner: "Orchestrator",
  coder: "Coder Agent",
  designer: "Designer Agent",
  debugger: "Debugger Agent",
  reviewer: "Reviewer Agent",
  deployer: "Deploy Agent",
  qa: "QA Agent",
  research: "Research Agent",
  analyst: "Analyst Agent",
  writer: "Writer Agent",
};

// ─── Thinking Indicator ──────────────────────────────────────────

const THINKING_MESSAGES = [
  "Analizando la estructura del proyecto...",
  "Diseñando los componentes...",
  "Planificando la implementación...",
  "Evaluando dependencias...",
  "Optimizando la arquitectura...",
  "Revisando mejores prácticas...",
  "Preparando los cambios...",
];

function ThinkingIndicator({ text }: { text?: string }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (text) return;
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
    <div className="flex items-start gap-3 px-4 py-3 bg-[#7c3aed]/5 border border-[#7c3aed]/10 rounded-lg mx-4 animate-fade-in">
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
        <p
          className={cn(
            "text-[11px] text-[#a78bfa] transition-opacity duration-200 truncate",
            fade ? "opacity-100" : "opacity-0"
          )}
        >
          {displayText}
        </p>
      </div>
    </div>
  );
}

// ─── Plan Step Row ───────────────────────────────────────────────

function PlanStepRow({
  step,
  index,
  total,
  activities,
  isLast,
}: {
  step: EnginePlanStep;
  index: number;
  total: number;
  activities: EngineActivity[];
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(step.status === "running");
  const isRunning = step.status === "running";
  const isDone = step.status === "completed";
  const isFailed = step.status === "failed";

  // Auto-expand running step
  useEffect(() => {
    if (isRunning) setExpanded(true);
  }, [isRunning]);

  // Activities for this task
  const taskActivities = useMemo(
    () => activities.filter((a) => a.taskId === step.taskId),
    [activities, step.taskId]
  );

  const fileChanges = taskActivities.filter((a) => a.type === "file_change");
  const terminalCmds = taskActivities.filter((a) => a.type === "terminal_cmd");
  const thinkingItems = taskActivities.filter((a) => a.type === "thinking");
  const hasDetails = fileChanges.length > 0 || terminalCmds.length > 0 || thinkingItems.length > 0;

  return (
    <div
      className="relative animate-fade-in-up"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Vertical line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[19px] top-[28px] bottom-0 w-px",
            isDone ? "bg-[#22c55e]/20" : isRunning ? "bg-[#7c3aed]/30" : "bg-[#1E1E1E]"
          )}
        />
      )}

      {/* Main step row */}
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={cn(
          "relative flex items-start gap-3 w-full text-left pl-3 pr-4 py-2.5 transition-colors rounded-lg",
          isRunning && "bg-[#7c3aed]/5 border-l-2 border-[#7c3aed]",
          hasDetails && "hover:bg-[#1A1A1A]/50 cursor-pointer",
          !hasDetails && "cursor-default"
        )}
      >
        {/* Status icon */}
        <div className="relative z-10 shrink-0 mt-0.5">
          {isDone ? (
            <CheckCircle2 className="h-5 w-5 text-[#22c55e]" />
          ) : isRunning ? (
            <Loader2 className="h-5 w-5 text-[#7c3aed] animate-spin" />
          ) : isFailed ? (
            <XCircle className="h-5 w-5 text-[#ef4444]" />
          ) : (
            <Circle className="h-5 w-5 text-[#4a4a5e]" />
          )}
        </div>

        {/* Step content */}
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-[13px] leading-snug",
              isDone ? "text-[#8888a0]" :
              isRunning ? "text-[#EDEDED] font-medium" :
              isFailed ? "text-[#ef4444]" :
              "text-[#4a4a5e]"
            )}
          >
            {step.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <AgentBadge agentType={step.agentType} size="sm" showLabel />
            <span className="text-[10px] text-[#555555]">·</span>
            <span
              className={cn(
                "text-[10px]",
                isDone ? "text-[#22c55e]" :
                isRunning ? "text-[#7c3aed]" :
                isFailed ? "text-[#ef4444]" :
                "text-[#555555]"
              )}
            >
              {isDone ? "Completado" : isRunning ? "En progreso" : isFailed ? "Error" : "Pendiente"}
            </span>
          </div>
        </div>

        {/* Right side: duration + expand */}
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {step.durationMs ? (
            <span className="text-[11px] text-[#555555] tabular-nums">
              {formatDuration(step.durationMs)}
            </span>
          ) : isRunning ? (
            <span className="text-[11px] text-[#555555]">--</span>
          ) : null}
          {hasDetails && (
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 text-[#555555] transition-transform duration-200",
                expanded && "rotate-90"
              )}
            />
          )}
        </div>
      </button>

      {/* Expanded detail items under the step */}
      {expanded && hasDetails && (
        <div className="ml-[30px] pl-4 border-l border-[#1E1E1E] space-y-0.5 pb-2 animate-fade-in">
          {fileChanges.map((a) => (
            <FileChangeRow key={a.id} activity={a} />
          ))}
          {terminalCmds.map((a) => (
            <TerminalRow key={a.id} activity={a} />
          ))}
          {thinkingItems.slice(-1).map((a) => (
            <ThinkingRow key={a.id} activity={a} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File Change Row ─────────────────────────────────────────────

function FileChangeRow({ activity }: { activity: EngineActivity }) {
  const [showDiff, setShowDiff] = useState(false);
  const action = (activity.content.action as string) || "edit";
  const filePath = (activity.content.path as string) || "";
  const diff = activity.content.diff as string | undefined;
  const fileName = filePath.split("/").pop() || "file";

  const config = {
    create: { Icon: FilePlus2, color: "text-[#22c55e]", badge: "bg-[#22c55e]/10 text-[#22c55e]", label: "nuevo" },
    edit: { Icon: FileEdit, color: "text-[#eab308]", badge: "bg-[#eab308]/10 text-[#eab308]", label: "modificado" },
    delete: { Icon: FileX2, color: "text-[#ef4444]", badge: "bg-[#ef4444]/10 text-[#ef4444]", label: "eliminado" },
  }[action] || { Icon: FileText, color: "text-[#8888a0]", badge: "bg-[#2A2A2A] text-[#8888a0]", label: action };

  return (
    <div className="animate-fade-in-up">
      <button
        onClick={() => diff && setShowDiff(!showDiff)}
        className={cn(
          "flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-md transition-colors",
          diff ? "hover:bg-[#1A1A1A]/50 cursor-pointer" : "cursor-default"
        )}
      >
        <config.Icon className={cn("h-3.5 w-3.5 shrink-0", config.color)} />
        <span className="text-[11px] text-[#EDEDED] font-mono truncate">{fileName}</span>
        <span className={cn("text-[9px] font-medium rounded-full px-1.5 py-0.5 shrink-0", config.badge)}>
          {config.label}
        </span>
        <span className="text-[10px] text-[#444444] ml-auto shrink-0">{relativeTime(activity.timestamp)}</span>
      </button>

      {showDiff && diff && (
        <div className="mx-2 mb-1 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] overflow-hidden animate-fade-in">
          <pre className="text-[10px] font-mono leading-relaxed p-3 overflow-x-auto max-h-[200px] overflow-y-auto">
            {diff.split("\n").map((line, i) => (
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

// ─── Terminal Row ────────────────────────────────────────────────

function TerminalRow({ activity }: { activity: EngineActivity }) {
  const [expanded, setExpanded] = useState(false);
  const output = (activity.content.output as string) || "";
  const command = (activity.content.command as string) || "";
  const lines = output.split("\n").filter(Boolean);
  const previewLines = lines.slice(-3);
  const hasMore = lines.length > 3;

  // If it's just output without a command prefix, show as output
  const displayCmd = command || (output.startsWith("$") ? output.split("\n")[0] : "");

  return (
    <div className="animate-fade-in-up">
      <button
        onClick={() => hasMore && setExpanded(!expanded)}
        className={cn(
          "flex items-start gap-2 w-full text-left py-1.5 px-2 rounded-md transition-colors",
          hasMore ? "hover:bg-[#1A1A1A]/50 cursor-pointer" : "cursor-default"
        )}
      >
        <Terminal className="h-3.5 w-3.5 text-[#eab308] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          {displayCmd && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#7c3aed] font-mono">$</span>
              <span className="text-[11px] text-[#EDEDED] font-mono truncate">{displayCmd.replace(/^\$\s*/, "")}</span>
            </div>
          )}
          {!expanded && previewLines.length > 0 && (
            <div className="mt-0.5 space-y-0">
              {previewLines.map((line, i) => (
                <p key={i} className="text-[10px] text-[#8888a0]/50 font-mono truncate">{line}</p>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-[#444444]">{relativeTime(activity.timestamp)}</span>
          {hasMore && (
            <ChevronDown className={cn("h-3 w-3 text-[#555555] transition-transform duration-200", expanded && "rotate-180")} />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mx-2 mb-1 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] overflow-hidden animate-fade-in">
          <pre className="text-[10px] font-mono leading-relaxed p-3 text-[#8888a0] overflow-x-auto max-h-[200px] overflow-y-auto">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Thinking Row ────────────────────────────────────────────────

function ThinkingRow({ activity }: { activity: EngineActivity }) {
  const message = (activity.content.message as string) || "";
  return (
    <div className="flex items-center gap-2 py-1 px-2 animate-fade-in">
      <Sparkles className="h-3 w-3 text-[#a78bfa] shrink-0" />
      <p className="text-[11px] text-[#a78bfa] italic truncate">&ldquo;{message}&rdquo;</p>
    </div>
  );
}

// ─── Agent Event Row ─────────────────────────────────────────────

function AgentEventRow({ activity }: { activity: EngineActivity }) {
  const agentType = (activity.content.agentType as string) || activity.agentType || "";
  const style = getAgentStyle(agentType);

  if (activity.type === "agent_spawn") {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2 animate-fade-in-up">
        <AgentAvatar agentType={agentType} size="sm" />
        <span className="text-[11px] text-[#8888a0]">
          <span className="font-medium" style={{ color: style.color }}>{style.label}</span> iniciado
        </span>
        <span className="text-[10px] text-[#444444] ml-auto">{relativeTime(activity.timestamp)}</span>
      </div>
    );
  }

  if (activity.type === "agent_complete") {
    const durationMs = activity.content.durationMs as number | undefined;
    const resultSummary = activity.content.resultSummary as { oneLiner?: string; metrics?: Array<{ label: string; value: string | number }> } | undefined;
    const [showResult, setShowResult] = useState(false);

    return (
      <div className="animate-fade-in-up">
        <button
          onClick={() => resultSummary && setShowResult(!showResult)}
          className={cn(
            "flex items-start gap-2.5 w-full text-left px-4 py-2 rounded-lg transition-colors",
            resultSummary ? "hover:bg-[#22c55e]/5 cursor-pointer" : "cursor-default"
          )}
        >
          <AgentAvatar agentType={agentType} size="sm" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-[#8888a0]">
              <span className="text-[#22c55e] font-medium">{style.label}</span> completó
              {durationMs ? ` en ${formatDuration(durationMs)}` : ""}
            </span>
            {/* Inline metrics */}
            {resultSummary?.metrics && resultSummary.metrics.length > 0 && (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {resultSummary.metrics.map((m, i) => (
                  <span key={i} className="text-[9px] text-[#8888a0] bg-[#1E1E1E] rounded-full px-1.5 py-0.5">
                    {m.value} {m.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <span className="text-[10px] text-[#444444] shrink-0">{relativeTime(activity.timestamp)}</span>
        </button>
        {/* Expanded result */}
        {showResult && resultSummary?.oneLiner && (
          <div className="mx-4 mb-2 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/10 p-3 animate-fade-in">
            <p className="text-[11px] text-[#EDEDED]">{resultSummary.oneLiner}</p>
          </div>
        )}
      </div>
    );
  }

  // Agent message
  if (activity.type === "agent_message") {
    const message = (activity.content.message as string) || "";
    return (
      <div className="flex items-start gap-2.5 px-4 py-2 animate-fade-in-up">
        <AgentAvatar agentType={agentType} size="sm" />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-medium" style={{ color: style.color }}>{style.label}</span>
          <p className="text-[11px] text-[#EDEDED] mt-0.5">{message}</p>
        </div>
        <span className="text-[10px] text-[#444444] shrink-0">{relativeTime(activity.timestamp)}</span>
      </div>
    );
  }

  return null;
}

// ─── Error Row ───────────────────────────────────────────────────

function ErrorRow({ activity }: { activity: EngineActivity }) {
  const [expanded, setExpanded] = useState(false);
  const message = (activity.content.message as string) || (activity.content.error as string) || "Unknown error";

  return (
    <div className="animate-fade-in-up">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-2.5 w-full text-left px-4 py-2 hover:bg-[#ef4444]/5 rounded-lg transition-colors cursor-pointer"
      >
        <AlertTriangle className="h-4 w-4 text-[#ef4444] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-[12px] text-[#ef4444] font-medium">Error</span>
          {!expanded && (
            <p className="text-[11px] text-[#8888a0] mt-0.5 truncate">{message}</p>
          )}
        </div>
        <span className="text-[10px] text-[#444444] shrink-0">{relativeTime(activity.timestamp)}</span>
      </button>
      {expanded && (
        <div className="mx-4 mb-2 rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/20 p-3 animate-fade-in">
          <p className="text-[11px] text-[#ef4444]/80 font-mono whitespace-pre-wrap break-all">{message}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN: Activity Feed
// ═══════════════════════════════════════════════════════════════════

export function ActivityFeed({ onClose }: { onClose: () => void }) {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const { activities, planSteps, progress, engineStatus, isRunning } = useEngineActivity(projectId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showDetailed, setShowDetailed] = useState(true);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities, planSteps]);

  // Refresh relative times
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Split non-task activities (global events)
  const globalActivities = useMemo(
    () => activities.filter((a) =>
      a.type === "agent_spawn" ||
      a.type === "agent_complete" ||
      a.type === "engine_started" ||
      a.type === "engine_completed" ||
      a.type === "engine_failed" ||
      (a.type === "error" && !a.taskId)
    ),
    [activities]
  );

  // Latest thinking message (not tied to a task)
  const latestThinking = useMemo(() => {
    const thinking = activities.filter((a) => a.type === "thinking" && !a.taskId);
    return thinking.length > 0 ? (thinking[thinking.length - 1].content.message as string) : undefined;
  }, [activities]);

  const fileCount = activities.filter((a) => a.type === "file_change").length;
  const terminalCount = activities.filter((a) => a.type === "terminal_cmd").length;

  return (
    <div className="flex h-full flex-col bg-[#0E0E0E] animate-slide-in-panel">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#7c3aed]" />
          <span className="text-[13px] font-semibold text-[#EDEDED]">Activity Feed</span>
          {isRunning && (
            <div className="h-2 w-2 rounded-full bg-[#22c55e] live-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDetailed(!showDetailed)}
            className="text-[10px] text-[#8888a0] hover:text-[#EDEDED] transition-colors px-2 py-1 rounded-md hover:bg-[#1A1A1A]"
          >
            {showDetailed ? "Ocultar detalle" : "Ver detalle"}
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-6 w-6 rounded-md text-[#8888a0] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
          >
            <span className="text-xs">×</span>
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-3 space-y-1">
        {/* Thinking indicator (global, when running without task-specific thinking) */}
        {isRunning && engineStatus === "planning" && (
          <div className="mb-3">
            <ThinkingIndicator text={latestThinking} />
          </div>
        )}

        {/* Plan header */}
        {planSteps.length > 0 && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2">
              <Brain className="h-3.5 w-3.5 text-[#7c3aed]" />
              <span className="text-[11px] font-semibold text-[#8888a0] uppercase tracking-wider">
                Plan de ejecución
              </span>
              {progress.total > 0 && (
                <span className="text-[10px] text-[#555555] ml-auto tabular-nums">
                  {progress.completed}/{progress.total}
                </span>
              )}
            </div>
            {/* Progress bar */}
            {progress.total > 0 && (
              <div className="mt-2 h-1 w-full rounded-full bg-[#2A2A2A] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#7c3aed] transition-all duration-500 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Parallel agents indicator */}
        {(() => {
          const runningSteps = planSteps.filter((s) => s.status === "running");
          if (runningSteps.length > 1) {
            return (
              <div className="mx-4 mb-2 p-2.5 rounded-lg bg-[#f59e0b]/5 border border-[#f59e0b]/10 animate-fade-in">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Zap className="h-3 w-3 text-[#f59e0b]" />
                  <span className="text-[10px] font-medium text-[#f59e0b]">
                    {runningSteps.length} agentes trabajando en paralelo
                  </span>
                </div>
                <div className="space-y-0.5 ml-1">
                  {runningSteps.map((step, i) => {
                    const agentStyle = getAgentStyle(step.agentType);
                    const isLast = i === runningSteps.length - 1;
                    return (
                      <div key={step.taskId || i} className="flex items-center gap-2">
                        <span className="text-[10px] text-[#4a4a5e]">{isLast ? "└─" : "├─"}</span>
                        <span className="text-[11px]">{agentStyle.icon}</span>
                        <span className="text-[10px] font-medium" style={{ color: agentStyle.color }}>
                          {agentStyle.label}:
                        </span>
                        <span className="text-[10px] text-[#8888a0] truncate">{step.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Plan steps timeline */}
        {planSteps.length > 0 && (
          <div className="px-1">
            {planSteps.map((step, i) => (
              <PlanStepRow
                key={step.taskId || i}
                step={step}
                index={i}
                total={planSteps.length}
                activities={showDetailed ? activities : []}
                isLast={i === planSteps.length - 1}
              />
            ))}
          </div>
        )}

        {/* Divider before global events */}
        {planSteps.length > 0 && globalActivities.length > 0 && showDetailed && (
          <div className="h-px bg-[#1E1E1E] mx-4 my-2" />
        )}

        {/* Global agent events */}
        {showDetailed && globalActivities.map((a) => {
          if (a.type === "agent_spawn" || a.type === "agent_complete") {
            return <AgentEventRow key={a.id} activity={a} />;
          }
          if (a.type === "error" || a.type === "engine_failed") {
            return <ErrorRow key={a.id} activity={a} />;
          }
          if (a.type === "engine_completed") {
            return (
              <div key={a.id} className="flex items-center gap-2.5 px-4 py-2 animate-fade-in-up">
                <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
                <span className="text-[12px] text-[#22c55e] font-medium">Engine completado</span>
                <span className="text-[10px] text-[#444444] ml-auto">{relativeTime(a.timestamp)}</span>
              </div>
            );
          }
          return null;
        })}

        {/* Engine status badges */}
        {engineStatus === "completed" && planSteps.length > 0 && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-[#22c55e]/5 border border-[#22c55e]/20 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
              <span className="text-[12px] text-[#22c55e] font-medium">Proyecto completado</span>
            </div>
            <p className="text-[11px] text-[#8888a0] mt-1">
              Todos los pasos del plan fueron ejecutados exitosamente.
            </p>
          </div>
        )}

        {engineStatus === "failed" && (
          <div className="mx-4 mt-3 p-3 rounded-lg bg-[#ef4444]/5 border border-[#ef4444]/20 animate-fade-in">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-[#ef4444]" />
              <span className="text-[12px] text-[#ef4444] font-medium">Engine falló</span>
            </div>
            <p className="text-[11px] text-[#8888a0] mt-1">
              Revisa los errores arriba para más detalles.
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isRunning && planSteps.length === 0 && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <Activity className="h-10 w-10 text-[#8888a0]/10 mb-4" />
            <p className="text-[13px] text-[#8888a0]/40 mb-1">Sin actividad</p>
            <p className="text-[11px] text-[#4a4a5e]">
              La actividad del engine aparecerá aquí cuando Arya comience a trabajar.
            </p>
          </div>
        )}
      </div>

      {/* Footer with summary */}
      {(planSteps.length > 0 || activities.length > 0) && (
        <div className="border-t border-[#2A2A2A] px-4 py-2 flex items-center gap-3 shrink-0">
          {fileCount > 0 && (
            <span className="text-[10px] text-[#8888a0] flex items-center gap-1">
              <FileText className="h-3 w-3" /> {fileCount} archivos
            </span>
          )}
          {terminalCount > 0 && (
            <span className="text-[10px] text-[#8888a0] flex items-center gap-1">
              <Terminal className="h-3 w-3" /> {terminalCount} comandos
            </span>
          )}
          {isRunning && (
            <span className="text-[10px] text-[#22c55e] flex items-center gap-1 ml-auto">
              <Clock className="h-3 w-3" /> En ejecución
            </span>
          )}
          {!isRunning && progress.total > 0 && (
            <span className="text-[10px] text-[#8888a0] ml-auto tabular-nums">
              {progress.completed}/{progress.total} pasos
            </span>
          )}
        </div>
      )}
    </div>
  );
}
