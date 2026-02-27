"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { api } from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────

export type EngineStatus = "idle" | "planning" | "running" | "paused" | "completed" | "failed";

export interface EnginePlanStep {
  title: string;
  description: string;
  agentType: string;
  status: "pending" | "running" | "completed" | "failed";
  taskId?: string;
  durationMs?: number;
}

export type EngineActivityType =
  | "thinking"
  | "plan_step"
  | "file_change"
  | "terminal_cmd"
  | "agent_spawn"
  | "agent_complete"
  | "agent_message"
  | "error"
  | "engine_started"
  | "engine_completed"
  | "engine_failed"
  | "task_started"
  | "task_completed"
  | "task_failed";

export interface EngineActivity {
  id: string;
  type: EngineActivityType;
  timestamp: number;
  taskId?: string;
  agentType?: string;
  content: Record<string, unknown>;
}

export interface EngineProgress {
  completed: number;
  total: number;
  percentage: number;
}

// ── Hook ────────────────────────────────────────────────────────

export function useEngineActivity(projectId: string | null) {
  const [activities, setActivities] = useState<EngineActivity[]>([]);
  const [planSteps, setPlanSteps] = useState<EnginePlanStep[]>([]);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("idle");
  const [progress, setProgress] = useState<EngineProgress>({ completed: 0, total: 0, percentage: 0 });
  const idCounter = useRef(0);

  const makeId = useCallback(() => {
    idCounter.current += 1;
    return `ea-${Date.now()}-${idCounter.current}`;
  }, []);

  const addActivity = useCallback((type: EngineActivityType, content: Record<string, unknown>, taskId?: string, agentType?: string) => {
    setActivities((prev) => [
      ...prev.slice(-200), // keep last 200
      { id: makeId(), type, timestamp: Date.now(), taskId, agentType, content },
    ]);
  }, [makeId]);

  // Fetch initial status from API
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const status = await api.getEngineStatus(projectId);
        if (cancelled) return;

        setEngineStatus(status.engineStatus || "idle");

        if (status.tasks && Array.isArray(status.tasks)) {
          const steps: EnginePlanStep[] = status.tasks.map((t: Record<string, unknown>) => ({
            title: (t.title as string) || "",
            description: (t.description as string) || (t.title as string) || "",
            agentType: (t.agentType as string) || "coder",
            status: mapTaskStatus(t.status as string),
            taskId: t.id as string,
            durationMs: t.durationMs as number | undefined,
          }));
          setPlanSteps(steps);
        }

        if (status.progress) {
          setProgress(status.progress);
        }
      } catch {
        // Project may not have engine data yet
      }
    })();

    return () => { cancelled = true; };
  }, [projectId]);

  // Fetch activity history
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const data = await api.getEngineActivity(projectId);
        if (cancelled || !data.logs) return;

        const mapped: EngineActivity[] = (data.logs as Array<Record<string, unknown>>).map((log) => ({
          id: (log.id as string) || makeId(),
          type: (log.type as EngineActivityType) || "thinking",
          timestamp: new Date(log.timestamp as string).getTime(),
          taskId: log.taskId as string | undefined,
          agentType: log.agentType as string | undefined,
          content: (log.content as Record<string, unknown>) || {},
        }));

        setActivities(mapped);
      } catch {
        // No activity history yet
      }
    })();

    return () => { cancelled = true; };
  }, [projectId, makeId]);

  // Subscribe to WebSocket events — single "event" listener
  useEffect(() => {
    if (!projectId) return;
    const socket = getSocket();

    const onEvent = (raw: unknown) => {
      const event = raw as { type: string; data: Record<string, unknown> };
      if (!event?.type || !event.type.startsWith("engine:")) return;

      const data = event.data || {};

      switch (event.type) {
        case "engine:started":
          setEngineStatus("planning");
          addActivity("engine_started", data);
          break;

        case "engine:completed":
          setEngineStatus("completed");
          addActivity("engine_completed", data);
          break;

        case "engine:failed":
          setEngineStatus("failed");
          addActivity("engine_failed", data);
          break;

        case "engine:status_change":
          setEngineStatus((data.status as EngineStatus) || "idle");
          break;

        case "engine:plan_update": {
          // Backend sends { planSteps, tasks, analysis }
          // Map planSteps with taskIds from tasks array
          const steps = data.planSteps as Array<Record<string, unknown>> | undefined;
          const tasks = data.tasks as Array<Record<string, unknown>> | undefined;
          if (steps) {
            setPlanSteps(steps.map((s, idx) => ({
              title: (s.title as string) || "",
              description: (s.description as string) || "",
              agentType: (s.agentType as string) || "coder",
              status: "pending" as const,
              taskId: tasks?.[idx]?.id as string | undefined,
            })));
            setProgress({ completed: 0, total: steps.length, percentage: 0 });
          }
          break;
        }

        case "engine:task:started": {
          const taskId = data.taskId as string;
          setPlanSteps((prev) => prev.map((s) =>
            s.taskId === taskId ? { ...s, status: "running" as const } : s
          ));
          setEngineStatus("running");
          addActivity("task_started", data, taskId, data.agentType as string);
          break;
        }

        case "engine:task:completed": {
          const taskId = data.taskId as string;
          setPlanSteps((prev) => {
            const updated = prev.map((s) =>
              s.taskId === taskId ? { ...s, status: "completed" as const } : s
            );
            const completed = updated.filter((s) => s.status === "completed").length;
            setProgress({ completed, total: updated.length, percentage: updated.length > 0 ? Math.round((completed / updated.length) * 100) : 0 });
            return updated;
          });
          addActivity("task_completed", data, taskId);
          break;
        }

        case "engine:task:failed": {
          const taskId = data.taskId as string;
          setPlanSteps((prev) => prev.map((s) =>
            s.taskId === taskId ? { ...s, status: "failed" as const } : s
          ));
          addActivity("task_failed", data, taskId);
          break;
        }

        case "engine:activity": {
          const type = data.type as EngineActivityType;
          const taskId = data.taskId as string | undefined;
          const agentType = data.agentType as string | undefined;
          const content = (data.content as Record<string, unknown>) || {};
          addActivity(type, content, taskId, agentType || (content.agentType as string));
          break;
        }
      }
    };

    socket.on("event", onEvent);

    return () => {
      socket.off("event", onEvent);
    };
  }, [projectId, addActivity]);

  const isRunning = engineStatus === "running" || engineStatus === "planning";

  return { activities, planSteps, progress, engineStatus, isRunning };
}

// ── Helpers ─────────────────────────────────────────────────────

function mapTaskStatus(status: string): EnginePlanStep["status"] {
  switch (status) {
    case "running": return "running";
    case "completed": return "completed";
    case "failed":
    case "cancelled": return "failed";
    default: return "pending";
  }
}
