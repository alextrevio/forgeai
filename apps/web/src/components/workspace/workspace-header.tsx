"use client";

import { useState } from "react";
import {
  Rocket,
  Github,
  Square,
  Undo2,
  LogOut,
  Zap,
  History,
  X,
  RotateCcw,
  Database,
  Settings,
  ExternalLink,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Loader2,
  Check,
  Download,
  Share2,
  Users,
  UserPlus,
  Trash2,
  Crown,
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type ModalType = "github" | "supabase" | "settings" | "share" | null;

interface MemberInfo {
  id: string;
  role: string;
  user: { id: string; email: string; name: string | null };
}

export function WorkspaceHeader() {
  const {
    projectName,
    sandboxStatus,
    isAgentRunning,
    currentProjectId,
    activeAgent,
    snapshots,
    setFileTree,
    setPreviewUrl,
  } = useProjectStore();
  const { user, logout } = useAuthStore();
  const [isDeploying, setIsDeploying] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [modal, setModal] = useState<ModalType>(null);
  const [githubStatus, setGithubStatus] = useState<{ connected: boolean; username: string | null }>({ connected: false, username: null });
  const [githubToken, setGithubToken] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<{ connected: boolean; url: string | null }>({ connected: false, url: null });
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"viewer" | "editor">("editor");
  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [members, setMembers] = useState<MemberInfo[]>([]);

  const handleDeploy = async () => {
    if (!currentProjectId) return;
    setIsDeploying(true);
    try {
      await api.deployProject(currentProjectId);
    } catch (err) {
      console.error("Deploy failed:", err);
    } finally {
      setTimeout(() => setIsDeploying(false), 2000);
    }
  };

  const handleStop = async () => {
    if (!currentProjectId) return;
    try {
      await api.stopAgent(currentProjectId);
    } catch (err) {
      console.error("Stop failed:", err);
    }
  };

  const handleUndo = async () => {
    if (!currentProjectId) return;
    try {
      await api.undoChange(currentProjectId);
      const tree = await api.getFileTree(currentProjectId);
      setFileTree(tree);
      const preview = await api.getPreviewUrl(currentProjectId);
      setPreviewUrl(preview.url);
    } catch (err) {
      console.error("Undo failed:", err);
    }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!currentProjectId) return;
    try {
      await api.restoreSnapshot(currentProjectId, snapshotId);
      const tree = await api.getFileTree(currentProjectId);
      setFileTree(tree);
      setShowTimeline(false);
    } catch (err) {
      console.error("Restore failed:", err);
    }
  };

  const openGitHub = async () => {
    setModal("github");
    setExportResult(null);
    try {
      const status = await api.getGitHubStatus();
      setGithubStatus(status);
    } catch { /* ignore */ }
  };

  const connectGitHub = async () => {
    if (!githubToken.trim()) return;
    setIsConnecting(true);
    try {
      const result = await api.connectGitHub(githubToken.trim());
      setGithubStatus({ connected: true, username: result.username });
      setGithubToken("");
    } catch (err) {
      console.error("GitHub connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleExportGitHub = async () => {
    if (!currentProjectId) return;
    setIsExporting(true);
    setExportResult(null);
    try {
      const result = await api.exportToGitHub(currentProjectId);
      setExportResult(result.repoUrl);
    } catch (err) {
      console.error("Export failed:", err);
      setExportResult("error");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePushGitHub = async () => {
    if (!currentProjectId) return;
    setIsPushing(true);
    try {
      await api.pushToGitHub(currentProjectId);
      setExportResult("pushed");
    } catch (err) {
      console.error("Push failed:", err);
    } finally {
      setIsPushing(false);
    }
  };

  const handlePullGitHub = async () => {
    if (!currentProjectId) return;
    setIsPulling(true);
    try {
      await api.pullFromGitHub(currentProjectId);
      const tree = await api.getFileTree(currentProjectId);
      setFileTree(tree);
      setExportResult("pulled");
    } catch (err) {
      console.error("Pull failed:", err);
    } finally {
      setIsPulling(false);
    }
  };

  const openSupabase = async () => {
    setModal("supabase");
    try {
      const status = await api.getSupabaseStatus();
      setSupabaseStatus(status);
    } catch { /* ignore */ }
  };

  const connectSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) return;
    setIsConnecting(true);
    try {
      const result = await api.connectSupabase(supabaseUrl.trim(), supabaseKey.trim());
      setSupabaseStatus({ connected: true, url: result.url });
      setSupabaseUrl("");
      setSupabaseKey("");
    } catch (err) {
      console.error("Supabase connect failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGenerateClient = async () => {
    if (!currentProjectId) return;
    setIsConnecting(true);
    try {
      await api.generateSupabaseClient(currentProjectId);
      const tree = await api.getFileTree(currentProjectId);
      setFileTree(tree);
    } catch (err) {
      console.error("Generate client failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  const openSettings = async () => {
    setModal("settings");
    setSettingsSaved(false);
    if (currentProjectId) {
      try {
        const project = await api.getProject(currentProjectId);
        setCustomInstructions(project.customInstructions || "");
      } catch { /* ignore */ }
    }
  };

  const saveSettings = async () => {
    if (!currentProjectId) return;
    try {
      await api.updateProjectSettings(currentProjectId, { customInstructions });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      console.error("Save settings failed:", err);
    }
  };

  const handleDownloadZip = async () => {
    if (!currentProjectId) return;
    setIsDownloading(true);
    try {
      const blob = await api.exportZip(currentProjectId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName || "project"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download ZIP failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const openShare = async () => {
    setModal("share");
    setShareEmail("");
    setShareSuccess(false);
    if (currentProjectId) {
      try {
        const data = await api.getProjectMembers(currentProjectId);
        setMembers(data.members || data || []);
      } catch { /* ignore */ }
    }
  };

  const handleShare = async () => {
    if (!currentProjectId || !shareEmail.trim()) return;
    setIsSharing(true);
    try {
      await api.shareProject(currentProjectId, shareEmail.trim(), shareRole);
      setShareSuccess(true);
      setShareEmail("");
      setTimeout(() => setShareSuccess(false), 2000);
      // Refresh members
      const data = await api.getProjectMembers(currentProjectId);
      setMembers(data.members || data || []);
    } catch (err) {
      console.error("Share failed:", err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentProjectId) return;
    try {
      await api.removeProjectMember(currentProjectId, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      console.error("Remove member failed:", err);
    }
  };

  return (
    <>
      <header className="flex h-12 items-center justify-between border-b border-border bg-card px-4">
        {/* Left: Logo + Project Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-primary">ForgeAI</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium text-foreground">
            {projectName || "Untitled Project"}
          </span>
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              sandboxStatus === "running"
                ? "bg-success"
                : sandboxStatus === "creating"
                  ? "bg-warning animate-pulse"
                  : "bg-muted-foreground"
            )}
          />
          {activeAgent && (
            <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5 capitalize">
              {activeAgent}
            </span>
          )}
        </div>

        {/* Center: Agent Controls */}
        <div className="flex items-center gap-2">
          {isAgentRunning && (
            <button
              onClick={handleStop}
              className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          )}
          <button
            onClick={handleUndo}
            disabled={isAgentRunning}
            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
            title="Undo last change"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </button>
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              showTimeline
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
            title="Version timeline"
          >
            <History className="h-3 w-3" />
            Timeline
            {snapshots.length > 0 && (
              <span className="rounded-full bg-primary/20 px-1.5 text-[10px]">
                {snapshots.length}
              </span>
            )}
          </button>
        </div>

        {/* Right: Deploy + Integrations + User */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDeploy}
            disabled={isDeploying || isAgentRunning}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Rocket className="h-3 w-3" />
            {isDeploying ? "Deploying..." : "Deploy"}
          </button>
          <button
            onClick={handleDownloadZip}
            disabled={isDownloading}
            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
            title="Download ZIP"
          >
            {isDownloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          </button>
          <button
            onClick={openShare}
            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
            title="Share Project"
          >
            <Share2 className="h-3 w-3" />
          </button>
          <button
            onClick={openGitHub}
            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
            title="GitHub"
          >
            <Github className="h-3 w-3" />
          </button>
          <button
            onClick={openSupabase}
            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
            title="Supabase"
          >
            <Database className="h-3 w-3" />
          </button>
          <button
            onClick={openSettings}
            className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
            title="Project Settings"
          >
            <Settings className="h-3 w-3" />
          </button>
          <div className="h-4 w-px bg-border" />
          {/* Member avatars */}
          {members.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {members.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="h-6 w-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[9px] font-medium text-muted-foreground"
                  title={m.user.name || m.user.email}
                >
                  {(m.user.name || m.user.email).charAt(0).toUpperCase()}
                </div>
              ))}
              {members.length > 3 && (
                <div className="h-6 w-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[9px] font-medium text-muted-foreground">
                  +{members.length - 3}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
              {user?.name?.[0] || user?.email?.[0] || "U"}
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Timeline Panel */}
      {showTimeline && (
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Version Timeline</span>
            <button
              onClick={() => setShowTimeline(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground">No snapshots yet. Snapshots are created automatically before each change.</p>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {snapshots.map((snap, i) => (
                <div key={snap.id} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <div className="w-4 h-px bg-border" />}
                  <button
                    onClick={() => handleRestoreSnapshot(snap.id)}
                    className="group flex flex-col items-center gap-1 rounded-lg border border-border px-3 py-2 hover:border-primary/50 hover:bg-primary/5 transition-colors min-w-[120px]"
                  >
                    <div className="h-2 w-2 rounded-full bg-primary/60 group-hover:bg-primary" />
                    <span className="text-[10px] text-foreground font-medium truncate max-w-[100px]">
                      {snap.label}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(snap.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="text-[9px] text-primary opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                      <RotateCcw className="h-2 w-2" /> Restore
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Overlay */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            {/* GitHub Modal */}
            {modal === "github" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Github className="h-5 w-5 text-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">GitHub</h2>
                  </div>
                  <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {!githubStatus.connected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Connect your GitHub account with a personal access token to export projects.
                    </p>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    />
                    <button
                      onClick={connectGitHub}
                      disabled={!githubToken.trim() || isConnecting}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Connect GitHub
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3">
                      <Check className="h-4 w-4 text-success" />
                      <span className="text-sm text-success">Connected as @{githubStatus.username}</span>
                    </div>

                    {exportResult && exportResult !== "error" && exportResult !== "pushed" && exportResult !== "pulled" && (
                      <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3">
                        <ExternalLink className="h-4 w-4 text-primary" />
                        <a href={exportResult} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
                          {exportResult}
                        </a>
                      </div>
                    )}
                    {exportResult === "pushed" && (
                      <div className="rounded-lg bg-success/10 p-3 text-sm text-success">Changes pushed successfully!</div>
                    )}
                    {exportResult === "pulled" && (
                      <div className="rounded-lg bg-success/10 p-3 text-sm text-success">Files pulled successfully!</div>
                    )}

                    <button
                      onClick={handleExportGitHub}
                      disabled={isExporting}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                      Export to New Repo
                    </button>

                    <div className="flex gap-2">
                      <button
                        onClick={handlePushGitHub}
                        disabled={isPushing}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                      >
                        {isPushing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUp className="h-3 w-3" />}
                        Push
                      </button>
                      <button
                        onClick={handlePullGitHub}
                        disabled={isPulling}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                      >
                        {isPulling ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDown className="h-3 w-3" />}
                        Pull
                      </button>
                    </div>

                    <button
                      onClick={async () => {
                        await api.disconnectGitHub();
                        setGithubStatus({ connected: false, username: null });
                      }}
                      className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Disconnect GitHub
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Supabase Modal */}
            {modal === "supabase" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Supabase</h2>
                  </div>
                  <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {!supabaseStatus.connected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Connect your Supabase project to add database and auth to your app.
                    </p>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                      placeholder="https://your-project.supabase.co"
                    />
                    <input
                      type="password"
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                      placeholder="anon key"
                    />
                    <button
                      onClick={connectSupabase}
                      disabled={!supabaseUrl.trim() || !supabaseKey.trim() || isConnecting}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                      Connect Supabase
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3">
                      <Check className="h-4 w-4 text-success" />
                      <span className="text-sm text-success truncate">Connected to {supabaseStatus.url}</span>
                    </div>

                    <button
                      onClick={handleGenerateClient}
                      disabled={isConnecting}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                      Generate Client + Auth Helpers
                    </button>

                    <button
                      onClick={async () => {
                        if (!currentProjectId) return;
                        setIsConnecting(true);
                        try {
                          await api.generateSupabaseTypes(currentProjectId);
                          const tree = await api.getFileTree(currentProjectId);
                          setFileTree(tree);
                        } catch (err) {
                          console.error("Generate types failed:", err);
                        } finally {
                          setIsConnecting(false);
                        }
                      }}
                      disabled={isConnecting}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                    >
                      Generate Database Types
                    </button>

                    <button
                      onClick={async () => {
                        await api.disconnectSupabase();
                        setSupabaseStatus({ connected: false, url: null });
                      }}
                      className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Disconnect Supabase
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Settings Modal */}
            {modal === "settings" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Project Settings</h2>
                  </div>
                  <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Custom Instructions
                    </label>
                    <p className="text-xs text-muted-foreground mb-2">
                      These instructions are injected into all agent prompts for this project.
                    </p>
                    <textarea
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
                      placeholder="e.g., Use dark theme, prefer shadcn/ui components, always add loading states..."
                    />
                  </div>

                  <button
                    onClick={saveSettings}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    {settingsSaved ? (
                      <>
                        <Check className="h-4 w-4" />
                        Saved!
                      </>
                    ) : (
                      "Save Settings"
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Share Modal */}
            {modal === "share" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Share Project</h2>
                  </div>
                  <button onClick={() => setModal(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Invite form */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Invite by email
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                        placeholder="teammate@example.com"
                        onKeyDown={(e) => { if (e.key === "Enter") handleShare(); }}
                      />
                      <select
                        value={shareRole}
                        onChange={(e) => setShareRole(e.target.value as "viewer" | "editor")}
                        className="rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleShare}
                    disabled={!shareEmail.trim() || isSharing}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSharing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : shareSuccess ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    {shareSuccess ? "Invited!" : "Send Invite"}
                  </button>

                  {/* Members list */}
                  {members.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-2">
                        Members ({members.length})
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {members.map((m) => (
                          <div key={m.id} className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                                {(m.user.name || m.user.email).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {m.user.name || m.user.email}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {m.user.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {m.role === "owner" ? (
                                <span className="flex items-center gap-1 text-[10px] text-primary">
                                  <Crown className="h-3 w-3" /> Owner
                                </span>
                              ) : (
                                <>
                                  <span className="text-[10px] text-muted-foreground capitalize">
                                    {m.role}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveMember(m.id)}
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                    title="Remove member"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
