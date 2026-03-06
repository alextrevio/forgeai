"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Loader2,
  Eye,
  Code2,
  Terminal,
  MessageSquare,
  Zap,
  FileCode2,
  Globe,
  Copy,
  Check,
  AlertCircle,
  Link,
  BarChart3,
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { useEngineActivity } from "@/hooks/useEngineActivity";
import { ConsolePanel, useConsoleCapture } from "./console-panel";
import { CodePanel } from "./code-panel";
import { ResultsPanel } from "./results-panel";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { WorkspaceHeader } from "./workspace-header";

function safeArray<T>(data: T[]): T[];
function safeArray<T>(data: T[] | null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

type ComputerTab = "preview" | "code" | "terminal" | "console" | "results";
type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_SIZES: Record<DeviceMode, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablet" },
  mobile: { width: "375px", label: "Mobile" },
};

const TABS: { id: ComputerTab; label: string; icon: React.ReactNode }[] = [
  { id: "preview", label: "Preview", icon: <Eye className="h-3.5 w-3.5" /> },
  { id: "code", label: "Code", icon: <Code2 className="h-3.5 w-3.5" /> },
  { id: "terminal", label: "Terminal", icon: <Terminal className="h-3.5 w-3.5" /> },
  { id: "console", label: "Console", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { id: "results", label: "Results", icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

const IFRAME_LOAD_TIMEOUT = 15000;

const BUILD_TEXTS = [
  "Configurando la estructura del proyecto...",
  "Instalando dependencias...",
  "Creando componentes...",
  "Configurando estilos...",
  "Conectando rutas...",
  "Añadiendo interactividad...",
  "Puliendo la interfaz...",
  "Ejecutando verificaciones finales...",
];

function TerminalTab({ terminalLines, terminalEndRef, projectId }: {
  terminalLines: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  terminalEndRef: any;
  projectId: string | null;
}) {
  const [cmdInput, setCmdInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const { addTerminalOutput } = useProjectStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRunCommand = useCallback(async () => {
    const cmd = cmdInput.trim();
    if (!cmd || !projectId || isRunning) return;
    setIsRunning(true);
    setCmdInput("");
    addTerminalOutput(`$ ${cmd}`);
    try {
      const result = await api.executeTerminalCommand(projectId, cmd);
      if (result.stdout) addTerminalOutput(result.stdout);
      if (result.stderr) addTerminalOutput(result.stderr);
    } catch (err) {
      addTerminalOutput(`Error: ${err instanceof Error ? err.message : "Command failed"}`);
    } finally {
      setIsRunning(false);
      inputRef.current?.focus();
    }
  }, [cmdInput, projectId, isRunning, addTerminalOutput]);

  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px]">
        {terminalLines.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Terminal className="h-8 w-8 text-[#8888a0]/15 mx-auto mb-3" />
              <p className="text-[#8888a0]/30">Sin output de terminal</p>
            </div>
          </div>
        ) : (
          <>
            {terminalLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "py-0.5 whitespace-pre-wrap break-all leading-relaxed",
                  line.startsWith("$") ? "text-[#22c55e] font-medium" :
                  line.toLowerCase().includes("error") || line.toLowerCase().includes("fail") ? "text-[#f87171]" :
                  line.toLowerCase().includes("warn") ? "text-[#fbbf24]" :
                  line.toLowerCase().includes("success") || line.toLowerCase().includes("done") || line.toLowerCase().includes("ready") ? "text-[#4ade80]" :
                  line.includes("http://") || line.includes("https://") ? "text-[#60a5fa]" :
                  "text-[#8888a0]"
                )}
              >
                {line.startsWith("$") ? (
                  <><span className="text-[#7c3aed]">arya $</span> <span className="text-[#EDEDED]">{line.slice(1).trim()}</span></>
                ) : line}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </>
        )}
      </div>

      {/* Terminal input */}
      <div className="border-t border-[#2A2A2A] px-3 py-2 flex items-center gap-2 font-mono text-[11px]">
        <span className="text-[#7c3aed] shrink-0">arya $</span>
        <input
          ref={inputRef}
          type="text"
          value={cmdInput}
          onChange={(e) => setCmdInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleRunCommand(); }}
          placeholder="Enter command..."
          disabled={!projectId || isRunning}
          className="flex-1 bg-transparent text-[#EDEDED] outline-none placeholder:text-[#8888a0]/30 disabled:opacity-40"
        />
        {isRunning && <Loader2 className="h-3 w-3 text-[#7c3aed] animate-spin shrink-0" />}
      </div>
    </div>
  );
}

