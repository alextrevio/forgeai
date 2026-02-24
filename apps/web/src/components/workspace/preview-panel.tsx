"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Loader2,
  Globe,
  Copy,
  Check,
  AlertCircle,
  Terminal,
  Zap,
  FileCode2,
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { ConsolePanel, useConsoleCapture } from "./console-panel";
import { cn } from "@/lib/utils";

type PreviewTab = "preview" | "console";
type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_SIZES: Record<DeviceMode, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablet" },
  mobile: { width: "375px", label: "Mobile" },
};

const IFRAME_LOAD_TIMEOUT = 15000;

const BUILD_TEXTS = [
  "Setting up project structure...",
  "Installing dependencies...",
  "Creating components...",
  "Configuring styles...",
  "Wiring up routes...",
  "Adding interactivity...",
  "Polishing the UI...",
  "Running final checks...",
];

export function PreviewPanel() {
  const {
    previewUrl,
    sandboxStatus,
    consoleEntries,
    addConsoleEntry,
    clearConsoleEntries,
    isAgentRunning,
    currentPlan,
    changedFiles,
  } = useProjectStore();
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");
  const [urlInput, setUrlInput] = useState(previewUrl || "");
  const [buildTextIdx, setBuildTextIdx] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useConsoleCapture(addConsoleEntry);

  useEffect(() => {
    if (previewUrl) setUrlInput(previewUrl);
  }, [previewUrl]);

  // Rotate build status text every 3s
  useEffect(() => {
    if (!isAgentRunning) return;
    const interval = setInterval(() => setBuildTextIdx((i) => (i + 1) % BUILD_TEXTS.length), 3000);
    return () => clearInterval(interval);
  }, [isAgentRunning]);

  useEffect(() => {
    if (previewUrl) {
      setIframeLoading(true);
      setIframeError(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIframeLoading((loading) => { if (loading) { setIframeError(true); return false; } return loading; });
      }, IFRAME_LOAD_TIMEOUT);
    } else {
      setIframeLoading(false);
      setIframeError(false);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [previewUrl]);

  const handleIframeLoad = useCallback(() => { setIframeLoading(false); setIframeError(false); if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  const handleIframeError = useCallback(() => { setIframeLoading(false); setIframeError(true); if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) { setIsRefreshing(true); setIframeLoading(true); setIframeError(false); iframeRef.current.src = iframeRef.current.src; setTimeout(() => setIsRefreshing(false), 1000); }
  }, []);

  const handleRetry = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      setIframeLoading(true); setIframeError(false); iframeRef.current.src = previewUrl;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => { setIframeLoading((l) => { if (l) { setIframeError(true); return false; } return l; }); }, IFRAME_LOAD_TIMEOUT);
    }
  }, [previewUrl]);

  const handleOpenExternal = useCallback(() => { if (previewUrl) window.open(previewUrl, "_blank"); }, [previewUrl]);

  const handleCopyUrl = useCallback(async () => {
    if (previewUrl) {
      try { await navigator.clipboard.writeText(previewUrl); } catch { const t = document.createElement("textarea"); t.value = previewUrl; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); }
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  }, [previewUrl]);

  const { stepsTotal, stepsCompleted, currentStepText, progressPercent } = useMemo(() => {
    if (!currentPlan?.steps?.length) return { stepsTotal: 0, stepsCompleted: 0, currentStepText: "", progressPercent: 0 };
    const total = currentPlan.steps.length;
    const completed = currentPlan.steps.filter((s: { status: string }) => s.status === "completed").length;
    const inProgress = currentPlan.steps.find((s: { status: string }) => s.status === "in_progress");
    return {
      stepsTotal: total,
      stepsCompleted: completed,
      currentStepText: inProgress?.description || "",
      progressPercent: Math.round((completed / total) * 100),
    };
  }, [currentPlan]);

  const recentFiles = useMemo(() => {
    try { return Array.from(changedFiles || []).slice(-5); } catch { return []; }
  }, [changedFiles]);

  const deviceConfig = DEVICE_SIZES[deviceMode];
  const showBuildAnimation = isAgentRunning && !previewUrl;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0f]">
      {/* Browser-style Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-[#0e0e14] px-3 py-1.5">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1.5 mr-3">
            <div className="h-2.5 w-2.5 rounded-full bg-[#ef4444]/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#22c55e]/60" />
          </div>
          <button onClick={() => setActiveTab("preview")}
            className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
              activeTab === "preview" ? "bg-[#7c3aed]/10 text-[#a78bfa]" : "text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#1a1a24]"
            )}>
            <Globe className="h-3 w-3" /> Preview
          </button>
          <button onClick={() => setActiveTab("console")}
            className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-150 relative",
              activeTab === "console" ? "bg-[#7c3aed]/10 text-[#a78bfa]" : "text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#1a1a24]"
            )}>
            <Terminal className="h-3 w-3" /> Console
            {consoleEntries.length > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 min-w-[14px] rounded-full bg-[#7c3aed] text-[8px] text-white flex items-center justify-center px-0.5">
                {consoleEntries.length > 99 ? "99+" : consoleEntries.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-lg bg-[#13131a] p-0.5">
            {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((mode) => {
              const Icon = mode === "desktop" ? Monitor : mode === "tablet" ? Tablet : Smartphone;
              return (
                <button key={mode} onClick={() => setDeviceMode(mode)}
                  className={cn("rounded-md p-1.5 transition-all duration-150", deviceMode === mode ? "bg-[#7c3aed]/15 text-[#a78bfa]" : "text-[#8888a0] hover:text-[#e2e2e8]")}
                  title={DEVICE_SIZES[mode].label}>
                  <Icon className="h-3 w-3" />
                </button>
              );
            })}
          </div>
          <div className="mx-1 h-3.5 w-px bg-border" />
          <button onClick={handleRefresh} className="rounded-lg p-1.5 text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#1a1a24] transition-all duration-150" title="Refresh">
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
          </button>
          <button onClick={handleOpenExternal} disabled={!previewUrl} className="rounded-lg p-1.5 text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#1a1a24] transition-all duration-150 disabled:opacity-30" title="Open in new tab">
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* URL Bar */}
      {activeTab === "preview" && (
        <div className="flex items-center gap-2 border-b border-border bg-[#0e0e14] px-3 py-1">
          <Globe className="h-3 w-3 text-[#8888a0]/40 shrink-0" />
          <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && iframeRef.current && urlInput.trim()) { iframeRef.current.src = urlInput.trim(); setIframeLoading(true); setIframeError(false); } }}
            className="flex-1 bg-transparent px-1 py-0.5 text-[11px] text-[#8888a0] font-mono outline-none placeholder:text-[#8888a0]/30 min-w-0"
            placeholder="No preview available" />
          {previewUrl && (
            <button onClick={handleCopyUrl} className="rounded p-1 text-[#8888a0] hover:text-[#e2e2e8] transition-all duration-150 shrink-0" title="Copy URL">
              {copied ? <Check className="h-3 w-3 text-[#22c55e]" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>
      )}

      {activeTab === "console" && (
        <div className="flex-1 overflow-hidden">
          <ConsolePanel entries={consoleEntries} onClear={clearConsoleEntries} />
        </div>
      )}

      {activeTab === "preview" && (
        <div className="flex-1 flex items-start justify-center overflow-auto bg-[#0a0a0f] p-4">
          {showBuildAnimation ? (
            <div className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden">
              {/* Grid background */}
              <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: "linear-gradient(#7c3aed 1px, transparent 1px), linear-gradient(90deg, #7c3aed 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }} />

              {/* Pulsing logo */}
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] opacity-20 blur-xl animate-pulse" />
                <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center shadow-lg shadow-[#7c3aed]/20">
                  <Zap className="h-7 w-7 text-white" />
                </div>
              </div>

              <p className="text-sm text-[#e2e2e8] font-medium mb-1 transition-all duration-300">
                {currentStepText || BUILD_TEXTS[buildTextIdx]}
              </p>

              {stepsTotal > 0 && (
                <p className="text-[11px] text-[#8888a0] mb-5">
                  Step {stepsCompleted + (stepsCompleted < stepsTotal ? 1 : 0)} of {stepsTotal}
                </p>
              )}

              <div className="w-56 h-1.5 rounded-full bg-[#1a1a24] overflow-hidden mb-6">
                {stepsTotal > 0 ? (
                  <div className="h-full rounded-full progress-animated transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }} />
                ) : (
                  <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] animate-pulse" />
                )}
              </div>

              {recentFiles.length > 0 && (
                <div className="flex flex-col items-center gap-1.5 max-w-[300px]">
                  {recentFiles.map((file) => (
                    <div key={file} className="flex items-center gap-2 rounded-lg bg-[#13131a] border border-border px-3 py-1.5 animate-fade-in">
                      <FileCode2 className="h-3 w-3 text-[#3b82f6] shrink-0" />
                      <span className="text-[11px] text-[#8888a0] font-mono truncate">{file}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          ) : !previewUrl ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              {sandboxStatus === "creating" ? (
                <>
                  <div className="h-16 w-16 rounded-2xl bg-[#7c3aed]/5 flex items-center justify-center mb-4">
                    <Loader2 className="h-8 w-8 text-[#7c3aed] animate-spin" />
                  </div>
                  <h3 className="text-[13px] font-medium text-[#e2e2e8] mb-1">Setting up sandbox...</h3>
                  <p className="text-xs text-[#8888a0]">Creating your development environment</p>
                </>
              ) : (
                <>
                  <div className="mb-5">
                    <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="10" y="5" width="100" height="65" rx="8" stroke="#1e1e2e" strokeWidth="2" />
                      <rect x="10" y="5" width="100" height="14" rx="8" fill="#13131a" />
                      <rect x="10" y="17" width="100" height="2" fill="#1e1e2e" />
                      <circle cx="20" cy="12" r="2.5" fill="#ef4444" opacity="0.4" />
                      <circle cx="28" cy="12" r="2.5" fill="#f59e0b" opacity="0.4" />
                      <circle cx="36" cy="12" r="2.5" fill="#22c55e" opacity="0.4" />
                      <rect x="44" y="9.5" width="40" height="5" rx="2.5" fill="#1e1e2e" />
                      <rect x="30" y="30" width="60" height="4" rx="2" fill="#1e1e2e" />
                      <rect x="38" y="38" width="44" height="3" rx="1.5" fill="#1e1e2e" opacity="0.5" />
                      <rect x="45" y="48" width="30" height="8" rx="4" fill="#7c3aed" opacity="0.15" />
                      <text x="60" y="54" textAnchor="middle" fill="#7c3aed" fontSize="5" opacity="0.4">Preview</text>
                    </svg>
                  </div>
                  <h3 className="text-[13px] font-medium text-[#e2e2e8] mb-1">No preview yet</h3>
                  <p className="text-xs text-[#8888a0] max-w-[250px] leading-relaxed">
                    Send a message in chat to start building. The preview will appear here.
                  </p>
                </>
              )}
            </div>

          ) : (
            <div className={cn("h-full bg-white rounded-xl overflow-hidden transition-all duration-300 relative",
              deviceMode !== "desktop" && "border border-border shadow-2xl")}
              style={{ width: deviceConfig.width, maxWidth: "100%" }}>
              {iframeLoading && !iframeError && (
                <div className="absolute inset-0 z-10 bg-[#0e0e14] p-6 space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-[#1a1a24] skeleton-shimmer" />
                    <div className="h-4 w-32 rounded-md bg-[#1a1a24] skeleton-shimmer" />
                    <div className="flex-1" />
                    <div className="h-4 w-16 rounded-md bg-[#1a1a24] skeleton-shimmer" />
                    <div className="h-4 w-16 rounded-md bg-[#1a1a24] skeleton-shimmer" />
                  </div>
                  <div className="h-6 w-3/4 rounded-md bg-[#1a1a24] skeleton-shimmer" />
                  <div className="h-4 w-1/2 rounded-md bg-[#1a1a24] skeleton-shimmer" />
                  <div className="h-40 w-full rounded-xl bg-[#1a1a24] skeleton-shimmer mt-4" />
                </div>
              )}

              {iframeError && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0e0e14]/95 backdrop-blur-sm">
                  <AlertCircle className="h-10 w-10 text-[#ef4444] mb-3" />
                  <h3 className="text-[13px] font-medium text-[#e2e2e8] mb-1">Preview failed to load</h3>
                  <p className="text-xs text-[#8888a0] mb-4 max-w-[220px] text-center leading-relaxed">The server may still be starting up.</p>
                  <button onClick={handleRetry} className="inline-flex items-center gap-1.5 rounded-lg btn-gradient px-3 py-1.5 text-[11px] font-medium text-white">
                    <RefreshCw className="h-3 w-3" /> Retry
                  </button>
                </div>
              )}

              <iframe ref={iframeRef} src={previewUrl} className="h-full w-full border-0" title="App Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" onLoad={handleIframeLoad} onError={handleIframeError} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
