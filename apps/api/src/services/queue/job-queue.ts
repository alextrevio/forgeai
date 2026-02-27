import { Queue, Worker, Job } from "bullmq";
import { Server as SocketIOServer } from "socket.io";
import { prisma, Prisma } from "@forgeai/db";
import { logger } from "../../lib/logger";
import { EngineOrchestrator } from "../orchestrator";
import { notificationService } from "../notifications";
import { engineAbortControllers } from "../../engine/service";
import type { PlanStep } from "../agents/base-agent";

// ── Redis connection ────────────────────────────────────────────
function parseRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || "6379", 10),
        ...(parsed.password ? { password: parsed.password } : {}),
      };
    } catch {
      logger.warn({ redisUrl }, "Failed to parse REDIS_URL, falling back to host/port env vars");
    }
  }
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  };
}

const connection = parseRedisConnection();

// ── Queues ──────────────────────────────────────────────────────
export const engineQueue = new Queue("engine-tasks", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 1, // Engine tasks should not auto-retry (state is complex)
  },
});

export const agentQueue = new Queue("agent-tasks", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  },
});

// ── Socket.IO reference (set from index.ts) ─────────────────────
let ioInstance: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer): void {
  ioInstance = io;
}

function getIO(): SocketIOServer {
  if (!ioInstance) {
    throw new Error("Socket.IO not initialized — call setSocketIO() first");
  }
  return ioInstance;
}

// ═══════════════════════════════════════════════════════════════════
// ENGINE WORKER — Processes full project execution plans
// ═══════════════════════════════════════════════════════════════════

export const engineWorker = new Worker(
  "engine-tasks",
  async (job: Job) => {
    const { projectId, planSteps, tasks } = job.data as {
      projectId: string;
      planSteps: PlanStep[];
      tasks: Array<{ id: string; title: string; agentType: string; status: string; order: number }>;
    };

    logger.info({ jobId: job.id, projectId }, "Engine worker: starting execution");

    const io = getIO();
    const controller = new AbortController();
    engineAbortControllers.set(projectId, controller);

    try {
      const orchestrator = new EngineOrchestrator(projectId, io, controller.signal);
      // Set the original prompt from job data so dependency context works
      (orchestrator as any).originalPrompt = job.data.originalPrompt || "";

      await orchestrator.execute(planSteps, tasks);

      logger.info({ jobId: job.id, projectId }, "Engine worker: execution completed");
      return { projectId, status: "completed" };
    } finally {
      engineAbortControllers.delete(projectId);
    }
  },
  {
    connection,
    concurrency: 3, // Max 3 projects executing in parallel
  }
);

// ═══════════════════════════════════════════════════════════════════
// AGENT WORKER — Processes individual agent tasks (for retry)
// ═══════════════════════════════════════════════════════════════════

export const agentWorker = new Worker(
  "agent-tasks",
  async (job: Job) => {
    const { projectId, taskId, step, originalPrompt } = job.data as {
      projectId: string;
      taskId: string;
      step: PlanStep;
      originalPrompt: string;
    };

    logger.info({ jobId: job.id, projectId, taskId }, "Agent worker: starting task");

    const io = getIO();
    const controller = new AbortController();
    engineAbortControllers.set(`agent-${taskId}`, controller);

    try {
      const orchestrator = new EngineOrchestrator(projectId, io, controller.signal);
      (orchestrator as any).originalPrompt = originalPrompt;

      await orchestrator.execute(
        [step],
        [{ id: taskId, title: step.title, agentType: step.agentType, status: "pending", order: step.order }]
      );

      logger.info({ jobId: job.id, taskId }, "Agent worker: task completed");
      return { projectId, taskId, status: "completed" };
    } finally {
      engineAbortControllers.delete(`agent-${taskId}`);
    }
  },
  {
    connection,
    concurrency: 5, // Max 5 agents simultaneously
  }
);

// ═══════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════

engineWorker.on("completed", (job) => {
  const projectId = job?.data?.projectId;
  const failedCount = job?.returnvalue?.failedCount ?? 0;
  logger.info({ jobId: job?.id, projectId }, "Engine job completed");

  if (projectId) {
    notificationService.onEngineComplete(projectId, "completed", failedCount).catch(() => {});
  }
});

engineWorker.on("failed", (job, err) => {
  const projectId = job?.data?.projectId;
  logger.error({ jobId: job?.id, projectId, error: err.message }, "Engine job failed");

  if (projectId) {
    // Notify user
    notificationService.onEngineComplete(projectId, "failed").catch(() => {});

    if (ioInstance) {
      ioInstance.to(`project:${projectId}`).emit("event", {
        type: "engine:failed",
        data: { projectId, error: err.message },
      });
    }

    // Ensure project status reflects failure
    prisma.project.update({
      where: { id: projectId },
      data: { engineStatus: "failed", activeAgents: Prisma.DbNull },
    }).catch(() => {});
  }
});

