"use client";

import { useEffect, useRef, Component, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "@/stores/project-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { generateId } from "@/lib/utils";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";
import { DashboardShell } from "@/components/dashboard-shell";

/** Safely extract an array from API responses that may be objects with wrapper keys */
function safeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const key of ["data", "messages", "items", "projects", "files", "snapshots", "plans", "templates", "operations", "steps", "entries", "results", "notifications", "members", "commands"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

/** Error boundary — shows retry + dashboard buttons instead of crashing */
class ProjectErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ProjectErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#ef4444]/10 flex items-center justify-center">
              <span className="text-3xl text-[#ef4444]">!</span>
            </div>
            <h2 className="text-xl font-semibold text-white">Algo salió mal</h2>
            <p className="text-[#8888a0] text-sm max-w-md">
              Ocurrió un error inesperado. Intenta reintentar o volver al dashboard.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: "" })}
                className="px-4 py-2 rounded-lg bg-[#111114] border border-[#1a1a1f] text-white text-sm hover:bg-[#161619] transition-colors"
              >
                Reintentar
              </button>
              <a
                href="/dashboard"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white text-sm hover:opacity-90 transition-opacity"
              >
                Volver al Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;
  const store = useProjectStore();
  const { loadUser, isAuthenticated, isLoading } = useAuthStore();

  // Debounce terminal output — batch rapid lines into a single state update
  const termBufRef = useRef<string[]>([]);
  const termTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushTerminal = () => {
    if (termBufRef.current.length === 0) return;
    const lines = termBufRef.current;
    termBufRef.current = [];
    const s = useProjectStore.getState();
    for (const line of lines) s.addTerminalOutput(line);
  };
  const queueTerminal = (line: string) => {
    termBufRef.current.push(line);
    if (!termTimerRef.current) {
      termTimerRef.current = setTimeout(() => {
        termTimerRef.current = null;
        flushTerminal();
      }, 100);
    }
  };

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (!projectId || isLoading || !isAuthenticated) return;

    const loadProject = async () => {
      try {
        const project = await api.getProject(projectId);
        store.setProject(project.id, project.name, project.framework);

        const messages = await api.getMessages(projectId);
        store.setMessages(safeArray(messages));

        // Load snapshots
        api.getSnapshots(projectId)
          .then((s) => store.setSnapshots(safeArray(s)))
          .catch(() => {});

        if (project.sandboxId) {
          store.setSandboxStatus("running");
          try {
            const tree = await api.getFileTree(projectId);
            store.setFileTree(safeArray(tree));
            const preview = await api.getPreviewUrl(projectId);
            store.setPreviewUrl(preview.url);
          } catch { /* sandbox may not be running */ }
        }
      } catch (err) {
        console.error("Failed to load project:", err);
      }
    };
    loadProject();

    const socket = getSocket();
    socket.emit("join:project", projectId);

    socket.on("event", (raw: unknown) => {
      try {
      const event = raw as { type: string; data: any };
      if (!event?.type) return;
      const s = useProjectStore.getState();

      switch (event.type) {
        case "agent:thinking":
          s.setAgentThinking(event.data.content);
          if (!s.isAgentRunning) s.setAgentRunning(true);
          s.addActivity({ type: "thinking", thinkingText: event.data.content });
          break;

        case "agent:plan":
          s.setPlan(event.data.plan);
          s.setActiveAgent("coder");
          s.addActivity({
            type: "plan",
            planSummary: event.data.plan?.understanding,
            stepCount: Array.isArray(event.data.plan?.steps) ? event.data.plan.steps.length : 0,
          });
          break;

        case "agent:step_start":
          s.updateStepStatus(event.data.step.id, "in_progress");
          s.setActiveAgent("coder");
          s.addActivity({
            type: "step_start",
            stepId: event.data.step.id,
            stepDescription: event.data.step.description,
          });
          break;

        case "agent:step_complete":
          s.updateStepStatus(event.data.step.id, event.data.step.status);
          s.addActivity({
            type: event.data.step.status === "failed" ? "step_error" : "step_complete",
            stepId: event.data.step.id,
            stepDescription: event.data.step.description,
          });
          break;

        case "agent:step_message":
          s.addMessage({
            id: generateId(),
            projectId,
            role: "ASSISTANT",
            content: event.data.message,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:code_change":
          s.addCodeChange(event.data.change);
          if (event.data.change.content) {
            s.refreshOpenFile(event.data.change.file, event.data.change.content);
          }
          s.addActivity({
            type: "file_change",
            filePath: event.data.change.file,
            fileAction: event.data.change.action,
            fileDiff: event.data.change.diff,
          });
          break;

        case "sandbox:file_changed":
          s.markFileChanged(event.data.path);
          break;

        case "agent:terminal_output":
        case "sandbox:terminal_output":
          queueTerminal(event.data.output);
          // Detect commands (lines starting with $)
          if (typeof event.data.output === "string" && event.data.output.trim().startsWith("$")) {
            s.addActivity({
              type: "terminal_cmd",
              command: event.data.output.trim().replace(/^\$\s*/, ""),
              output: "",
            });
          }
          break;

        case "agent:designer_start":
          s.setActiveAgent("designer");
          s.setAgentThinking("Designer is improving the visual design...");
          s.addActivity({ type: "agent_switch", agent: "designer" });
          break;

        case "agent:designer_complete":
          s.setActiveAgent("coder");
          api.getFileTree(projectId).then((t) => s.setFileTree(safeArray(t))).catch(() => {});
          s.addActivity({ type: "agent_switch", agent: "coder" });
          break;

        case "agent:debugger_start":
          s.setActiveAgent("debugger");
          s.setAgentThinking("Debugger is fixing errors...");
          s.addActivity({ type: "agent_switch", agent: "debugger" });
          break;

        case "agent:debugger_fix":
          s.addMessage({
            id: generateId(),
            projectId,
            role: "SYSTEM",
            content: `Debugger fix: ${event.data.explanation}`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:debugger_failed":
          s.addMessage({
            id: generateId(),
            projectId,
            role: "SYSTEM",
            content: `Debugger failed: ${event.data.error}`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:reviewer_start":
          s.setActiveAgent("reviewer");
          s.setAgentThinking("Reviewing code quality...");
          s.addActivity({ type: "agent_switch", agent: "reviewer" });
          break;

        case "agent:reviewer_report":
          s.setReviewReport(event.data.report);
          s.setActiveAgent(null);
          s.addMessage({
            id: generateId(),
            projectId,
            role: "SYSTEM",
            content: `Code Review (Score: ${event.data.report.score}/100): ${event.data.report.summary}${(Array.isArray(event.data.report.issues) ? event.data.report.issues : []).length > 0 ? `\n\nIssues found: ${(Array.isArray(event.data.report.issues) ? event.data.report.issues : []).length}` : ""}`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:deploy_start":
          s.setActiveAgent("deployer");
          s.setAgentThinking("Building and deploying...");
          s.addActivity({ type: "agent_switch", agent: "deployer" });
          break;

        case "agent:deploy_complete":
          s.setActiveAgent(null);
          s.setAgentThinking(null);
          s.addMessage({
            id: generateId(),
            projectId,
            role: "ASSISTANT",
            content: `Deploy successful! URL: ${event.data.url} (Build time: ${Math.round(event.data.buildTime / 1000)}s)`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:deploy_failed":
          s.setActiveAgent(null);
          s.setAgentThinking(null);
          s.addMessage({
            id: generateId(),
            projectId,
            role: "SYSTEM",
            content: `Deploy failed: ${event.data.error}`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:error":
          s.setAgentRunning(false);
          s.setAgentThinking(null);
          s.setActiveAgent(null);
          s.addMessage({
            id: generateId(),
            projectId,
            role: "SYSTEM",
            content: `Error: ${event.data.message}`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          s.addActivity({ type: "error", errorMessage: event.data.message });
          break;

        case "agent:complete":
          s.setAgentRunning(false);
          s.setAgentThinking(null);
          s.setActiveAgent(null);
          s.addMessage({
            id: generateId(),
            projectId,
            role: "ASSISTANT",
            content: event.data.summary,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          api.getFileTree(projectId).then((t) => s.setFileTree(safeArray(t))).catch(() => {});
          api.getSnapshots(projectId).then((sn) => s.setSnapshots(safeArray(sn))).catch(() => {});
          s.addActivity({ type: "complete", summary: event.data.summary });
          break;

        case "preview:reload":
          s.setPreviewUrl(null);
          setTimeout(() => {
            api.getPreviewUrl(projectId).then((p) => s.setPreviewUrl(p.url)).catch(() => {});
          }, 500);
          break;

        case "sandbox:status":
          s.setSandboxStatus(event.data.status);
          break;

        case "snapshot:created":
          s.addSnapshot(event.data.snapshot);
          break;
      }
      } catch (err) {
        console.error("[Socket] event handler error:", err);
      }
    });

    return () => {
      socket.emit("leave:project", projectId);
      socket.off("event");
      if (termTimerRef.current) clearTimeout(termTimerRef.current);
      flushTerminal();
    };
  }, [projectId, isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <ProjectErrorBoundary>
        <WorkspaceLayout />
      </ProjectErrorBoundary>
    </DashboardShell>
  );
}
