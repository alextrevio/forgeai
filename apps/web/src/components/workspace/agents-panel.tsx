"use client";

import { useMemo } from "react";
import { Loader2, CheckCircle2, Clock, Zap } from "lucide-react";
import type { EnginePlanStep } from "@/hooks/useEngineActivity";
import { AgentAvatar, getAgentStyle } from "./agent-badge";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════════
// AGENTS PANEL — Shows active/waiting/completed agents
// ══════════════════════════════════════════════════════════════════

interface AgentsPanelProps {
  planSteps: EnginePlanStep[];
  isRunning: boolean;
}

export function AgentsPanel({ planSteps, isRunning }: AgentsPanelProps) {
  const runningSteps = useMemo(
    () => planSteps.filter((s) => s.status === "running"),
    [planSteps]
  );
  const pendingSteps = useMemo(
    () => planSteps.filter((s) => s.status === "pending"),
    [planSteps]
  );
  const completedSteps = useMemo(
    () => planSteps.filter((s) => s.status === "completed"),
    [planSteps]
  );

  if (planSteps.length === 0) return null;

  const activeCount = runningSteps.length;

  return (
    <div className="border border-[#1E1E1E] rounded-xl bg-[#0E0E0E] p-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <Zap className="h-3.5 w-3.5 text-[#7c3aed]" />
        <span className="text-[11px] font-semibold text-[#EDEDED]">
          Agentes activos{activeCount > 0 ? ` (${activeCount})` : ""}
        </span>
        {isRunning && activeCount > 1 && (
          <span className="text-[9px] text-[#a78bfa] bg-[#7c3aed]/10 rounded-full px-1.5 py-0.5 ml-auto">
            ⚡ Paralelo
          </span>
        )}
      </div>

      {/* Agent list */}
      <div className="space-y-1">
        {/* Running agents */}
        {runningSteps.map((step) => (
          <AgentRow key={step.taskId || step.title} step={step} status="running" />
        ))}

        {/* Pending agents */}
        {pendingSteps.map((step) => {
          // Find what this step is waiting on
          const waitingOn = step.dependsOn
            ?.map((depOrder) => planSteps.find((s) => s.order === depOrder))
            .filter((s): s is EnginePlanStep => !!s && s.status !== "completed")
            .map((s) => getAgentStyle(s.agentType).label)
            .join(", ");

          return (
            <AgentRow
              key={step.taskId || step.title}
              step={step}
              status="pending"
              waitingOn={waitingOn}
            />
          );
        })}

        {/* Completed agents (collapsed, showing only count) */}
        {completedSteps.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 mt-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />
            <span className="text-[10px] text-[#8888a0]">
              {completedSteps.length} agente{completedSteps.length !== 1 ? "s" : ""} completado{completedSteps.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Individual Agent Row ──────────────────────────────────────────

function AgentRow({
  step,
  status,
  waitingOn,
}: {
  step: EnginePlanStep;
  status: "running" | "pending";
  waitingOn?: string;
}) {
  const style = getAgentStyle(step.agentType);
  const isRunning = status === "running";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors",
        isRunning && "bg-[#111111] border border-[#1E1E1E]",
      )}
    >
      <AgentAvatar agentType={step.agentType} size="sm" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-[11px] font-medium truncate",
              isRunning ? "text-[#EDEDED]" : "text-[#555555]"
            )}
          >
            {style.label}
          </span>
        </div>
        <p
          className={cn(
            "text-[10px] truncate",
            isRunning ? "text-[#8888a0]" : "text-[#4a4a5e]"
          )}
        >
          {isRunning
            ? step.title
            : waitingOn
              ? `Esperando ${waitingOn}`
              : "En cola"
          }
        </p>
      </div>

      {/* Status indicator */}
      <div className="shrink-0">
        {isRunning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: style.color }} />
        ) : (
          <Clock className="h-3.5 w-3.5 text-[#4a4a5e]" />
        )}
      </div>
    </div>
  );
}
