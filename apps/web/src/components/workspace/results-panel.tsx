"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  FileText,
  BarChart3,
  Shield,
  Rocket,
} from "lucide-react";
import type { EnginePlanStep, ResultSummary } from "@/hooks/useEngineActivity";
import { AgentAvatar, AgentBadge, getAgentStyle } from "./agent-badge";
import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════════
// RESULTS PANEL — Shows each agent's results in readable format
// ══════════════════════════════════════════════════════════════════

interface ResultsPanelProps {
  planSteps: EnginePlanStep[];
}

export function ResultsPanel({ planSteps }: ResultsPanelProps) {
  const completedSteps = useMemo(
    () => planSteps.filter((s) => s.status === "completed" || s.status === "failed"),
    [planSteps]
  );

  if (completedSteps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <BarChart3 className="h-10 w-10 text-[#8888a0]/10 mb-4" />
        <p className="text-[13px] text-[#8888a0]/40 mb-1">Sin resultados</p>
        <p className="text-[11px] text-[#4a4a5e]">
          Los resultados de cada agente aparecerán aquí cuando completen sus tareas.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* Summary header */}
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-4 w-4 text-[#7c3aed]" />
        <span className="text-[13px] font-semibold text-[#EDEDED]">Resultados</span>
        <span className="text-[10px] text-[#8888a0] ml-auto">
          {completedSteps.filter((s) => s.status === "completed").length} de {planSteps.length} completados
        </span>
      </div>

      {/* Result cards */}
      {completedSteps.map((step) => (
        <ResultCard key={step.taskId || step.title} step={step} />
      ))}
    </div>
  );
}

// ── Result Card ──────────────────────────────────────────────────

function ResultCard({ step }: { step: EnginePlanStep }) {
  const [expanded, setExpanded] = useState(false);
  const style = getAgentStyle(step.agentType);
  const isDone = step.status === "completed";
  const isFailed = step.status === "failed";
  const summary = step.resultSummary;

  return (
    <div
      className={cn(
        "rounded-xl border bg-[#0E0E0E] overflow-hidden transition-colors",
        isDone ? "border-[#1E1E1E]" : "border-[#ef4444]/20"
      )}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full text-left p-3 hover:bg-[#111111] transition-colors"
      >
        <AgentAvatar agentType={step.agentType} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-[#EDEDED] truncate">
              {step.title}
            </span>
            {isDone ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e] shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-[#ef4444] shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px]" style={{ color: style.color }}>
              {style.label}
            </span>
            {step.durationMs && (
              <>
                <span className="text-[10px] text-[#4a4a5e]">·</span>
                <span className="text-[10px] text-[#8888a0] tabular-nums">
                  {step.durationMs < 1000
                    ? `${step.durationMs}ms`
                    : `${(step.durationMs / 1000).toFixed(1)}s`}
                </span>
              </>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-[#555555] transition-transform duration-200 shrink-0",
            expanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[#1E1E1E] p-3 animate-fade-in">
          {/* Result summary */}
          {summary ? (
            <div className="space-y-2.5">
              {/* One-liner */}
              <p className="text-[12px] text-[#EDEDED] leading-relaxed">
                {summary.oneLiner}
              </p>

              {/* Metrics badges */}
              {summary.metrics && summary.metrics.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {summary.metrics.map((m, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 bg-[#1E1E1E] text-[#EDEDED]"
                    >
                      <span className="text-[#7c3aed]">{m.value}</span>
                      <span className="text-[#8888a0]">{m.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Type-specific rendering */}
              <ResultTypeContent type={summary.type} step={step} />
            </div>
          ) : isFailed ? (
            <p className="text-[11px] text-[#ef4444]">
              La tarea falló. Revisa los logs de actividad para más detalles.
            </p>
          ) : (
            <p className="text-[11px] text-[#8888a0]">
              Sin datos de resultado detallados disponibles.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Type-specific result content ─────────────────────────────────

function ResultTypeContent({ type, step }: { type: string; step: EnginePlanStep }) {
  const typeConfig: Record<string, { icon: React.ReactNode; label: string; description: string }> = {
    research: { icon: <FileText className="h-3 w-3" />, label: "Reporte de investigación", description: "Hallazgos, recomendaciones y fuentes recopilados durante la investigación." },
    code: { icon: <FileText className="h-3 w-3" />, label: "Resultado de código", description: "Archivos creados y modificados, dependencias instaladas." },
    design: { icon: <FileText className="h-3 w-3" />, label: "Especificaciones de diseño", description: "Decisiones de diseño, componentes y estilos definidos." },
    analysis: { icon: <BarChart3 className="h-3 w-3" />, label: "Análisis de datos", description: "Insights, métricas y visualizaciones generados." },
    content: { icon: <FileText className="h-3 w-3" />, label: "Contenido generado", description: "Textos, documentos y archivos de contenido creados." },
    deploy: { icon: <Rocket className="h-3 w-3" />, label: "Resultado de despliegue", description: "Configuración y estado del despliegue." },
    qa: { icon: <Shield className="h-3 w-3" />, label: "Reporte de calidad", description: "Issues encontrados, score de calidad y fixes aplicados." },
  };

  const config = typeConfig[type];
  if (!config) return null;

  return (
    <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[#1E1E1E]">
      <span className="text-[#8888a0]">{config.icon}</span>
      <span className="text-[10px] text-[#8888a0]">{config.description}</span>
    </div>
  );
}
