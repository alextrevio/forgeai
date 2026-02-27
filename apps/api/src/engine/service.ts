import { Server as SocketIOServer } from "socket.io";
import { prisma, Prisma } from "@forgeai/db";
import { logger } from "../lib/logger";
import { EngineOrchestrator } from "../services/orchestrator";
import { enqueueEngineExecution, enqueueAgentTask, cancelEngineJob } from "../services/queue/job-queue";
import type { PlanStep } from "../services/agents/base-agent";

// ── AbortControllers for running engines ──────────────────────────

export const engineAbortControllers = new Map<string, AbortController>();

// ═══════════════════════════════════════════════════════════════════
// START ENGINE — Delegates to EngineOrchestrator
// ═══════════════════════════════════════════════════════════════════

export async function startEngine(
  projectId: string,
  prompt: string,
  io: SocketIOServer
): Promise<{
  planSteps: PlanStep[];
  tasks: Array<{ id: string; title: string; agentType: string; status: string; order: number }>;
  analysis: string;
  complexity: string;
  estimatedTime: string;
  queued: boolean;
}> {
  const controller = new AbortController();
  engineAbortControllers.set(projectId, controller);

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("Project not found");

    // Phase 1: Plan (synchronous — fast LLM call)
    const orchestrator = new EngineOrchestrator(projectId, io, controller.signal);
    const planResult = await orchestrator.plan(prompt);

    // Phase 2: Execute in background via BullMQ queue
    await enqueueEngineExecution(
      projectId,
      planResult.planSteps,
      planResult.tasks,
      prompt
    );

    // Clean up the abort controller — the worker will create its own
    engineAbortControllers.delete(projectId);

    logger.info({ projectId }, "Engine execution queued via BullMQ");

    return {
      planSteps: planResult.planSteps,
      tasks: planResult.tasks,
      analysis: planResult.analysis,
      complexity: planResult.complexity,
      estimatedTime: planResult.estimatedTime,
      queued: true,
    };

  } catch (err) {
    engineAbortControllers.delete(projectId);
    const message = err instanceof Error ? err.message : String(err);

    await prisma.project.update({
      where: { id: projectId },
      data: { engineStatus: "failed" },
    }).catch(() => {});

    io.to(`project:${projectId}`).emit("event", {
      type: "engine:failed",
      data: { projectId, error: message },
    });

    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE CONTROL — Pause, Resume, Cancel, Retry
// ═══════════════════════════════════════════════════════════════════

export async function controlEngine(
  projectId: string,
  action: "pause" | "resume" | "cancel" | "retry",
  io: SocketIOServer,
  taskId?: string
): Promise<{ engineStatus: string; message: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { engineStatus: true },
  });
  if (!project) throw new Error("Project not found");

  switch (action) {
    case "pause": {
      if (project.engineStatus !== "running" && project.engineStatus !== "planning") {
        throw new Error("Engine is not running");
      }
      await prisma.project.update({
        where: { id: projectId },
        data: { engineStatus: "paused" },
      });
      emit(io, projectId, "engine:status_change", { status: "paused" });
      return { engineStatus: "paused", message: "Engine paused" };
    }

    case "resume": {
      if (project.engineStatus !== "paused") {
        throw new Error("Engine is not paused");
      }
      await prisma.project.update({
        where: { id: projectId },
        data: { engineStatus: "running" },
      });
      emit(io, projectId, "engine:status_change", { status: "running" });
      return { engineStatus: "running", message: "Engine resumed" };
    }

    case "cancel": {
      if (project.engineStatus === "idle" || project.engineStatus === "completed") {
        throw new Error("Engine is not active");
      }

      // Cancel via BullMQ + AbortController
      await cancelEngineJob(projectId);

      emit(io, projectId, "engine:status_change", { status: "idle" });
      return { engineStatus: "idle", message: "Engine cancelled" };
    }

    case "retry": {
      if (!taskId) throw new Error("taskId is required for retry action");

      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId },
      });
      if (!task) throw new Error("Task not found");
      if (task.status !== "failed") throw new Error("Can only retry failed tasks");

      // Reset the failed task
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: "pending",
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          durationMs: null,
          outputResult: Prisma.DbNull,
        },
      });

      emit(io, projectId, "engine:task_updated", {
        taskId,
        status: "pending",
        message: "Task queued for retry",
      });

      // Re-execute via BullMQ agent queue
      if (project.engineStatus !== "running") {
        await prisma.project.update({
          where: { id: projectId },
          data: { engineStatus: "running" },
        });
        emit(io, projectId, "engine:status_change", { status: "running" });
      }

      const retryStep: PlanStep = {
        order: task.order,
        title: task.title,
        description: task.description || task.title,
        agentType: task.agentType,
        dependsOn: [],
        estimatedDuration: "5min",
        priority: "medium",
      };

      await enqueueAgentTask(projectId, taskId, retryStep, task.inputPrompt || "");
      logger.info({ projectId, taskId }, "Task retry queued via BullMQ");

      return { engineStatus: "running", message: "Task retry queued" };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ── Minimal helper for controlEngine events ──────────────────────

function emit(io: SocketIOServer, projectId: string, type: string, data: unknown) {
  io.to(`project:${projectId}`).emit("event", { type, data });
}
