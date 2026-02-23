import type { AgentPlan, AgentStep, CodeChange, ReviewReport, Snapshot, Notification } from "./types";

// ─── WebSocket Event Types ─────────────────────────────────────
export type ServerEvent =
  | AgentThinkingEvent
  | AgentPlanEvent
  | AgentStepStartEvent
  | AgentStepCompleteEvent
  | AgentCodeChangeEvent
  | AgentTerminalOutputEvent
  | AgentErrorEvent
  | AgentCompleteEvent
  | PreviewReloadEvent
  | SandboxStatusEvent
  | DesignerStartEvent
  | DesignerCompleteEvent
  | DebuggerStartEvent
  | DebuggerFixEvent
  | DebuggerFailedEvent
  | ReviewerStartEvent
  | ReviewerReportEvent
  | DeployStartEvent
  | DeployCompleteEvent
  | DeployFailedEvent
  | SandboxTerminalOutputEvent
  | SandboxFileChangedEvent
  | SnapshotCreatedEvent
  | NotificationEvent;

export interface AgentThinkingEvent {
  type: "agent:thinking";
  data: { content: string };
}

export interface AgentPlanEvent {
  type: "agent:plan";
  data: { plan: AgentPlan };
}

export interface AgentStepStartEvent {
  type: "agent:step_start";
  data: { step: AgentStep };
}

export interface AgentStepCompleteEvent {
  type: "agent:step_complete";
  data: { step: AgentStep };
}

export interface AgentCodeChangeEvent {
  type: "agent:code_change";
  data: { change: CodeChange };
}

export interface AgentTerminalOutputEvent {
  type: "agent:terminal_output";
  data: { output: string };
}

export interface AgentErrorEvent {
  type: "agent:error";
  data: { message: string; stack?: string };
}

export interface AgentCompleteEvent {
  type: "agent:complete";
  data: { summary: string };
}

export interface PreviewReloadEvent {
  type: "preview:reload";
  data: Record<string, never>;
}

export interface SandboxStatusEvent {
  type: "sandbox:status";
  data: { status: "creating" | "running" | "stopped" | "destroyed" };
}

// ─── New Agent Events ────────────────────────────────────────
export interface DesignerStartEvent {
  type: "agent:designer_start";
  data: Record<string, never>;
}

export interface DesignerCompleteEvent {
  type: "agent:designer_complete";
  data: Record<string, never>;
}

export interface DebuggerStartEvent {
  type: "agent:debugger_start";
  data: Record<string, never>;
}

export interface DebuggerFixEvent {
  type: "agent:debugger_fix";
  data: { explanation: string };
}

export interface DebuggerFailedEvent {
  type: "agent:debugger_failed";
  data: { error: string };
}

export interface ReviewerStartEvent {
  type: "agent:reviewer_start";
  data: Record<string, never>;
}

export interface ReviewerReportEvent {
  type: "agent:reviewer_report";
  data: { report: ReviewReport };
}

export interface DeployStartEvent {
  type: "agent:deploy_start";
  data: Record<string, never>;
}

export interface DeployCompleteEvent {
  type: "agent:deploy_complete";
  data: { url: string; buildTime: number };
}

export interface DeployFailedEvent {
  type: "agent:deploy_failed";
  data: { error: string };
}

// ─── Sandbox Events ─────────────────────────────────────────
export interface SandboxTerminalOutputEvent {
  type: "sandbox:terminal_output";
  data: { output: string };
}

export interface SandboxFileChangedEvent {
  type: "sandbox:file_changed";
  data: { path: string };
}

// ─── Snapshot Events ────────────────────────────────────────
export interface SnapshotCreatedEvent {
  type: "snapshot:created";
  data: { snapshot: Snapshot };
}

// ─── Notification Events ───────────────────────────────────────
export interface NotificationEvent {
  type: "notification";
  data: { notification: Notification };
}

// ─── Client Events ─────────────────────────────────────────────
export type ClientEvent =
  | SendMessageEvent
  | StopAgentEvent
  | UndoChangeEvent;

export interface SendMessageEvent {
  type: "message:send";
  data: { content: string; projectId: string };
}

export interface StopAgentEvent {
  type: "agent:stop";
  data: { projectId: string };
}

export interface UndoChangeEvent {
  type: "agent:undo";
  data: { projectId: string };
}
