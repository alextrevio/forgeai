"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelGroupHandle } from "react-resizable-panels";
import { Activity } from "lucide-react";
import { ChatPanel } from "./chat-panel";
import { ComputerPanel } from "./computer-panel";
import { AgentActivityPanel } from "./agent-activity-panel";
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";

function safeArray<T>(data: T[]): T[];
function safeArray<T>(data: T[] | null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

export function WorkspaceLayout() {
  const [isVertical, setIsVertical] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const {
    isAgentRunning,
    currentPlan,
    activeAgent,
    activityItems,
  } = useProjectStore();

  const activityCount = safeArray(activityItems).length;

  useEffect(() => {
    const checkWidth = () => setIsVertical(window.innerWidth < 1024);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Cmd+K → focus chat input
      if (mod && e.key === "k") {
        e.preventDefault();
        const el = document.querySelector<HTMLTextAreaElement>("[data-chat-input]");
        el?.focus();
      }
      // Cmd+Enter → submit chat message (when input focused)
      if (mod && e.key === "Enter") {
        const el = document.querySelector<HTMLButtonElement>("[data-chat-send]");
        el?.click();
      }
      // Esc → close any open modal
      if (e.key === "Escape") {
        const modals = document.querySelectorAll("[data-modal-close]");
        if (modals.length > 0) {
          (modals[modals.length - 1] as HTMLButtonElement).click();
        }
      }
    };
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, []);

  // Compute progress for the bottom bar
  const { stepsTotal, stepsCompleted, currentStepText, progressPercent } = (() => {
    if (!currentPlan?.steps?.length) return { stepsTotal: 0, stepsCompleted: 0, currentStepText: "", progressPercent: 0 };
    const steps = safeArray(currentPlan.steps);
    const total = steps.length;
    const completed = steps.filter((s: { status: string }) => s.status === "completed").length;
    const inProgress = steps.find((s: { status: string }) => s.status === "in_progress");
    return {
      stepsTotal: total,
      stepsCompleted: completed,
      currentStepText: inProgress?.description || "",
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  })();

  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);

  const handleDoubleClickHandle = useCallback(() => {
    panelGroupRef.current?.setLayout([50, 50]);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#0A0A0A]">
      {/* Main 2-column layout */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup
          ref={panelGroupRef}
          direction={isVertical ? "vertical" : "horizontal"}
          className="h-full"
        >
          {/* Left Column — Chat + Activity */}
          <Panel
            defaultSize={isVertical ? 40 : 40}
            minSize={isVertical ? 25 : 25}
            maxSize={isVertical ? 60 : 55}
          >
            <div className="relative h-full">
              <ChatPanel />
              {/* Activity panel overlay */}
              {showActivity && (
                <div className="absolute inset-0 z-30">
                  <AgentActivityPanel onClose={() => setShowActivity(false)} />
                </div>
              )}
            </div>
          </Panel>

          {/* Resize Handle — 2px, subtle, hover visible */}
          <PanelResizeHandle
            className={cn(
              "group relative transition-colors",
              isVertical ? "h-[4px]" : "w-[4px]"
            )}
            onDoubleClick={handleDoubleClickHandle}
          >
            <div
              className={cn(
                "absolute bg-[#2A2A2A] group-hover:bg-[#555555] group-active:bg-[#7c3aed] transition-colors duration-200",
                isVertical
                  ? "inset-x-0 h-[2px] top-1/2 -translate-y-1/2"
                  : "inset-y-0 w-[2px] left-1/2 -translate-x-1/2"
              )}
            />
          </PanelResizeHandle>

          {/* Right Column — Computer */}
          <Panel
            defaultSize={isVertical ? 60 : 60}
            minSize={isVertical ? 35 : 35}
          >
            <ComputerPanel />
          </Panel>
        </PanelGroup>
      </div>

      {/* Bottom Bar — progress */}
      <div className="flex items-center gap-3 border-t border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2">
        {/* Activity toggle */}
        <button
          onClick={() => setShowActivity((v) => !v)}
          className={cn(
            "relative flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all duration-200 shrink-0",
            showActivity
              ? "bg-[#7c3aed]/10 text-[#a78bfa]"
              : "text-[#8888a0] hover:text-[#EDEDED] hover:bg-[#1A1A1A]"
          )}
          title="Ver actividad detallada"
        >
          <Activity className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{showActivity ? "Ocultar" : "Actividad"}</span>
          {activityCount > 0 && !showActivity && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#7c3aed] text-[9px] font-bold text-white px-1">
              {activityCount > 99 ? "99+" : activityCount}
            </span>
          )}
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {isAgentRunning ? (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#22c55e] live-pulse" />
              <span className="text-[11px] text-[#22c55e] font-medium">en vivo</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#4a4a5e]" />
              <span className="text-[11px] text-[#8888a0]">inactivo</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
          {isAgentRunning && stepsTotal > 0 ? (
            <div
              className="h-full rounded-full progress-bar-gradient transition-all duration-700 ease-out shimmer-bar"
              style={{ width: `${progressPercent}%` }}
            />
          ) : isAgentRunning ? (
            <div className="h-full w-1/3 rounded-full progress-bar-gradient animate-pulse" />
          ) : (
            <div
              className="h-full rounded-full bg-[#7c3aed]/30 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          )}
        </div>

        {/* Step info */}
        <div className="flex items-center gap-2 shrink-0 min-w-0 max-w-[300px]">
          {stepsTotal > 0 && (
            <>
              <span className="text-[10px] text-[#8888a0] tabular-nums shrink-0">
                {stepsCompleted} / {stepsTotal}
              </span>
              {currentStepText && (
                <span className="text-[11px] text-[#a78bfa] truncate">
                  {currentStepText}
                </span>
              )}
            </>
          )}
          {isAgentRunning && !currentStepText && activeAgent && (
            <span className="text-[11px] text-[#a78bfa] capitalize">{activeAgent === "planner" ? "Pensando" : activeAgent === "coder" ? "Codificando" : activeAgent}</span>
          )}
        </div>
      </div>
    </div>
  );
}
