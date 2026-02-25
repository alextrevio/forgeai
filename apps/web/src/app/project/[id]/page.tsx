"use client";

import { useEffect, Component, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useProjectStore } from "@/stores/project-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { generateId } from "@/lib/utils";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";

/** Safely extract an array from API responses that may be objects with wrapper keys */
function safeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const key of ["data", "messages", "items", "projects", "files", "snapshots", "plans", "templates", "operations"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

/** Error boundary — shows a "Volver al Dashboard" button instead of crashing */
class ProjectErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[ProjectErrorBoundary]", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-[#0f0f17] gap-4">
          <div className="h-16 w-16 rounded-2xl bg-[#ef4444]/10 flex items-center justify-center">
            <span className="text-3xl">!</span>
          </div>
          <h2 className="text-lg font-semibold text-[#e2e2e8]">Algo salió mal</h2>
          <p className="text-sm text-[#8888a0] max-w-xs text-center">
            Ocurrió un error inesperado. Intenta volver al dashboard.
          </p>
          <a
            href="/dashboard"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Volver al Dashboard
          </a>
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

    socket.on("event", (event: { type: string; data: any }) => {
      const s = useProjectStore.getState();

      switch (event.type) {
        case "agent:thinking":
          s.setAgentThinking(event.data.content);
          if (!s.isAgentRunning) s.setAgentRunning(true);
          break;

        case "agent:plan":
          s.setPlan(event.data.plan);
          s.setActiveAgent("coder");
          break;

        case "agent:step_start":
          s.updateStepStatus(event.data.step.id, "in_progress");
          s.setActiveAgent("coder");
          break;

        case "agent:step_complete":
          s.updateStepStatus(event.data.step.id, event.data.step.status);
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
          // If the file is open, refresh its content
          if (event.data.change.content) {
            s.refreshOpenFile(event.data.change.file, event.data.change.content);
          }
          break;

        case "sandbox:file_changed":
          s.markFileChanged(event.data.path);
          break;

        case "agent:terminal_output":
        case "sandbox:terminal_output":
          s.addTerminalOutput(event.data.output);
          break;

        case "agent:designer_start":
          s.setActiveAgent("designer");
          s.setAgentThinking("Designer is improving the visual design...");
          break;

        case "agent:designer_complete":
          s.setActiveAgent("coder");
          // Refresh file tree after designer changes
          api.getFileTree(projectId).then((t) => s.setFileTree(safeArray(t))).catch(() => {});
          break;

        case "agent:debugger_start":
          s.setActiveAgent("debugger");
          s.setAgentThinking("Debugger is fixing errors...");
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
          break;

        case "agent:reviewer_report":
          s.setReviewReport(event.data.report);
          s.setActiveAgent(null);
          s.addMessage({
            id: generateId(),
            projectId,
            role: "SYSTEM",
            content: `Code Review (Score: ${event.data.report.score}/100): ${event.data.report.summary}${(Array.isArray(event?.data?.report?.issues) ? event.data.report.issues : []).length > 0 ? `\n\nIssues found: ${(Array.isArray(event?.data?.report?.issues) ? event.data.report.issues : []).length}` : ""}`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:deploy_start":
          s.setActiveAgent("deployer");
          s.setAgentThinking("Building and deploying...");
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
          // Refresh file tree and snapshots
          api.getFileTree(projectId).then((t) => s.setFileTree(safeArray(t))).catch(() => {});
          api.getSnapshots(projectId).then((sn) => s.setSnapshots(safeArray(sn))).catch(() => {});
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
    });

    return () => {
      socket.emit("leave:project", projectId);
      socket.off("event");
    };
  }, [projectId, isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <ProjectErrorBoundary>
      <WorkspaceLayout />
    </ProjectErrorBoundary>
  );
}
