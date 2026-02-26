"use client";

import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import type { EnginePlanStep, EngineProgress } from "@/hooks/useEngineActivity";
import { cn } from "@/lib/utils";

const AGENT_BADGES: Record<string, { label: string; color: string }> = {
  planner: { label: "Planner", color: "bg-[#7c3aed]/10 text-[#a78bfa]" },
  coder: { label: "Coder", color: "bg-[#3b82f6]/10 text-[#60a5fa]" },
  designer: { label: "Designer", color: "bg-[#ec4899]/10 text-[#f472b6]" },
  debugger: { label: "Debugger", color: "bg-[#f59e0b]/10 text-[#fbbf24]" },
  reviewer: { label: "Reviewer", color: "bg-[#8b5cf6]/10 text-[#a78bfa]" },
  deployer: { label: "Deploy", color: "bg-[#22c55e]/10 text-[#4ade80]" },
  qa: { label: "QA", color: "bg-[#06b6d4]/10 text-[#22d3ee]" },
  research: { label: "Research", color: "bg-[#6366f1]/10 text-[#818cf8]" },
  analyst: { label: "Analyst", color: "bg-[#14b8a6]/10 text-[#2dd4bf]" },
  writer: { label: "Writer", color: "bg-[#f97316]/10 text-[#fb923c]" },
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface PlanOverviewProps {
  planSteps: EnginePlanStep[];
  progress: EngineProgress;
  isRunning: boolean;
}

export function PlanOverview({ planSteps, progress, isRunning }: PlanOverviewProps) {
  if (planSteps.length === 0) return null;

  return (
    <div className="border border-[#1E1E1E] rounded-xl bg-[#0E0E0E] p-4 mx-4 mt-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className={cn("w-4 h-4 text-[#7c3aed]", isRunning && "animate-sparkle-pulse")} />
        <span className="text-sm font-medium text-[#EDEDED]">Plan de ejecución</span>
        <span className="text-xs text-[#555555] ml-auto tabular-nums">
          {progress.completed}/{progress.total} completados
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-[#1E1E1E] overflow-hidden mb-3">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            isRunning
              ? "bg-gradient-to-r from-[#7c3aed] to-[#a78bfa]"
              : "bg-[#7c3aed]/50"
          )}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-1.5">
        {planSteps.map((step, i) => {
          const isStepRunning = step.status === "running";
          const isDone = step.status === "completed";
          const isFailed = step.status === "failed";
          const badge = AGENT_BADGES[step.agentType] || { label: step.agentType, color: "bg-[#2A2A2A] text-[#8888a0]" };

          return (
            <div
              key={step.taskId || i}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors",
                isStepRunning && "bg-[#7c3aed]/5 border border-[#7c3aed]/15",
              )}
            >
              {/* Status icon */}
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 text-[#22c55e] shrink-0" />
              ) : isStepRunning ? (
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
                  isStepRunning ? "text-[13px] font-medium text-[#EDEDED]" :
                  isDone ? "text-[12px] text-[#8888a0]" :
                  isFailed ? "text-[12px] text-[#ef4444]" :
                  "text-[12px] text-[#555555]"
                )}
              >
                {step.title}
              </span>

              {/* Agent badge */}
              <span className={cn("text-[9px] font-medium rounded-full px-2 py-0.5 shrink-0", badge.color)}>
                {badge.label}
              </span>

              {/* Duration */}
              {step.durationMs ? (
                <span className="text-[10px] text-[#555555] tabular-nums shrink-0 w-10 text-right">
                  {formatDuration(step.durationMs)}
                </span>
              ) : isStepRunning ? (
                <span className="text-[10px] text-[#555555] shrink-0 w-10 text-right">--</span>
              ) : (
                <span className="w-10 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