export function ComputerPanel() {
  const {
    previewUrl,
    sandboxStatus,
    consoleEntries,
    addConsoleEntry,
    clearConsoleEntries,
    isAgentRunning,
    currentPlan,
    changedFiles,
    activeAgent,
    activeFilePath,
    terminalOutput,
    currentProjectId,
    previewAutoSwitch,
    setPreviewAutoSwitch,
  } = useProjectStore();

  const engine = useEngineActivity(currentProjectId);

  const [activeTab, setActiveTab] = useState<ComputerTab>("preview");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [urlInput, setUrlInput] = useState(previewUrl || "");
  const [buildTextIdx, setBuildTextIdx] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useConsoleCapture(addConsoleEntry);

  useEffect(() => { if (previewUrl) setUrlInput(previewUrl); }, [previewUrl]);

  // Auto-switch to Preview or Results tab when engine completes
  useEffect(() => {
    if (previewAutoSwitch) {
      if (previewUrl) {
        setActiveTab("preview");
      } else if (engine.planSteps.filter((s) => s.status === "completed").length > 0) {
        setActiveTab("results");
      }
      setPreviewAutoSwitch(false);
    }
  }, [previewAutoSwitch, previewUrl, setPreviewAutoSwitch, engine.planSteps]);

  useEffect(() => {
    if (!isAgentRunning) return;
    const interval = setInterval(() => setBuildTextIdx((i) => (i + 1) % BUILD_TEXTS.length), 3000);
    return () => clearInterval(interval);
  }, [isAgentRunning]);

  useEffect(() => {
    if (previewUrl) {
      setIframeLoading(true); setIframeError(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIframeLoading((loading) => { if (loading) { setIframeError(true); return false; } return loading; });
      }, IFRAME_LOAD_TIMEOUT);
    } else { setIframeLoading(false); setIframeError(false); }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [previewUrl]);

  useEffect(() => {
    if (activeTab === "terminal") terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalOutput, activeTab]);

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
      try { await navigator.clipboard.writeText(previewUrl); } catch { /* noop */ }
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  }, [previewUrl]);

  const { stepsTotal, stepsCompleted, currentStepText, progressPercent } = useMemo(() => {
    if (!currentPlan?.steps?.length) return { stepsTotal: 0, stepsCompleted: 0, currentStepText: "", progressPercent: 0 };
    const steps = safeArray(currentPlan.steps);
    const total = steps.length;
    const completed = steps.filter((s: { status: string }) => s.status === "completed").length;
    const inProgress = steps.find((s: { status: string }) => s.status === "in_progress");
    return { stepsTotal: total, stepsCompleted: completed, currentStepText: inProgress?.description || "", progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [currentPlan]);

  const recentFiles = useMemo(() => {
    try { return Array.from(changedFiles instanceof Set ? changedFiles : new Set<string>()).slice(-5); } catch { return []; }
  }, [changedFiles]);

  const deviceConfig = DEVICE_SIZES[deviceMode];
  const showBuildAnimation = isAgentRunning && !previewUrl;

  const subHeaderText = useMemo(() => {
    if (!isAgentRunning) return null;
    if (activeAgent === "coder" && activeFilePath) {
      const fileName = activeFilePath.split("/").pop();
      return `Arya está editando ${fileName}`;
    }
    if (activeAgent === "designer") return "Arya está diseñando componentes";
    if (activeAgent === "debugger") return "Arya está corrigiendo errores";
    if (activeAgent === "deployer") return "Arya está desplegando";
    if (activeAgent === "planner") return "Arya está planificando";
    if (currentStepText) return currentStepText;
    return "Arya está pensando...";
  }, [isAgentRunning, activeAgent, activeFilePath, currentStepText]);

  const terminalLines = safeArray(terminalOutput);
  const consoleCount = Array.isArray(consoleEntries) ? consoleEntries.length : 0;

  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center">
            <Monitor className="h-3 w-3 text-white" />
          </div>
          <span className="text-[13px] font-semibold text-[#EDEDED]">Computadora de Arya</span>
        </div>
        <WorkspaceHeader />
      </div>

      {/* ─── Agent activity sub-header ─── */}
      {isAgentRunning && subHeaderText && (
        <div className="flex items-center gap-2 border-b border-[#2A2A2A] bg-[#0A0A0A]/80 px-4 py-1.5">
          <Loader2 className="h-3 w-3 text-[#7c3aed] animate-spin shrink-0" />
          <span className="text-[11px] text-[#8888a0] truncate">{subHeaderText}</span>
        </div>
      )}

      {/* ─── Tab bar with animated underline ─── */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] bg-[#0A0A0A] px-2">
        <div className="flex items-center">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium transition-colors duration-200",
                activeTab === tab.id
                  ? "text-[#EDEDED]"
                  : "text-[#8888a0] hover:text-[#EDEDED]"
              )}
            >
              {tab.icon}
              {tab.label}
              {/* Badge for terminal/console */}
              {tab.id === "terminal" && terminalLines.length > 0 && activeTab !== "terminal" && (
                <span className="ml-1 rounded-full bg-[#7c3aed]/15 px-1.5 py-0.5 text-[9px] text-[#a78bfa]">
                  {terminalLines.length}
                </span>
              )}
              {tab.id === "console" && consoleCount > 0 && activeTab !== "console" && (
                <span className="ml-1 rounded-full bg-[#7c3aed]/15 px-1.5 py-0.5 text-[9px] text-[#a78bfa]">
                  {consoleCount > 99 ? "99+" : consoleCount}
                </span>
              )}
              {tab.id === "results" && engine.planSteps.filter((s) => s.status === "completed").length > 0 && activeTab !== "results" && (
                <span className="ml-1 rounded-full bg-[#22c55e]/15 px-1.5 py-0.5 text-[9px] text-[#4ade80]">
                  {engine.planSteps.filter((s) => s.status === "completed").length}
                </span>
              )}
              {/* Animated underline */}
              <span className={cn(
                "absolute bottom-0 left-0 right-0 h-[2px] bg-[#7c3aed] transition-transform duration-200 origin-center",
                activeTab === tab.id ? "scale-x-100" : "scale-x-0"
              )} />
            </button>
          ))}
        </div>

        {/* Right-side toolbar (preview only) */}
        {activeTab === "preview" && (
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-lg bg-[#111114] p-0.5">
              {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((mode) => {
                const Icon = mode === "desktop" ? Monitor : mode === "tablet" ? Tablet : Smartphone;
                return (
                  <button key={mode} onClick={() => setDeviceMode(mode)}
                    className={cn("rounded-md p-1.5 transition-all duration-150", deviceMode === mode ? "bg-[#7c3aed]/15 text-[#a78bfa]" : "text-[#8888a0] hover:text-[#EDEDED]")}
                    title={DEVICE_SIZES[mode].label}>
                    <Icon className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
            <button onClick={handleRefresh} className="rounded-lg p-1.5 text-[#8888a0] hover:text-[#EDEDED] hover:bg-[#161619] transition-all duration-150" title="Refresh">
              <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
            </button>
            <button onClick={handleOpenExternal} disabled={!previewUrl} className="rounded-lg p-1.5 text-[#8888a0] hover:text-[#EDEDED] hover:bg-[#161619] transition-all duration-150 disabled:opacity-30" title="Abrir en nueva pestaña">
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* ─── Browser chrome URL bar (Preview tab only) ─── */}
      {activeTab === "preview" && (
        <div className="flex items-center gap-2.5 border-b border-[#2A2A2A] bg-[#0A0A0A] px-3 py-1.5">
          {/* Traffic lights with live status */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="h-[10px] w-[10px] rounded-full bg-[#ef4444]/60" />
            <div className={cn(
              "h-[10px] w-[10px] rounded-full",
              isAgentRunning ? "bg-[#f59e0b] animate-pulse" : "bg-[#f59e0b]/60"
            )} />
            <div className={cn(
              "h-[10px] w-[10px] rounded-full",
              previewUrl && !iframeError ? "bg-[#22c55e]" : "bg-[#22c55e]/60"
            )} />
          </div>

          {/* URL bar */}
          <div className="flex-1 flex items-center gap-1.5 rounded-lg bg-[#111114] border border-[#2A2A2A] px-2.5 py-1">
            <Link className="h-3 w-3 text-[#8888a0]/40 shrink-0" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && iframeRef.current && urlInput.trim()) { iframeRef.current.src = urlInput.trim(); setIframeLoading(true); setIframeError(false); } }}
              readOnly={!previewUrl}
              className="flex-1 bg-transparent text-[11px] text-[#8888a0] font-mono outline-none placeholder:text-[#8888a0]/30 min-w-0"
              placeholder="Sin vista previa disponible"
            />
            {previewUrl && (
              <button onClick={handleCopyUrl} className="rounded p-0.5 text-[#8888a0] hover:text-[#EDEDED] transition-all duration-150 shrink-0" title="Copiar URL">
                {copied ? <Check className="h-3 w-3 text-[#22c55e]" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* Open external */}
          <button onClick={handleOpenExternal} disabled={!previewUrl} className="rounded p-1 text-[#8888a0]/40 hover:text-[#8888a0] transition-colors disabled:opacity-30 shrink-0">
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ─── Tab Content ─── */}
      <div className="flex-1 overflow-hidden">

        {/* === Preview Tab === */}
        {activeTab === "preview" && (
          <div className="h-full flex items-start justify-center overflow-auto bg-[#0A0A0A] p-4">
            {showBuildAnimation ? (
              <div className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: "linear-gradient(#7c3aed 1px, transparent 1px), linear-gradient(90deg, #7c3aed 1px, transparent 1px)",
                  backgroundSize: "40px 40px",
                }} />
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] opacity-20 blur-xl animate-pulse" />
                  <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center shadow-lg shadow-[#7c3aed]/20">
                    <Zap className="h-7 w-7 text-white" />
                  </div>
                </div>
                <p className="text-[14px] text-[#EDEDED] font-medium mb-1">{currentStepText || BUILD_TEXTS[buildTextIdx]}</p>
                {stepsTotal > 0 && (
                  <p className="text-[11px] text-[#8888a0] mb-5">Paso {stepsCompleted + (stepsCompleted < stepsTotal ? 1 : 0)} de {stepsTotal}</p>
                )}
                <div className="w-64 h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden mb-6">
                  {stepsTotal > 0 ? (
                    <div className="h-full rounded-full progress-bar-gradient shimmer-bar transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }} />
                  ) : (
                    <div className="h-full w-1/3 rounded-full progress-bar-gradient animate-pulse" />
                  )}
                </div>
                {recentFiles.length > 0 && (
                  <div className="flex flex-col items-center gap-1.5 max-w-[300px]">
                    {recentFiles.map((file) => (
                      <div key={file} className="flex items-center gap-2 rounded-lg bg-[#111114] border border-[#2A2A2A] px-3 py-1.5 file-slide-in">
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
                    <h3 className="text-[13px] font-medium text-[#EDEDED] mb-1">Configurando sandbox...</h3>
                    <p className="text-[12px] text-[#8888a0]">Creando tu entorno de desarrollo</p>
                  </>
                ) : (
                  <>
                    <div className="mb-5">
                      <svg width="120" height="80" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="10" y="5" width="100" height="65" rx="8" stroke="#2A2A2A" strokeWidth="2" />
                        <rect x="10" y="5" width="100" height="14" rx="8" fill="#111114" />
                        <rect x="10" y="17" width="100" height="2" fill="#2A2A2A" />
                        <circle cx="20" cy="12" r="2.5" fill="#ef4444" opacity="0.4" />
                        <circle cx="28" cy="12" r="2.5" fill="#f59e0b" opacity="0.4" />
                        <circle cx="36" cy="12" r="2.5" fill="#22c55e" opacity="0.4" />
                        <rect x="44" y="9.5" width="40" height="5" rx="2.5" fill="#2A2A2A" />
                        <rect x="30" y="30" width="60" height="4" rx="2" fill="#2A2A2A" />
                        <rect x="38" y="38" width="44" height="3" rx="1.5" fill="#2A2A2A" opacity="0.5" />
                        <rect x="45" y="48" width="30" height="8" rx="4" fill="#7c3aed" opacity="0.15" />
                        <text x="60" y="54" textAnchor="middle" fill="#7c3aed" fontSize="5" opacity="0.4">Preview</text>
                      </svg>
                    </div>
                    <h3 className="text-[13px] font-medium text-[#EDEDED] mb-1">Sin vista previa</h3>
                    <p className="text-[12px] text-[#8888a0] max-w-[250px] leading-relaxed">
                      Envía un mensaje en el chat para comenzar. La vista previa aparecerá aquí.
                    </p>
                  </>
                )}
              </div>

            ) : (
              <div className={cn(
                "h-full bg-white overflow-hidden transition-all duration-300 relative",
                deviceMode !== "desktop" ? "rounded-xl border border-[#2A2A2A] shadow-2xl" : "rounded-none"
              )} style={{ width: deviceConfig.width, maxWidth: "100%" }}>
                {iframeLoading && !iframeError && (
                  <div className="absolute inset-0 z-10 bg-[#0A0A0A] p-6 space-y-4">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="h-8 w-8 rounded-lg bg-[#161619] skeleton-shimmer" />
                      <div className="h-4 w-32 rounded-md bg-[#161619] skeleton-shimmer" />
                    </div>
                    <div className="h-6 w-3/4 rounded-md bg-[#161619] skeleton-shimmer" />
                    <div className="h-4 w-1/2 rounded-md bg-[#161619] skeleton-shimmer" />
                    <div className="h-40 w-full rounded-xl bg-[#161619] skeleton-shimmer mt-4" />
                  </div>
                )}
                {iframeError && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0A0A0A]/95 backdrop-blur-sm">
                    <AlertCircle className="h-10 w-10 text-[#ef4444] mb-3" />
                    <h3 className="text-[13px] font-medium text-[#EDEDED] mb-1">Error al cargar la vista previa</h3>
                    <p className="text-[12px] text-[#8888a0] mb-4 max-w-[220px] text-center leading-relaxed">El servidor puede estar iniciando.</p>
                    <button onClick={handleRetry} className="inline-flex items-center gap-1.5 rounded-lg btn-gradient px-3 py-1.5 text-[11px] font-medium text-white">
                      <RefreshCw className="h-3 w-3" /> Reintentar
                    </button>
                  </div>
                )}
                <iframe ref={iframeRef} src={previewUrl} className="h-full w-full border-0" title="App Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" onLoad={handleIframeLoad} onError={handleIframeError} />
              </div>
            )}
          </div>
        )}

        {/* === Code Tab === */}
        {activeTab === "code" && <CodePanel />}

        {/* === Terminal Tab === */}
        {activeTab === "terminal" && (
          <TerminalTab
            terminalLines={terminalLines}
            terminalEndRef={terminalEndRef}
            projectId={currentProjectId}
          />
        )}

        {/* === Console Tab === */}
        {activeTab === "console" && (
          <ConsolePanel entries={consoleEntries} onClear={clearConsoleEntries} />
        )}

        {/* === Results Tab === */}
        {activeTab === "results" && (
          <ResultsPanel planSteps={engine.planSteps} />
        )}
      </div>
    </div>
  );
}
