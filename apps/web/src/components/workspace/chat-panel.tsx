"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Sparkles,
  ArrowUp,
  Wrench,
  ChevronDown,
  ChevronRight,
  Zap,
  Eye,
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn, generateId } from "@/lib/utils";
import { RichMessage } from "./rich-message";
import { SuggestionChips } from "./suggestion-chips";

function safeArray<T>(data: T[]): T[];
function safeArray<T>(data: null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

const INITIAL_CHIPS = [
  "Crea una app de tareas",
  "Crea una landing page",
  "Dashboard con gráficos",
  "Tienda e-commerce",
];

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Detect debugger-style SYSTEM messages and return a short summary */
function getDebugSummary(content: string): string | null {
  if (content.startsWith("Debugger fix:")) return content.replace("Debugger fix: ", "");
  if (content.startsWith("Debugger failed:")) return "No se pudo corregir automáticamente";
  return null;
}

/** Collapsible Step Group — like Manus */
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
        className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-[#1a1a24]/50 transition-colors"
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
        <div className="ml-3 pl-4 border-l border-[#1e1e2e] space-y-0.5 mt-1 mb-2">
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const lastAction = useMemo(() => {
    const assistantMsgs = safeArray(messages).filter((m) => m.role === "ASSISTANT");
    return assistantMsgs[assistantMsgs.length - 1]?.content || null;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentThinking, currentPlan]);

  const handleSubmit = async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim();
    if (!content || !currentProjectId || isAgentRunning) return;

    setInput("");
    setIsSending(true);

    addMessage({
      id: generateId(),
      projectId: currentProjectId,
      role: "USER",
      content,
      messageType: null,
      plan: null,
      codeChanges: null,
      tokensUsed: null,
      creditsConsumed: 0,
      model: null,
      createdAt: new Date().toISOString(),
    });
    setAgentRunning(true);

    try {
      const socket = getSocket();
      socket.emit("message:send", { projectId: currentProjectId, content });
    } catch (socketErr) {
      console.error("[ChatPanel] socket.emit failed:", socketErr);
    }

    try {
      await api.sendMessage(currentProjectId, content);
    } catch (apiErr) {
      console.error("[ChatPanel] api.sendMessage FAILED:", apiErr);
      setAgentRunning(false);
    } finally {
      setIsSending(false);
    }
  };

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

  // Group plan steps into a single collapsible block
  const planSteps = useMemo(() => {
    if (!currentPlan?.steps) return [];
    return safeArray(currentPlan.steps);
  }, [currentPlan]);

  const hasInProgressStep = planSteps.some((s) => s.status === "in_progress");

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e1e2e] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold text-[#e2e2e8] leading-tight">ForgeAI</h1>
            <span className="text-[11px] text-[#8888a0]">{projectName || "Nuevo proyecto"}</span>
          </div>
        </div>
        {isAgentRunning && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-[#22c55e] live-pulse" />
            <span className="text-[11px] text-[#22c55e] font-medium">Trabajando</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(safeArray(messages).length === 0) && !isAgentRunning && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#7c3aed]/10 to-[#3b82f6]/10 flex items-center justify-center mb-4">
              <Sparkles className="h-7 w-7 text-[#a78bfa]" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#e2e2e8] mb-1">¿Qué quieres construir?</h3>
            <p className="text-[13px] text-[#8888a0] max-w-[300px] mb-6 leading-relaxed">
              Describe tu app y la construiré para ti.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-[340px]">
              {INITIAL_CHIPS.map((chip) => (
                <button key={chip} onClick={() => handleSubmit(chip)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1e1e2e] bg-[#13131a] px-3.5 py-2 text-[12px] text-[#8888a0] hover:text-[#e2e2e8] hover:border-[#7c3aed]/30 hover:bg-[#7c3aed]/5 transition-all duration-150 cursor-pointer">
                  <Sparkles className="h-3 w-3 text-[#7c3aed]/60" />
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {safeArray(messages).map((msg) => {
          const debugSummary = msg.role === "SYSTEM" ? getDebugSummary(msg.content) : null;
          const isExpanded = expandedDebug.has(msg.id);

          // ── USER bubble — right aligned ──
          if (msg.role === "USER") {
            return (
              <div key={msg.id} className="flex justify-end msg-enter">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-[#7c3aed]/20 to-[#3b82f6]/10 border border-[#7c3aed]/15 px-4 py-2.5">
                  <div className="text-[13px] text-[#e2e2e8] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
                  {msg.createdAt && (
                    <div className="text-[10px] text-[#8888a0]/40 text-right mt-1.5">{formatTime(msg.createdAt)}</div>
                  )}
                </div>
              </div>
            );
          }

          // ── Debugger SYSTEM message — compact 1-line ──
          if (debugSummary) {
            return (
              <div key={msg.id} className="msg-enter">
                <button onClick={() => toggleDebug(msg.id)}
                  className="flex items-center gap-2 text-[11px] text-[#8888a0] hover:text-[#e2e2e8] transition-colors w-full text-left py-1 px-2 rounded-lg hover:bg-[#1a1a24]/30">
                  <Wrench className="h-3 w-3 text-[#f59e0b] shrink-0" />
                  <span className="truncate">Corregido automáticamente: {debugSummary}</span>
                  <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", isExpanded && "rotate-180")} />
                </button>
                {isExpanded && (
                  <div className="ml-5 pl-3 border-l border-[#1e1e2e] text-[11px] text-[#8888a0]/60 whitespace-pre-wrap mt-1 mb-1">{msg.content}</div>
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

          // ── ASSISTANT message — Manus style with avatar ──
          return (
            <div key={msg.id} className="msg-enter">
              <div className="flex gap-3 py-1">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12px] font-bold text-[#e2e2e8]">forgeai</span>
                    {msg.createdAt && <span className="text-[10px] text-[#8888a0]/40">{formatTime(msg.createdAt)}</span>}
                  </div>
                  <RichMessage message={msg} />
                </div>
              </div>
            </div>
          );
        })}

        {/* Plan steps — collapsible group (Manus style) */}
        {planSteps.length > 0 && (
          <StepGroup
            title={currentPlan?.understanding?.split(".")[0] || "Ejecutando plan"}
            steps={planSteps}
            defaultExpanded={hasInProgressStep}
          />
        )}

        {/* Project card — shown when project initializes */}
        {!isAgentRunning && safeArray(messages).length > 0 && projectName && (
          <div className="msg-enter">
            <div className="rounded-xl border border-[#1e1e2e] bg-[#13131a] p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#7c3aed]/20 to-[#3b82f6]/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-[#a78bfa]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#e2e2e8] truncate">{projectName}</div>
                <div className="text-[11px] text-[#8888a0]">Proyecto Inicializado</div>
              </div>
              <button className="flex items-center gap-1 rounded-lg bg-[#7c3aed]/10 px-3 py-1.5 text-[11px] font-medium text-[#a78bfa] hover:bg-[#7c3aed]/20 transition-colors shrink-0">
                <Eye className="h-3 w-3" /> Ver
              </button>
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isAgentRunning && (
          <div className="flex items-center gap-3 py-2 msg-enter">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center shrink-0">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="inline-flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa] animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa] animate-bounce [animation-delay:200ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa] animate-bounce [animation-delay:400ms]" />
            </span>
            {agentThinking && (
              <span className="text-[11px] text-[#8888a0] truncate">{agentThinking}</span>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      {!isAgentRunning && safeArray(messages).some((m) => m.role === "ASSISTANT") && (
        <SuggestionChips lastAction={lastAction} onSelect={(chip) => handleSubmit(chip)} />
      )}

      {/* Input Area */}
      <div className="border-t border-[#1e1e2e] p-3">
        <div className="relative flex items-end gap-2 rounded-xl border border-[#1e1e2e] bg-[#0a0a12] p-2.5 focus-within:border-[#7c3aed]/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAgentRunning ? "ForgeAI está trabajando..." : "Pídele a ForgeAI que construya algo..."}
            disabled={isAgentRunning}
            rows={1}
            className="flex-1 resize-none bg-transparent text-[13px] text-[#e2e2e8] placeholder:text-[#8888a0]/40 outline-none disabled:opacity-40 min-h-[36px] max-h-[200px] py-1.5 px-1 leading-relaxed"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isAgentRunning || isSending}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150 shrink-0",
              input.trim() && !isAgentRunning && !isSending
                ? "btn-gradient text-white hover:scale-[1.05]"
                : "bg-[#1a1a24] text-[#8888a0]/40 cursor-not-allowed"
            )}
          >
            {isSending || isAgentRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-1.5 px-1">
          <span className="text-[10px] text-[#8888a0]/40">Enter para enviar, Shift+Enter nueva línea</span>
        </div>
      </div>
    </div>
  );
}
