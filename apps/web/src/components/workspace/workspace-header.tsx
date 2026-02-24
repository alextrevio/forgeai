"use client";

import { useState } from "react";
import {
  Rocket,
  Github,
  Square,
  Undo2,
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
  ChevronRight,
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
  const { user } = useAuthStore();
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
    try { await api.deployProject(currentProjectId); } catch (err) { console.error("Deploy failed:", err); } finally { setTimeout(() => setIsDeploying(false), 2000); }
  };

  const handleStop = async () => {
    if (!currentProjectId) return;
    try { await api.stopAgent(currentProjectId); } catch (err) { console.error("Stop failed:", err); }
  };

  const handleUndo = async () => {
    if (!currentProjectId) return;
    try {
      await api.undoChange(currentProjectId);
      const tree = await api.getFileTree(currentProjectId);
      setFileTree(tree);
      const preview = await api.getPreviewUrl(currentProjectId);
      setPreviewUrl(preview.url);
    } catch (err) { console.error("Undo failed:", err); }
  };

  const handleRestoreSnapshot = async (snapshotId: string) => {
    if (!currentProjectId) return;
    try {
      await api.restoreSnapshot(currentProjectId, snapshotId);
      const tree = await api.getFileTree(currentProjectId);
      setFileTree(tree);
      setShowTimeline(false);
    } catch (err) { console.error("Restore failed:", err); }
  };

  const openGitHub = async () => {
    setModal("github"); setExportResult(null);
    try { const status = await api.getGitHubStatus(); setGithubStatus(status); } catch { /* ignore */ }
  };

  const connectGitHub = async () => {
    if (!githubToken.trim()) return;
    setIsConnecting(true);
    try { const result = await api.connectGitHub(githubToken.trim()); setGithubStatus({ connected: true, username: result.username }); setGithubToken(""); } catch (err) { console.error("GitHub connect failed:", err); } finally { setIsConnecting(false); }
  };

  const handleExportGitHub = async () => {
    if (!currentProjectId) return;
    setIsExporting(true); setExportResult(null);
    try { const result = await api.exportToGitHub(currentProjectId); setExportResult(result.repoUrl); } catch (err) { console.error("Export failed:", err); setExportResult("error"); } finally { setIsExporting(false); }
  };

  const handlePushGitHub = async () => {
    if (!currentProjectId) return;
    setIsPushing(true);
    try { await api.pushToGitHub(currentProjectId); setExportResult("pushed"); } catch (err) { console.error("Push failed:", err); } finally { setIsPushing(false); }
  };

  const handlePullGitHub = async () => {
    if (!currentProjectId) return;
    setIsPulling(true);
    try { await api.pullFromGitHub(currentProjectId); const tree = await api.getFileTree(currentProjectId); setFileTree(tree); setExportResult("pulled"); } catch (err) { console.error("Pull failed:", err); } finally { setIsPulling(false); }
  };

  const openSupabase = async () => {
    setModal("supabase");
    try { const status = await api.getSupabaseStatus(); setSupabaseStatus(status); } catch { /* ignore */ }
  };

  const connectSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) return;
    setIsConnecting(true);
    try { const result = await api.connectSupabase(supabaseUrl.trim(), supabaseKey.trim()); setSupabaseStatus({ connected: true, url: result.url }); setSupabaseUrl(""); setSupabaseKey(""); } catch (err) { console.error("Supabase connect failed:", err); } finally { setIsConnecting(false); }
  };

  const handleGenerateClient = async () => {
    if (!currentProjectId) return;
    setIsConnecting(true);
    try { await api.generateSupabaseClient(currentProjectId); const tree = await api.getFileTree(currentProjectId); setFileTree(tree); } catch (err) { console.error("Generate client failed:", err); } finally { setIsConnecting(false); }
  };

  const openSettings = async () => {
    setModal("settings"); setSettingsSaved(false);
    if (currentProjectId) { try { const project = await api.getProject(currentProjectId); setCustomInstructions(project.customInstructions || ""); } catch { /* ignore */ } }
  };

  const saveSettings = async () => {
    if (!currentProjectId) return;
    try { await api.updateProjectSettings(currentProjectId, { customInstructions }); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000); } catch (err) { console.error("Save settings failed:", err); }
  };

  const handleDownloadZip = async () => {
    if (!currentProjectId) return;
    setIsDownloading(true);
    try { const blob = await api.exportZip(currentProjectId); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${projectName || "project"}.zip`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch (err) { console.error("Download ZIP failed:", err); } finally { setIsDownloading(false); }
  };

  const openShare = async () => {
    setModal("share"); setShareEmail(""); setShareSuccess(false);
    if (currentProjectId) { try { const data = await api.getProjectMembers(currentProjectId); setMembers(data.members || data || []); } catch { /* ignore */ } }
  };

  const handleShare = async () => {
    if (!currentProjectId || !shareEmail.trim()) return;
    setIsSharing(true);
    try { await api.shareProject(currentProjectId, shareEmail.trim(), shareRole); setShareSuccess(true); setShareEmail(""); setTimeout(() => setShareSuccess(false), 2000); const data = await api.getProjectMembers(currentProjectId); setMembers(data.members || data || []); } catch (err) { console.error("Share failed:", err); } finally { setIsSharing(false); }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentProjectId) return;
    try { await api.removeProjectMember(currentProjectId, memberId); setMembers((prev) => prev.filter((m) => m.id !== memberId)); } catch (err) { console.error("Remove member failed:", err); }
  };

  const IconBtn = ({ onClick, title, children, className: extra }: { onClick: () => void; title: string; children: React.ReactNode; className?: string }) => (
    <div className="group relative">
      <button onClick={onClick} className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-[#8888a0] hover:bg-[#1a1a24] hover:text-[#e2e2e8] transition-all duration-150", extra)}>
        {children}
      </button>
      <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
        <div className="tooltip-glass rounded-md px-2 py-1 text-[10px] text-[#e2e2e8] shadow-lg">{title}</div>
      </div>
    </div>
  );

  return (
    <>
      <header className="flex h-11 items-center justify-between border-b border-border bg-[#0e0e14] px-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] text-[#8888a0] shrink-0">ForgeAI</span>
          <ChevronRight className="h-3 w-3 text-[#8888a0]/40 shrink-0" />
          <span className="text-[13px] font-medium text-[#e2e2e8] truncate max-w-[200px]">{projectName || "Untitled Project"}</span>
          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", sandboxStatus === "running" ? "bg-[#22c55e]" : sandboxStatus === "creating" ? "bg-[#f59e0b] animate-pulse" : "bg-[#8888a0]/40")} />
          {activeAgent && <span className="text-[10px] text-[#a78bfa] bg-[#7c3aed]/10 rounded-full px-2 py-0.5 capitalize shrink-0">{activeAgent}</span>}
        </div>

        <div className="flex items-center gap-1">
          {isAgentRunning && (
            <button onClick={handleStop} className="flex items-center gap-1.5 rounded-lg bg-[#ef4444]/10 px-2.5 py-1 text-[11px] font-medium text-[#ef4444] hover:bg-[#ef4444]/20 transition-all duration-150">
              <Square className="h-3 w-3" /> Stop
            </button>
          )}
          <IconBtn onClick={handleUndo} title="Undo"><Undo2 className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={() => setShowTimeline(!showTimeline)} title="Timeline" className={showTimeline ? "bg-[#7c3aed]/15 text-[#a78bfa]" : ""}>
            <History className="h-3.5 w-3.5" />
          </IconBtn>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={handleDeploy} disabled={isDeploying || isAgentRunning} className="btn-gradient flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed">
            {isDeploying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
            {isDeploying ? "Deploying..." : "Deploy"}
          </button>
          <div className="mx-1 h-4 w-px bg-border" />
          <IconBtn onClick={handleDownloadZip} title="Download ZIP">{isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</IconBtn>
          <IconBtn onClick={openShare} title="Share"><Share2 className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={openGitHub} title="GitHub"><Github className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={openSupabase} title="Supabase"><Database className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={openSettings} title="Settings"><Settings className="h-3.5 w-3.5" /></IconBtn>
          {members.length > 0 && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <div className="flex items-center -space-x-1.5">
                {members.slice(0, 3).map((m) => (
                  <div key={m.id} className="h-6 w-6 rounded-full bg-[#1a1a24] border-2 border-[#0e0e14] flex items-center justify-center text-[9px] font-medium text-[#8888a0]" title={m.user.name || m.user.email}>
                    {(m.user.name || m.user.email).charAt(0).toUpperCase()}
                  </div>
                ))}
                {members.length > 3 && <div className="h-6 w-6 rounded-full bg-[#1a1a24] border-2 border-[#0e0e14] flex items-center justify-center text-[9px] font-medium text-[#8888a0]">+{members.length - 3}</div>}
              </div>
            </>
          )}
        </div>
      </header>

      {showTimeline && (
        <div className="border-b border-border bg-[#0e0e14] px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#8888a0]">Version Timeline</span>
            <button onClick={() => setShowTimeline(false)} className="text-[#8888a0] hover:text-[#e2e2e8] transition-colors"><X className="h-3 w-3" /></button>
          </div>
          {!Array.isArray(snapshots) || snapshots.length === 0 ? (
            <p className="text-[11px] text-[#8888a0]/60">No snapshots yet. Snapshots are created automatically before each change.</p>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {snapshots.map((snap, i) => (
                <div key={snap.id} className="flex items-center gap-1 shrink-0">
                  {i > 0 && <div className="w-4 h-px bg-border" />}
                  <button onClick={() => handleRestoreSnapshot(snap.id)} className="group flex flex-col items-center gap-1 rounded-xl border border-border px-3 py-2 hover:border-[#7c3aed]/30 hover:bg-[#7c3aed]/5 transition-all duration-150 min-w-[120px]">
                    <div className="h-2 w-2 rounded-full bg-[#7c3aed]/60 group-hover:bg-[#7c3aed]" />
                    <span className="text-[10px] text-[#e2e2e8] font-medium truncate max-w-[100px]">{snap.label}</span>
                    <span className="text-[9px] text-[#8888a0]">{new Date(snap.createdAt).toLocaleTimeString()}</span>
                    <span className="text-[9px] text-[#7c3aed] opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity"><RotateCcw className="h-2 w-2" /> Restore</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-[#13131a] p-6 shadow-2xl animate-fade-in">
            {modal === "github" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Github className="h-5 w-5 text-[#e2e2e8]" /><h2 className="text-lg font-semibold text-[#e2e2e8]">GitHub</h2></div>
                  <button onClick={() => setModal(null)} className="text-[#8888a0] hover:text-[#e2e2e8] transition-colors"><X className="h-4 w-4" /></button>
                </div>
                {!githubStatus.connected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[#8888a0]">Connect your GitHub account with a personal access token.</p>
                    <input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} className="w-full rounded-xl border border-border bg-[#0a0a0f] px-4 py-2.5 text-sm text-[#e2e2e8] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed]/50 transition-colors" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" />
                    <button onClick={connectGitHub} disabled={!githubToken.trim() || isConnecting} className="w-full flex items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{isConnecting && <Loader2 className="h-4 w-4 animate-spin" />} Connect GitHub</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl bg-[#22c55e]/10 p-3"><Check className="h-4 w-4 text-[#22c55e]" /><span className="text-sm text-[#22c55e]">Connected as @{githubStatus.username}</span></div>
                    {exportResult && exportResult !== "error" && exportResult !== "pushed" && exportResult !== "pulled" && (
                      <div className="flex items-center gap-2 rounded-xl bg-[#7c3aed]/10 p-3"><ExternalLink className="h-4 w-4 text-[#a78bfa]" /><a href={exportResult} target="_blank" rel="noopener noreferrer" className="text-sm text-[#a78bfa] hover:underline truncate">{exportResult}</a></div>
                    )}
                    {exportResult === "pushed" && <div className="rounded-xl bg-[#22c55e]/10 p-3 text-sm text-[#22c55e]">Changes pushed!</div>}
                    {exportResult === "pulled" && <div className="rounded-xl bg-[#22c55e]/10 p-3 text-sm text-[#22c55e]">Files pulled!</div>}
                    <button onClick={handleExportGitHub} disabled={isExporting} className="w-full flex items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />} Export to New Repo</button>
                    <div className="flex gap-2">
                      <button onClick={handlePushGitHub} disabled={isPushing} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#1a1a24] px-3 py-2 text-sm font-medium text-[#e2e2e8] hover:bg-[#1e1e2e] disabled:opacity-50 transition-colors">{isPushing ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUp className="h-3 w-3" />} Push</button>
                      <button onClick={handlePullGitHub} disabled={isPulling} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#1a1a24] px-3 py-2 text-sm font-medium text-[#e2e2e8] hover:bg-[#1e1e2e] disabled:opacity-50 transition-colors">{isPulling ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDown className="h-3 w-3" />} Pull</button>
                    </div>
                    <button onClick={async () => { await api.disconnectGitHub(); setGithubStatus({ connected: false, username: null }); }} className="w-full text-xs text-[#8888a0] hover:text-[#ef4444] transition-colors">Disconnect GitHub</button>
                  </div>
                )}
              </>
            )}

            {modal === "supabase" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Database className="h-5 w-5 text-[#e2e2e8]" /><h2 className="text-lg font-semibold text-[#e2e2e8]">Supabase</h2></div>
                  <button onClick={() => setModal(null)} className="text-[#8888a0] hover:text-[#e2e2e8] transition-colors"><X className="h-4 w-4" /></button>
                </div>
                {!supabaseStatus.connected ? (
                  <div className="space-y-3">
                    <p className="text-sm text-[#8888a0]">Connect your Supabase project to add database and auth.</p>
                    <input type="text" value={supabaseUrl} onChange={(e) => setSupabaseUrl(e.target.value)} className="w-full rounded-xl border border-border bg-[#0a0a0f] px-4 py-2.5 text-sm text-[#e2e2e8] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed]/50 transition-colors" placeholder="https://your-project.supabase.co" />
                    <input type="password" value={supabaseKey} onChange={(e) => setSupabaseKey(e.target.value)} className="w-full rounded-xl border border-border bg-[#0a0a0f] px-4 py-2.5 text-sm text-[#e2e2e8] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed]/50 transition-colors" placeholder="anon key" />
                    <button onClick={connectSupabase} disabled={!supabaseUrl.trim() || !supabaseKey.trim() || isConnecting} className="w-full flex items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{isConnecting && <Loader2 className="h-4 w-4 animate-spin" />} Connect Supabase</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl bg-[#22c55e]/10 p-3"><Check className="h-4 w-4 text-[#22c55e]" /><span className="text-sm text-[#22c55e] truncate">Connected to {supabaseStatus.url}</span></div>
                    <button onClick={handleGenerateClient} disabled={isConnecting} className="w-full flex items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Generate Client + Auth Helpers</button>
                    <button onClick={async () => { if (!currentProjectId) return; setIsConnecting(true); try { await api.generateSupabaseTypes(currentProjectId); const tree = await api.getFileTree(currentProjectId); setFileTree(tree); } catch (err) { console.error(err); } finally { setIsConnecting(false); } }} disabled={isConnecting} className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#1a1a24] px-4 py-2.5 text-sm font-medium text-[#e2e2e8] hover:bg-[#1e1e2e] disabled:opacity-50 transition-colors">Generate Database Types</button>
                    <button onClick={async () => { await api.disconnectSupabase(); setSupabaseStatus({ connected: false, url: null }); }} className="w-full text-xs text-[#8888a0] hover:text-[#ef4444] transition-colors">Disconnect Supabase</button>
                  </div>
                )}
              </>
            )}

            {modal === "settings" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Settings className="h-5 w-5 text-[#e2e2e8]" /><h2 className="text-lg font-semibold text-[#e2e2e8]">Project Settings</h2></div>
                  <button onClick={() => setModal(null)} className="text-[#8888a0] hover:text-[#e2e2e8] transition-colors"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#e2e2e8] mb-1.5">Custom Instructions</label>
                    <p className="text-xs text-[#8888a0] mb-2">Injected into all agent prompts for this project.</p>
                    <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} rows={6} className="w-full rounded-xl border border-border bg-[#0a0a0f] px-4 py-2.5 text-sm text-[#e2e2e8] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed]/50 resize-none transition-colors" placeholder="e.g., Use dark theme, prefer shadcn/ui components..." />
                  </div>
                  <button onClick={saveSettings} className="w-full flex items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-medium text-white">{settingsSaved ? (<><Check className="h-4 w-4" /> Saved!</>) : "Save Settings"}</button>
                </div>
              </>
            )}

            {modal === "share" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Users className="h-5 w-5 text-[#e2e2e8]" /><h2 className="text-lg font-semibold text-[#e2e2e8]">Share Project</h2></div>
                  <button onClick={() => setModal(null)} className="text-[#8888a0] hover:text-[#e2e2e8] transition-colors"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#e2e2e8] mb-1.5">Invite by email</label>
                    <div className="flex gap-2">
                      <input type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} className="flex-1 rounded-xl border border-border bg-[#0a0a0f] px-3 py-2 text-sm text-[#e2e2e8] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed]/50 transition-colors" placeholder="teammate@example.com" onKeyDown={(e) => { if (e.key === "Enter") handleShare(); }} />
                      <select value={shareRole} onChange={(e) => setShareRole(e.target.value as "viewer" | "editor")} className="rounded-xl border border-border bg-[#0a0a0f] px-2 py-2 text-sm text-[#e2e2e8] outline-none focus:border-[#7c3aed]/50 transition-colors"><option value="editor">Editor</option><option value="viewer">Viewer</option></select>
                    </div>
                  </div>
                  <button onClick={handleShare} disabled={!shareEmail.trim() || isSharing} className="w-full flex items-center justify-center gap-2 rounded-xl btn-gradient px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{isSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : shareSuccess ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {shareSuccess ? "Invited!" : "Send Invite"}</button>
                  {members.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-[#8888a0] mb-2">Members ({members.length})</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {members.map((m) => (
                          <div key={m.id} className="flex items-center justify-between rounded-xl bg-[#1a1a24]/50 px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#7c3aed]/30 to-[#3b82f6]/30 flex items-center justify-center text-[10px] font-medium text-[#a78bfa] shrink-0">{(m.user.name || m.user.email).charAt(0).toUpperCase()}</div>
                              <div className="min-w-0"><p className="text-xs font-medium text-[#e2e2e8] truncate">{m.user.name || m.user.email}</p><p className="text-[10px] text-[#8888a0] truncate">{m.user.email}</p></div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {m.role === "owner" ? <span className="flex items-center gap-1 text-[10px] text-[#a78bfa]"><Crown className="h-3 w-3" /> Owner</span> : (<><span className="text-[10px] text-[#8888a0] capitalize">{m.role}</span><button onClick={() => handleRemoveMember(m.id)} className="text-[#8888a0] hover:text-[#ef4444] transition-colors" title="Remove member"><Trash2 className="h-3 w-3" /></button></>)}
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
