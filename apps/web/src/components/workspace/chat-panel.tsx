"use client";

import * as Sentry from "@sentry/nextjs";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Sparkles,
  ArrowUp,
  Wrench,
  ChevronDown,
  Zap,
  Eye,
  Upload,
  Paperclip,
  X,
  ShoppingCart,
  BarChart3,
  Palette,
  MessageSquare,
  Figma,
  Globe,
  LayoutTemplate,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { useEngineActivity } from "@/hooks/useEngineActivity";
import { api } from "@/lib/api";
import { cn, generateId } from "@/lib/utils";
import { RichMessage } from "./rich-message";
import { SuggestionChips } from "./suggestion-chips";
import { PlanOverview } from "./plan-overview";
import { AgentsPanel } from "./agents-panel";
import { AgentAvatar, getAgentStyle } from "./agent-badge";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import { VoiceWaveform } from "@/components/ui/voice-waveform";

function safeArray<T>(data: T[]): T[];
function safeArray<T>(data: null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

const SUGGESTION_CARDS = [
  {
    icon: <ShoppingCart className="h-5 w-5" />,
    emoji: "",
    title: "E-commerce con carrito y pagos",
    description: "Tienda online completa con catálogo, carrito y checkout",
    prompt: "Crea un e-commerce con carrito de compras y página de pagos",
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    emoji: "",
    title: "Dashboard de analytics",
    description: "Panel de métricas con gráficas interactivas en tiempo real",
    prompt: "Crea un dashboard de analytics con gráficas interactivas",
  },
  {
    icon: <Palette className="h-5 w-5" />,
    emoji: "",
    title: "Portfolio con animaciones",
    description: "Sitio personal con transiciones y efectos visuales modernos",
    prompt: "Crea un portfolio personal con animaciones suaves y moderno",
  },
  {
    icon: <MessageSquare className="h-5 w-5" />,
    emoji: "",
    title: "Chat app en tiempo real",
    description: "Aplicación de mensajería con WebSockets y notificaciones",
    prompt: "Crea una app de chat en tiempo real con WebSockets",
  },
];

const ACTION_CHIPS = [
  { icon: <Figma className="h-3 w-3" />, label: "Importar desde Figma", prompt: "Importar diseño desde Figma: " },
  { icon: <Globe className="h-3 w-3" />, label: "Clonar sitio web", prompt: "Clonar el sitio web: " },
  { icon: <LayoutTemplate className="h-3 w-3" />, label: "Usar template", prompt: "Usar un template de " },
];

const ACCEPTED_FILE_TYPES = ".pdf,.csv,.xlsx,.xls,.docx,.doc,.txt,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.png,.jpg,.jpeg,.gif,.zip,.md,.yaml,.yml,.xml,.sql,.sh";
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;
const MAX_UPLOAD_FILES = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileEmoji(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "\uD83D\uDCC4";
  if (["csv", "xlsx", "xls"].includes(ext)) return "\uD83D\uDCCA";
  if (["txt", "doc", "docx", "md"].includes(ext)) return "\uD83D\uDCDD";
  if (["js", "ts", "tsx", "jsx", "py", "html", "css", "sql", "sh", "go", "rs", "java", "c", "cpp"].includes(ext)) return "\uD83D\uDCBB";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "\uD83D\uDDBC\uFE0F";
  if (ext === "zip") return "\uD83D\uDCE6";
  return "\uD83D\uDCC1";
}

const PLACEHOLDERS = [
  "Describe tu app...",
  "Pega un diseño de Figma...",
  "¿Qué quieres construir hoy?",
  "Describe una landing page...",
  "Crea un dashboard con...",
];

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function getDebugSummary(content: string): string | null {
  if (content.startsWith("Debugger fix:")) return content.replace("Debugger fix: ", "");
  if (content.startsWith("Debugger failed:")) return "No se pudo corregir automáticamente";
  return null;
}

/** Collapsible Step Group */
function StepGroup({ title, steps, defaultExpanded = false }: {
  title: string;
  steps: Array<{ id: number; description: string; status: string }>;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const safeSteps = safeArray<{ id: number; description: string; status: string }>(steps);
  const allCompleted = safeSteps.every((s) => s.status === "completed");
  const hasInProgress = safeSteps.some((s) => s.status === "in_progress");

  return (
    <div className="step-group-enter">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-[#161619]/50 transition-colors"
      >
        {allCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-[#22c55e] shrink-0" />
        ) : hasInProgress ? (
          <Loader2 className="h-4 w-4 text-[#7c3aed] animate-spin shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-[#4a4a5e] shrink-0" />
        )}
        <span className={cn(
          "text-[13px] font-medium flex-1",
          allCompleted ? "text-[#8888a0]" : "text-[#e2e2e8]"
        )}>
          {title}
        </span>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-[#8888a0] transition-transform duration-200 shrink-0",
          !expanded && "-rotate-90"
        )} />
      </button>
      {expanded && (
        <div className="ml-3 pl-4 border-l border-[#1a1a1f] space-y-0.5 mt-1 mb-2">
          {safeSteps.map((step) => (
            <div key={step.id} className="flex items-center gap-2 py-0.5 step-item-enter">
              {step.status === "completed" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e] shrink-0" />
              ) : step.status === "in_progress" ? (
                <Loader2 className="h-3.5 w-3.5 text-[#7c3aed] animate-spin shrink-0" />
              ) : step.status === "failed" ? (
                <XCircle className="h-3.5 w-3.5 text-[#ef4444] shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-[#4a4a5e] shrink-0" />
              )}
              <span className={cn(
                "text-[12px]",
                step.status === "completed" ? "text-[#8888a0]" :
                step.status === "in_progress" ? "text-[#e2e2e8]" :
                step.status === "failed" ? "text-[#ef4444]" :
                "text-[#4a4a5e]"
              )}>
                {step.description}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [expandedDebug, setExpandedDebug] = useState<Set<string>>(new Set());
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const handleVoiceSubmitRef = useRef<((text: string) => void) | null>(null);

  // Voice input
  const { isListening, transcript, isSupported, toggleListening } = useVoiceInput({
    language: "es-MX",
    onResult: (text) => {
      handleVoiceSubmitRef.current?.(text);
    },
  });

  // Voice output
  const voiceOutput = useVoiceOutput({ language: "es-MX" });

  const {
    currentProjectId,
    projectName,
    messages,
    isAgentRunning,
    agentThinking,
    activeAgent,
    currentPlan,
    addMessage,
    setAgentRunning,
  } = useProjectStore();

  const engine = useEngineActivity(currentProjectId);

  // Wire voice submit after handleSubmit is available
  useEffect(() => {
    handleVoiceSubmitRef.current = (text: string) => {
      setInput(text);
      setTimeout(() => handleSubmit(text), 500);
    };
  });

  // Auto-speak agent responses when voice output is enabled
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (!voiceOutput.isEnabled) return;
    const msgCount = messages?.length || 0;
    if (msgCount > prevMessageCountRef.current) {
      const lastMsg = messages?.[msgCount - 1];
      if (lastMsg && lastMsg.role === "ASSISTANT" && lastMsg.content) {
        voiceOutput.speak(lastMsg.content);
      }
    }
    prevMessageCountRef.current = msgCount;
  }, [messages?.length, voiceOutput.isEnabled]);

  const safeMessages = useMemo(() => safeArray(messages), [messages]);
  const isEmpty = safeMessages.length === 0 && !isAgentRunning && !engine.isRunning;

  const lastAction = useMemo(() => {
    const assistantMsgs = safeMessages.filter((m) => m.role === "ASSISTANT");
    return assistantMsgs[assistantMsgs.length - 1]?.content || null;
  }, [safeMessages]);

  // Rotating placeholder
  useEffect(() => {
    if (!isEmpty) return;
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isEmpty]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentThinking, currentPlan]);

  const handleSubmit = async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim();
    const hasFiles = attachedFiles.length > 0;
    if ((!content && !hasFiles) || !currentProjectId) return;
    // Block only when legacy agent is running (not engine)
    if (isAgentRunning && !engine.isRunning) return;

    const filesToUpload = [...attachedFiles];
    setInput("");
    setAttachedFiles([]);
    setIsSending(true);

    // Build display content with file info
    let displayContent = content;
    if (hasFiles) {
      const fileNames = filesToUpload.map((f) => f.name).join(", ");
      if (content) {
        displayContent = `${content}\n\n[Archivos: ${fileNames}]`;
      } else {
        displayContent = `[Archivos adjuntos: ${fileNames}]`;
      }
    }

    addMessage({
      id: generateId(),
      projectId: currentProjectId,
      role: "USER",
      content: displayContent,
      messageType: null,
      plan: null,
      codeChanges: null,
      tokensUsed: null,
      creditsConsumed: 0,
      model: null,
      createdAt: new Date().toISOString(),
    });
    setAgentRunning(true);

    // Upload files if any
    if (filesToUpload.length > 0) {
      setIsUploading(true);
      try {
        await api.uploadFiles(currentProjectId, filesToUpload);
      } catch (uploadErr) {
        console.error("[ChatPanel] file upload failed:", uploadErr);
      } finally {
        setIsUploading(false);
      }
    }

    // Build engine prompt with file context
    let engineContent = content;
    if (hasFiles) {
      const fileNames = filesToUpload.map((f) => f.name).join(", ");
      if (content) {
        engineContent = `${content}\n\n[Archivos adjuntos en uploads/: ${fileNames}]`;
      } else {
        engineContent = `Analiza los siguientes archivos adjuntos y genera insights/reporte: ${fileNames}`;
      }
    }

    if (engine.isRunning) {
      // Engine already running -- send as follow-up message
      try {
        await api.sendMessage(currentProjectId, engineContent);
      } catch (apiErr) {
        console.error("[ChatPanel] follow-up sendMessage failed:", apiErr);
        Sentry.captureException(apiErr, { tags: { component: "chat_panel", action: "follow_up_message" } });
        setAgentRunning(false);
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Try to start the engine first
    try {
      await api.startEngine(currentProjectId, engineContent);
      // Engine started -- it handles everything via WebSocket events
      setIsSending(false);
      return;
    } catch (engineErr: any) {
      const errMsg = engineErr?.message || "";
      console.error("[ChatPanel] engine start failed:", engineErr);
      Sentry.captureException(engineErr, { tags: { component: "chat_panel", action: "engine_start" } });

      // Show user-friendly error in chat
      let displayError = "";
      if (errMsg.includes("credit balance") || errMsg.includes("insufficient") || engineErr?.status === 402) {
        displayError = "El proveedor de AI no tiene creditos suficientes. Verifica tu API key en console.anthropic.com.";
      } else if (errMsg.includes("API key") || errMsg.includes("authentication") || errMsg.includes("invalid_api_key")) {
        displayError = "La API key de AI no es valida. Configurala en Settings.";
      } else if (errMsg.includes("already running") || engineErr?.status === 409) {
        displayError = "El engine ya esta ejecutandose. Espera a que termine o cancelalo.";
      }

      if (displayError) {
        addMessage({
          id: generateId(),
          projectId: currentProjectId,
          role: "SYSTEM",
          content: displayError,
          messageType: null, plan: null, codeChanges: null, tokensUsed: null, creditsConsumed: 0, model: null,
          createdAt: new Date().toISOString(),
        });
        setAgentRunning(false);
        setIsSending(false);
        return;
      }
    }

    // Fallback: engine failed to start, use regular message flow
    try {
      await api.sendMessage(currentProjectId, engineContent);
    } catch (apiErr) {
      console.error("[ChatPanel] api.sendMessage FAILED:", apiErr);
      Sentry.captureException(apiErr, { tags: { component: "chat_panel", action: "send_message" } });
      setAgentRunning(false);
    } finally {
      setIsSending(false);
    }
  };

  const insertText = useCallback((text: string) => {
    setInput(text);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const toggleDebug = (id: string) => {
    setExpandedDebug((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    // Accept dropped files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
      return;
    }
    // Accept dropped text
    const text = e.dataTransfer.getData("text/plain");
    if (text) { setInput((prev) => prev + text); return; }
  };

  const addFiles = (newFiles: File[]) => {
    const total = attachedFiles.length + newFiles.length;
    if (total > MAX_UPLOAD_FILES) return;
    const valid = newFiles.filter((f) => f.size <= MAX_UPLOAD_SIZE);
    setAttachedFiles((prev) => [...prev, ...valid]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    addFiles(selected);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const planSteps = useMemo(() => {
    if (!currentPlan?.steps) return [];
    return safeArray(currentPlan.steps);
  }, [currentPlan]);
  const hasInProgressStep = planSteps.some((s) => s.status === "in_progress");

  return (
    <div
      className="flex h-full flex-col bg-[#0A0A0A] relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/80 backdrop-blur-sm animate-overlay-fade">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[#7c3aed]/50 bg-[#7c3aed]/10 px-12 py-10">
            <Upload className="h-8 w-8 text-[#7c3aed]" />
            <span className="text-sm font-medium text-[#EDEDED]">Suelta los archivos aqui</span>
            <span className="text-xs text-[#8888a0]">PDF, CSV, XLSX, imagenes, codigo y mas</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold text-[#EDEDED] leading-tight">Arya AI</h1>
            <span className="text-[11px] text-[#8888a0]">{projectName || "Nuevo proyecto"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Voice output toggle */}
          {isSupported && (
            <button
              onClick={voiceOutput.toggleEnabled}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                voiceOutput.isEnabled
                  ? "text-[#7c3aed] bg-[#7c3aed]/10"
                  : "text-[#555] hover:text-[#888]"
              )}
              title={
                voiceOutput.isEnabled
                  ? "Desactivar respuestas por voz"
                  : "Activar respuestas por voz"
              }
            >
              {voiceOutput.isEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
          )}
          {/* Speaking waveform indicator */}
          {voiceOutput.isSpeaking && <VoiceWaveform isActive color="#7c3aed" />}
          {(isAgentRunning || engine.isRunning) && (
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#22c55e] live-pulse" />
              <span className="text-[11px] text-[#22c55e] font-medium">
                {engine.engineStatus === "planning" ? "Planificando" :
                 engine.isRunning ? `Ejecutando (${engine.progress.completed}/${engine.progress.total})` :
                 "Trabajando"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Plan Overview — shown when engine has steps */}
      {engine.planSteps.length > 0 && (
        <>
          <PlanOverview
            planSteps={engine.planSteps}
            progress={engine.progress}
            isRunning={engine.isRunning}
            complexity={engine.complexity}
            estimatedTime={engine.estimatedTime}
          />
          {/* Active agents panel */}
          {engine.isRunning && (
            <div className="mx-4 mt-2">
              <AgentsPanel planSteps={engine.planSteps} isRunning={engine.isRunning} />
            </div>
          )}
        </>
      )}

      {/* Messages / Empty State */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ─── Empty State: Welcome Screen ─── */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center px-2">
            {/* Hero */}
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7c3aed]/15 to-[#3b82f6]/10 flex items-center justify-center mb-5 animate-sparkle-pulse">
              <Sparkles className="h-8 w-8 text-[#a78bfa]" />
            </div>
            <h2 className="text-3xl font-light text-[#EDEDED] mb-2">
              ¿Qué quieres construir?
            </h2>
            <p className="text-[13px] text-[#8888a0] max-w-[360px] mb-8 leading-relaxed">
              Describe tu idea y Arya la construirá para ti en minutos.
            </p>

            {/* Suggestion Cards 2x2 */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-[420px] mb-6">
              {SUGGESTION_CARDS.map((card, i) => (
                <button
                  key={card.title}
                  onClick={() => insertText(card.prompt)}
                  className={cn(
                    "group flex flex-col items-start gap-2 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4 text-left transition-all duration-200",
                    "hover:border-[#7c3aed]/40 hover:shadow-lg hover:shadow-[#7c3aed]/5 hover:-translate-y-0.5",
                    i === 0 ? "animate-card-enter" :
                    i === 1 ? "animate-card-enter-d1" :
                    i === 2 ? "animate-card-enter-d2" :
                    "animate-card-enter-d3"
                  )}
                >
                  <span className="text-[#7c3aed] group-hover:text-[#a78bfa] transition-colors">
                    {card.icon}
                  </span>
                  <span className="text-[13px] font-medium text-[#EDEDED] leading-snug">
                    {card.title}
                  </span>
                  <span className="text-[11px] text-[#8888a0] leading-relaxed">
                    {card.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Action chips */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {ACTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => insertText(chip.prompt)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#111114] px-3 py-1.5 text-[11px] text-[#8888a0] hover:text-[#EDEDED] hover:border-[#7c3aed]/30 hover:bg-[#7c3aed]/5 transition-all duration-150 cursor-pointer"
                >
                  <span className="text-[#7c3aed]/60">{chip.icon}</span>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── Message list ─── */}
        {safeMessages.map((msg) => {
          const debugSummary = msg.role === "SYSTEM" ? getDebugSummary(msg.content) : null;
          const isExpanded = expandedDebug.has(msg.id);

          // ── USER bubble — right aligned ──
          if (msg.role === "USER") {
            return (
              <div key={msg.id} className="flex justify-end msg-enter">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#7c3aed]/10 border border-[#7c3aed]/15 px-4 py-2.5">
                  <div className="text-[13px] text-[#EDEDED] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
                  {msg.createdAt && (
                    <div className="text-[10px] text-[#8888a0]/40 text-right mt-1.5">{formatTime(msg.createdAt)}</div>
                  )}
                </div>
              </div>
            );
          }

          // ── Debugger SYSTEM message ──
          if (debugSummary) {
            return (
              <div key={msg.id} className="msg-enter">
                <button onClick={() => toggleDebug(msg.id)}
                  className="flex items-center gap-2 text-[11px] text-[#8888a0] hover:text-[#EDEDED] transition-colors w-full text-left py-1 px-2 rounded-lg hover:bg-[#161619]/30">
                  <Wrench className="h-3 w-3 text-[#f59e0b] shrink-0" />
                  <span className="truncate">Corregido automáticamente: {debugSummary}</span>
                  <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", isExpanded && "rotate-180")} />
                </button>
                {isExpanded && (
                  <div className="ml-5 pl-3 border-l border-[#2A2A2A] text-[11px] text-[#8888a0]/60 whitespace-pre-wrap mt-1 mb-1">{msg.content}</div>
                )}
              </div>
            );
          }

          // ── Other SYSTEM messages ──
          if (msg.role === "SYSTEM") {
            return (
              <div key={msg.id} className="msg-enter">
                <div className="flex items-start gap-2 py-1 px-2">
                  <div className="h-4 w-4 rounded bg-[#f59e0b]/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] text-[#f59e0b]">!</span>
                  </div>
                  <div className="text-[12px] text-[#8888a0] leading-relaxed">{msg.content}</div>
                </div>
              </div>
            );
          }

          // ── ASSISTANT message — left aligned with avatar ──
          {
            const msgAgentType = (msg as any).agentType as string | undefined;
            const msgStyle = msgAgentType ? getAgentStyle(msgAgentType) : null;
            return (
              <div key={msg.id} className="msg-enter">
                <div className="flex gap-3 py-1">
                  {msgAgentType ? (
                    <AgentAvatar agentType={msgAgentType} size="md" className="mt-0.5" />
                  ) : (
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {msgAgentType && msgStyle ? (
                        <span className="text-[12px] font-bold" style={{ color: msgStyle.color }}>
                          {msgStyle.icon} {msgStyle.label}
                        </span>
                      ) : (
                        <span className="text-[12px] font-bold text-[#EDEDED]">Arya</span>
                      )}
                      {msg.createdAt && <span className="text-[10px] text-[#8888a0]/40">{formatTime(msg.createdAt)}</span>}
                    </div>
                    <RichMessage message={msg} />
                  </div>
                </div>
              </div>
            );
          }
        })}

        {/* Plan steps */}
        {planSteps.length > 0 && (
          <StepGroup
            title={currentPlan?.understanding?.split(".")[0] || "Ejecutando plan"}
            steps={planSteps}
            defaultExpanded={hasInProgressStep}
          />
        )}

        {/* Project card */}
        {!isAgentRunning && safeMessages.length > 0 && projectName && (
          <div className="msg-enter">
            <div className="rounded-xl border border-[#2A2A2A] bg-[#111114] p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#7c3aed]/20 to-[#3b82f6]/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-[#a78bfa]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#EDEDED] truncate">{projectName}</div>
                <div className="text-[11px] text-[#8888a0]">Proyecto Inicializado</div>
              </div>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="flex items-center gap-1 rounded-lg bg-[#7c3aed]/10 px-3 py-1.5 text-[11px] font-medium text-[#a78bfa] hover:bg-[#7c3aed]/20 transition-colors shrink-0"
              >
                <Eye className="h-3 w-3" /> Ver
              </button>
            </div>
          </div>
        )}

        {/* ─── Typing indicator: "Arya está pensando..." with 3 animated dots ─── */}
        {isAgentRunning && (
          <div className="flex items-start gap-3 py-2 msg-enter">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[#EDEDED]">Arya</span>
                <span className="inline-flex gap-[3px] items-center ml-0.5">
                  <span className="h-[5px] w-[5px] rounded-full bg-[#a78bfa] animate-dot-1" />
                  <span className="h-[5px] w-[5px] rounded-full bg-[#a78bfa] animate-dot-2" />
                  <span className="h-[5px] w-[5px] rounded-full bg-[#a78bfa] animate-dot-3" />
                </span>
              </div>
              {agentThinking && (
                <span className="text-[11px] text-[#8888a0] truncate max-w-[260px]">{agentThinking}</span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {!isAgentRunning && safeMessages.some((m) => m.role === "ASSISTANT") && (
        <SuggestionChips lastAction={lastAction} onSelect={(chip) => handleSubmit(chip)} />
      )}

      {/* ─── Chat Input ─── */}
      <div className="border-t border-[#2A2A2A] p-3">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileSelect}
          className="hidden"
        />
        {/* Voice listening indicator */}
        {isListening && (
          <div className="flex items-center justify-center mb-2 animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-400">
                {transcript || "Escuchando..."}
              </span>
              <VoiceWaveform isActive={isListening} color="#ef4444" />
            </div>
          </div>
        )}
        {/* Attached file badges */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachedFiles.slice(0, 5).map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-1.5 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] px-2.5 py-1 text-[11px] text-[#EDEDED]"
              >
                <span className="text-xs">{getFileEmoji(file.name)}</span>
                <span className="truncate max-w-[120px]">{file.name}</span>
                <span className="text-[#8888a0]">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-[#555] hover:text-[#ef4444] transition-colors"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            {attachedFiles.length > 5 && (
              <div className="flex items-center rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] px-2.5 py-1 text-[11px] text-[#8888a0]">
                +{attachedFiles.length - 5} mas
              </div>
            )}
          </div>
        )}
        {/* Uploading indicator */}
        {isUploading && (
          <div className="flex items-center gap-2 mb-2 text-[11px] text-[#7c3aed]">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Subiendo archivos...</span>
          </div>
        )}
        <div className="relative flex items-end gap-2 rounded-2xl border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-3 focus-within:border-[#7c3aed]/40 transition-colors">
          {/* Paperclip button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={(isAgentRunning && !engine.isRunning) || isSending}
            className={cn(
              "flex items-center justify-center rounded-full shrink-0 h-9 w-9 transition-colors",
              attachedFiles.length > 0 ? "text-[#7c3aed]" : "text-[#555] hover:text-[#888] hover:bg-[#1A1A1A]"
            )}
            title="Adjuntar archivos"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            ref={textareaRef}
            data-chat-input
            value={isListening && transcript ? transcript : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? "Escuchando..."
                : engine.isRunning
                ? "Puedes dar instrucciones adicionales..."
                : engine.engineStatus === "completed"
                ? "Que mas quieres ajustar?"
                : isAgentRunning
                ? "Arya esta trabajando..."
                : PLACEHOLDERS[placeholderIdx]
            }
            disabled={(isAgentRunning && !engine.isRunning) || isListening}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] text-[#EDEDED] placeholder:text-[#8888a0]/50 outline-none disabled:opacity-40 min-h-[36px] max-h-[200px] py-0.5 leading-relaxed"
          />
          {/* Mic button */}
          {isSupported && (
            <button
              onClick={toggleListening}
              disabled={isAgentRunning && !engine.isRunning}
              className={cn(
                "flex items-center justify-center rounded-full transition-all duration-200 shrink-0 h-9 w-9",
                isListening
                  ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30"
                  : "text-[#555] hover:text-[#888] hover:bg-[#1A1A1A]"
              )}
              title={isListening ? "Detener" : "Hablar con Arya"}
            >
              {isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            data-chat-send
            onClick={() => handleSubmit()}
            disabled={(!input.trim() && attachedFiles.length === 0) || (isAgentRunning && !engine.isRunning) || isSending}
            className={cn(
              "flex items-center justify-center rounded-full transition-all duration-200 shrink-0",
              (input.trim() || attachedFiles.length > 0) && !(isAgentRunning && !engine.isRunning) && !isSending
                ? "h-9 w-9 bg-gradient-to-br from-[#7c3aed] to-[#6d28d9] text-white shadow-lg shadow-[#7c3aed]/20 hover:shadow-[#7c3aed]/40 hover:scale-105"
                : "h-9 w-9 bg-transparent text-[#8888a0]/30 cursor-default"
            )}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className={cn("h-4 w-4 transition-opacity", (input.trim() || attachedFiles.length > 0) ? "opacity-100" : "opacity-0")} />
            )}
          </button>
        </div>
        <div className="mt-1.5 px-1">
          <span className="text-[10px] text-[#8888a0]/40">Enter para enviar | Shift+Enter nueva linea{isSupported ? " | Mic para voz" : ""} | Clip para archivos</span>
        </div>
      </div>
    </div>
  );
}
