"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/stores/project-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { WorkspaceLayout } from "@/components/workspace/workspace-layout";

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
        store.setMessages(messages);

        // Load snapshots
        api.getSnapshots(projectId).then(store.setSnapshots).catch(() => {});

        if (project.sandboxId) {
          store.setSandboxStatus("running");
          try {
            const tree = await api.getFileTree(projectId);
            store.setFileTree(tree);
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
          api.getFileTree(projectId).then(s.setFileTree).catch(() => {});
          break;

        case "agent:debugger_start":
          s.setActiveAgent("debugger");
          s.setAgentThinking("Debugger is fixing errors...");
          break;

        case "agent:debugger_fix":
          s.addMessage({
            id: crypto.randomUUID(),
            projectId,
            role: "SYSTEM",
            content: `Debugger fix: ${event.data.explanation}`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:debugger_failed":
          s.addMessage({
            id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
            projectId,
            role: "SYSTEM",
            content: `Code Review (Score: ${event.data.report.score}/100): ${event.data.report.summary}${event.data.report.issues.length > 0 ? `\n\nIssues found: ${event.data.report.issues.length}` : ""}`,
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
            id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
            projectId,
            role: "SYSTEM",
            content: `Deploy failed: ${event.data.error}`,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          break;

        case "agent:error":
          s.setAgentThinking(null);
          s.addMessage({
            id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
            projectId,
            role: "ASSISTANT",
            content: event.data.summary,
            messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
            createdAt: new Date().toISOString(),
          });
          // Refresh file tree and snapshots
          api.getFileTree(projectId).then(s.setFileTree).catch(() => {});
          api.getSnapshots(projectId).then(s.setSnapshots).catch(() => {});
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

  return <WorkspaceLayout />;
}