agentWorker.on("completed", (job) => {
  const { projectId, step } = job?.data || {};
  logger.info({ jobId: job?.id, projectId }, "Agent job completed");

  if (projectId && step?.title) {
    notificationService.onTaskComplete(projectId, step.title, "completed").catch(() => {});
  }
});

agentWorker.on("failed", (job, err) => {
  const { projectId, taskId, step } = job?.data || {};
  logger.error({ jobId: job?.id, projectId, taskId, error: err.message }, "Agent job failed");

  if (projectId && step?.title) {
    notificationService.onTaskComplete(projectId, step.title, "failed").catch(() => {});
  }

  if (projectId && taskId && ioInstance) {
    ioInstance.to(`project:${projectId}`).emit("event", {
      type: "engine:task:failed",
      data: { projectId, taskId, error: err.message },
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// QUEUE HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Enqueue an engine execution job */
export async function enqueueEngineExecution(
  projectId: string,
  planSteps: PlanStep[],
  tasks: Array<{ id: string; title: string; agentType: string; status: string; order: number }>,
  originalPrompt: string
): Promise<Job> {
  return engineQueue.add(
    "execute",
    { projectId, planSteps, tasks, originalPrompt },
    { jobId: `engine-${projectId}-${Date.now()}` }
  );
}

/** Enqueue an individual agent task (for retries) */
export async function enqueueAgentTask(
  projectId: string,
  taskId: string,
  step: PlanStep,
  originalPrompt: string
): Promise<Job> {
  return agentQueue.add(
    "execute-task",
    { projectId, taskId, step, originalPrompt },
    { jobId: `agent-${taskId}-${Date.now()}` }
  );
}

/** Get engine job status for a project */
export async function getEngineJobStatus(projectId: string) {
  // Search for the latest job for this project
  const jobs = await engineQueue.getJobs(["active", "waiting", "delayed", "completed", "failed"]);
  const job = jobs.find((j) => j.data?.projectId === projectId);

  if (!job) return null;

  const state = await job.getState();

  return {
    jobId: job.id,
    status: state,
    progress: job.progress,
    data: job.data,
    failedReason: job.failedReason,
    timestamp: {
      created: job.timestamp,
      started: job.processedOn,
      finished: job.finishedOn,
    },
  };
}

/** Cancel an engine job for a project */
export async function cancelEngineJob(projectId: string): Promise<boolean> {
  // Abort the running execution
  const controller = engineAbortControllers.get(projectId);
  if (controller) {
    controller.abort();
    engineAbortControllers.delete(projectId);
  }

  // Find and remove job from queue
  const jobs = await engineQueue.getJobs(["active", "waiting", "delayed"]);
  const job = jobs.find((j) => j.data?.projectId === projectId);

  if (job) {
    const state = await job.getState();
    if (state === "waiting" || state === "delayed") {
      await job.remove();
    }
    // Active jobs will be cancelled via AbortController
  }

  // Cancel pending/running tasks in DB
  await prisma.task.updateMany({
    where: { projectId, status: { in: ["running", "pending"] } },
    data: { status: "cancelled" },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { engineStatus: "idle", activeAgents: Prisma.DbNull },
  });

  return true;
}

/** Get queue stats for admin dashboard */
export async function getQueueStats(): Promise<{
  engine: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  agent: { waiting: number; active: number; completed: number; failed: number; delayed: number };
}> {
  const [engineCounts, agentCounts] = await Promise.all([
    engineQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    agentQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
  ]);

  return {
    engine: engineCounts as any,
    agent: agentCounts as any,
  };
}

/** Get all jobs across both queues for admin */
export async function getAllJobs(
  status?: "active" | "waiting" | "completed" | "failed" | "delayed",
  limit = 50
) {
  const states = status
    ? [status]
    : ["active", "waiting", "completed", "failed", "delayed"] as const;

  const [engineJobs, agentJobs] = await Promise.all([
    engineQueue.getJobs(states as any, 0, limit),
    agentQueue.getJobs(states as any, 0, limit),
  ]);

  const formatJob = async (job: Job, queueName: string) => {
    const state = await job.getState();
    return {
      id: job.id,
      queue: queueName,
      name: job.name,
      status: state,
      projectId: job.data?.projectId || "unknown",
      data: job.data,
      progress: job.progress,
      failedReason: job.failedReason,
      createdAt: job.timestamp,
      processedAt: job.processedOn,
      finishedAt: job.finishedOn,
    };
  };

  const allJobs = await Promise.all([
    ...engineJobs.map((j) => formatJob(j, "engine-tasks")),
    ...agentJobs.map((j) => formatJob(j, "agent-tasks")),
  ]);

  // Sort by creation time descending
  return allJobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════

export async function closeQueues(): Promise<void> {
  logger.info("Closing BullMQ workers and queues...");
  await Promise.all([
    engineWorker.close(),
    agentWorker.close(),
    engineQueue.close(),
    agentQueue.close(),
  ]);
  logger.info("BullMQ shutdown complete");
}
