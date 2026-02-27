"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Sparkles,
  Zap,
} from "lucide-react";
import type { EnginePlanStep, EngineProgress } from "@/hooks/useEngineActivity";
import { AgentBadge, getAgentStyle } from "./agent-badge";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const COMPLEXITY_DISPLAY: Record<string, { emoji: string; color: string; label: string }> = {
  low:    { emoji: "🟢", color: "text-[#22c55e]", label: "Complejidad baja" },
  medium: { emoji: "🟡", color: "text-[#f59e0b]", label: "Complejidad media" },
  high:   { emoji: "🔴", color: "text-[#ef4444]", label: "Complejidad alta" },
};

// ══════════════════════════════════════════════════════════════════
// PLAN OVERVIEW — Enhanced with agent badges & parallel indicators
// ══════════════════════════════════════════════════════════════════

interface PlanOverviewProps {
  planSteps: EnginePlanStep[];
  progress: EngineProgress;
  isRunning: boolean;
  complexity?: string;
  estimatedTime?: string;
}

export function PlanOverview({
  planSteps,
  progress,
  isRunning,
  complexity,
  estimatedTime,
}: PlanOverviewProps) {
  if (planSteps.length === 0) return null;

  // Detect parallel groups: steps with same set of dependencies run in parallel
  const parallelGroups = useMemo(() => {
    const groups: Array<{ steps: EnginePlanStep[]; isParallel: boolean }> = [];
    const visited = new Set<number>();

    // Group steps by their dependsOn signature
    const byDeps = new Map<string, EnginePlanStep[]>();
    for (const step of planSteps) {
      const key = (step.dependsOn || []).sort().join(",");
      if (!byDeps.has(key)) byDeps.set(key, []);
      byDeps.get(key)!.push(step);
    }

    // Walk in order, grouping parallel steps
    for (const step of planSteps) {
      const order = step.order ?? 0;
      if (visited.has(order)) continue;

      const key = (step.dependsOn || []).sort().join(",");
      const siblings = byDeps.get(key) || [step];

      if (siblings.length > 1) {
        groups.push({ steps: siblings, isParallel: true });
        for (const s of siblings) visited.add(s.order ?? 0);
      } else {
        groups.push({ steps: [step], isParallel: false });
        visited.add(order);
      }
    }

    return groups;
  }, [planSteps]);

  const complexityInfo = COMPLEXITY_DISPLAY[complexity || ""] || null;

  return (
    <div className="border border-[#1E1E1E] rounded-xl bg-[#0E0E0E] p-4 mx-4 mt-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className={cn("w-4 h-4 text-[#7c3aed]", isRunning && "animate-sparkle-pulse")} />
        <span className="text-sm font-medium text-[#EDEDED]">Plan de ejecución</span>
        <span className="text-xs text-[#555555] ml-auto tabular-nums">
          {progress.completed}/{progress.total} completados
        </span>
      </div>

      {/* Complexity & estimated time */}
      {(complexityInfo || estimatedTime) && (
        <div className="flex items-center gap-2 mb-2.5 ml-6">
          {complexityInfo && (
            <span className={cn("text-[10px]", complexityInfo.color)}>
              {complexityInfo.emoji} {complexityInfo.label}
            </span>
          )}
          {complexityInfo && estimatedTime && (
            <span className="text-[10px] text-[#4a4a5e]">·</span>
          )}
          {estimatedTime && (
            <span className="text-[10px] text-[#8888a0]">
              ~{estimatedTime} estimados
            </span>
          )}
        </div>
      )}

      {/* Progress bar with percentage */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 rounded-full bg-[#1E1E1E] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              isRunning
                ? "bg-gradient-to-r from-[#7c3aed] to-[#a78bfa]"
                : progress.percentage === 100
                  ? "bg-[#22c55e]"
                  : "bg-[#7c3aed]/50"
            )}
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
        <span className="text-[10px] text-[#8888a0] tabular-nums shrink-0 w-8 text-right">
          {progress.percentage}%
        </span>
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {parallelGroups.map((group, gi) => {
          if (group.isParallel) {
            // Parallel group header + steps
            const anyRunning = group.steps.some((s) => s.status === "running");
            return (
              <div key={`g-${gi}`} className="space-y-1">
                {/* Parallel indicator */}
                <div className="flex items-center gap-1.5 px-2.5 py-1">
                  <Zap className={cn("h-3 w-3", anyRunning ? "text-[#f59e0b]" : "text-[#4a4a5e]")} />
                  <span className={cn("text-[9px] font-medium uppercase tracking-wider", anyRunning ? "text-[#f59e0b]" : "text-[#4a4a5e]")}>
                    {group.steps.length} agentes en paralelo
                  </span>
                </div>
                {/* Parallel steps with connector */}
                <div className="ml-2 border-l-2 border-dashed border-[#2A2A2A] pl-1 space-y-1">
                  {group.steps.map((step, i) => (
                    <StepRow key={step.taskId || `${gi}-${i}`} step={step} />
                  ))}
                </div>
              </div>
            );
          }

          // Single step
          const step = group.steps[0];
          return <StepRow key={step.taskId || `${gi}-0`} step={step} />;
        })}
      </div>
    </div>
  );
}

// ── Step Row ─────────────────────────────────────────────────────

function StepRow({ step }: { step: EnginePlanStep }) {
  const isRunning = step.status === "running";
  const isDone = step.status === "completed";
  const isFailed = step.status === "failed";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors",
        isRunning && "bg-[#7c3aed]/5 border border-[#7c3aed]/15",
      )}
    >
      {/* Status icon */}
      {isDone ? (
        <CheckCircle2 className="h-4 w-4 text-[#22c55e] shrink-0" />
      ) : isRunning ? (
        <Loader2 className="h-4 w-4 text-[#7c3aed] animate-spin shrink-0" />
      ) : isFailed ? (
        <XCircle className="h-4 w-4 text-[#ef4444] shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-[#4a4a5e] shrink-0" />
      )}

      {/* Title */}
      <span
        className={cn(
          "flex-1 min-w-0 truncate",
          isRunning ? "text-[13px] font-medium text-[#EDEDED]" :
          isDone ? "text-[12px] text-[#8888a0]" :
          isFailed ? "text-[12px] text-[#ef4444]" :
          "text-[12px] text-[#555555]"
        )}
      >
        {step.title}
      </span>

      {/* Agent badge */}
      <AgentBadge agentType={step.agentType} size="sm" />

      {/* Duration */}
      {step.durationMs ? (
        <span className="text-[10px] text-[#555555] tabular-nums shrink-0 w-10 text-right">
          {formatDuration(step.durationMs)}
        </span>
      ) : isRunning ? (
        <span className="text-[10px] text-[#555555] shrink-0 w-10 text-right">--</span>
      ) : (
        <span className="w-10 shrink-0" />
      )}
    </div>
  );
}
