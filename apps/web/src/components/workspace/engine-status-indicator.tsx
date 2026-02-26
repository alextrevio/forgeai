"use client";

import { useState, useEffect } from "react";
import { Brain, Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import type { EngineStatus, EngineProgress } from "@/hooks/useEngineActivity";
import { cn } from "@/lib/utils";

interface EngineStatusIndicatorProps {
  engineStatus: EngineStatus;
  progress: EngineProgress;
  isRunning: boolean;
  onRetry?: () => void;
}

export function EngineStatusIndicator({
  engineStatus,
  progress,
  isRunning,
  onRetry,
}: EngineStatusIndicatorProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  // Auto-hide "completed" after 5 seconds
  useEffect(() => {
    if (engineStatus === "completed") {
      setShowCompleted(true);
      const timer = setTimeout(() => setShowCompleted(false), 5000);
      return () => clearTimeout(timer);
    }
    setShowCompleted(false);
  }, [engineStatus]);

  if (engineStatus === "idle" || (engineStatus === "completed" && !showCompleted)) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 animate-fade-in">
      {engineStatus === "planning" && (
        <div className="flex items-center gap-1.5 rounded-lg bg-[#7c3aed]/10 px-2.5 py-1">
          <Brain className="h-3 w-3 text-[#a78bfa] animate-thinking-pulse" />
          <span className="text-[11px] font-medium text-[#a78bfa]">Planificando...</span>
        </div>
      )}

      {engineStatus === "running" && (
        <div className="flex items-center gap-1.5 rounded-lg bg-[#7c3aed]/10 px-2.5 py-1">
          <Loader2 className="h-3 w-3 text-[#a78bfa] animate-spin" />
          <span className="text-[11px] font-medium text-[#a78bfa]">
            Ejecutando
            {progress.total > 0 && (
              <span className="text-[#a78bfa]/70 ml-1">
                ({progress.completed}/{progress.total})
              </span>
            )}
          </span>
        </div>
      )}

      {engineStatus === "paused" && (
        <div className="flex items-center gap-1.5 rounded-lg bg-[#eab308]/10 px-2.5 py-1">
          <span className="h-2 w-2 rounded-full bg-[#eab308]" />
          <span className="text-[11px] font-medium text-[#eab308]">Pausado</span>
        </div>
      )}

      {engineStatus === "completed" && showCompleted && (
        <div className="flex items-center gap-1.5 rounded-lg bg-[#22c55e]/10 px-2.5 py-1">
          <CheckCircle2 className="h-3 w-3 text-[#22c55e]" />
          <span className="text-[11px] font-medium text-[#22c55e]">Completado</span>
        </div>
      )}

      {engineStatus === "failed" && (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 rounded-lg bg-[#ef4444]/10 px-2.5 py-1">
            <XCircle className="h-3 w-3 text-[#ef4444]" />
            <span className="text-[11px] font-medium text-[#ef4444]">Error</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 rounded-lg bg-[#1A1A1A] px-2 py-1 text-[11px] text-[#8888a0] hover:text-[#EDEDED] hover:bg-[#2A2A2A] transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reintentar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
