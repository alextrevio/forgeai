"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Bot,
  User,
  AlertTriangle,
  Paintbrush,
  Bug,
  FileSearch,
  Rocket,
  Code2,
  Sparkles,
  ClipboardList,
  ArrowUp,
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn, generateId } from "@/lib/utils";
import { RichMessage } from "./rich-message";
import { SuggestionChips } from "./suggestion-chips";

const INITIAL_CHIPS = [
  "Build a todo app",
  "Create a landing page",
  "Dashboard with charts",
  "E-commerce store",
];

const AGENT_LABELS: Record<string, { icon: React.ReactNode; text: string }> = {
  planner: { icon: <ClipboardList className="h-3 w-3" />, text: "Planning..." },
  coder: { icon: <Code2 className="h-3 w-3" />, text: "Coding..." },
  designer: { icon: <Paintbrush className="h-3 w-3" />, text: "Designing..." },
  debugger: { icon: <Bug className="h-3 w-3" />, text: "Debugging..." },
  reviewer: { icon: <FileSearch className="h-3 w-3" />, text: "Reviewing..." },
  deployer: { icon: <Rocket className="h-3 w-3" />, text: "Deploying..." },
};

function formatTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    currentProjectId,
    messages,
    isAgentRunning,
    agentThinking,
    activeAgent,
    currentPlan,
    addMessage,
    setAgentRunning,
  } = useProjectStore();

  const lastAction = useMemo(() => {
    const assistantMsgs = messages.filter((m) => m.role === "ASSISTANT");
    return assistantMsgs[assistantMsgs.length - 1]?.content || null;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentThinking, currentPlan]);

  const handleSubmit = async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim();

    // DEBUG — trace every guard (remove once verified)
    console.log("[ChatPanel] handleSubmit fired", {
      content: content || "(empty)",
      currentProjectId,
      isAgentRunning,
      isSending,
    });

    if (!content) {
      console.warn("[ChatPanel] empty content — aborting");
      return;
    }
    if (!currentProjectId) {
      console.error("[ChatPanel] currentProjectId is null — project not loaded yet?");
      return;
    }
    if (isAgentRunning) {
      console.warn("[ChatPanel] agent already running — aborting");
      return;
    }

    setInput("");
    setIsSending(true);

    // Optimistic UI — show message immediately
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

    // 1) WebSocket emit — isolated so it can't block the HTTP POST
    try {
      const socket = getSocket();
      console.log("[ChatPanel] socket.connected:", socket.connected, "| emitting message:send");
      socket.emit("message:send", { projectId: currentProjectId, content });
    } catch (socketErr) {
      console.error("[ChatPanel] socket.emit failed (non-blocking):", socketErr);
    }

    // 2) HTTP POST — always runs even if socket fails
    try {
      console.log("[ChatPanel] POST /api/projects/" + currentProjectId + "/messages");
      await api.sendMessage(currentProjectId, content);
      console.log("[ChatPanel] api.sendMessage OK");
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

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const progressPercent = useMemo(() => {
    if (!currentPlan?.steps?.length) return 0;
    const total = currentPlan.steps.length;
    const completed = currentPlan.steps.filter((s: { status: string }) => s.status === "completed").length;
    return Math.round((completed / total) * 100);
  }, [currentPlan]);

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />;
      case "in_progress": return <Loader2 className="h-3.5 w-3.5 text-[#a78bfa] animate-spin" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-[#ef4444]" />;
      default: return <Circle className="h-3.5 w-3.5 text-[#8888a0]/40" />;
    }
  };

  const agentLabel = activeAgent ? AGENT_LABELS[activeAgent] : null;

  return (
    <div className="flex h-full flex-col bg-[#0e0e14]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-[#7c3aed]/20 to-[#3b82f6]/20 flex items-center justify-center">
            <Bot className="h-3 w-3 text-[#a78bfa]" />
          </div>
          <span className="text-[13px] font-medium text-[#e2e2e8]">Chat</span>
        </div>
        {isAgentRunning && agentLabel && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#7c3aed] animate-pulse" />
            <span className="text-[11px] text-[#8888a0]">{agentLabel.text}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {currentPlan && isAgentRunning && (
        <div className="w-full h-[2px] bg-[#1a1a24] relative overflow-hidden">
          <div
            className="h-full progress-animated transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && !isAgentRunning && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#7c3aed]/10 to-[#3b82f6]/10 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-[#a78bfa]" />
            </div>
            <h3 className="text-[15px] font-semibold text-[#e2e2e8] mb-1">
              What would you like to build?
            </h3>
            <p className="text-xs text-[#8888a0] max-w-[280px] mb-6 leading-relaxed">
              Describe your app in natural language and I&apos;ll build it for you.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-[320px]">
              {INITIAL_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSubmit(chip)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[#13131a] px-3 py-1.5 text-xs text-[#8888a0] hover:text-[#e2e2e8] hover:border-[#7c3aed]/30 hover:bg-[#7c3aed]/5 transition-all duration-150 hover:scale-[1.02] cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-[#7c3aed]/60" />
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showSeparator = prevMsg && prevMsg.role !== msg.role;

          return (
            <div key={msg.id} className="animate-fade-in">
              {showSeparator && <div className="h-px bg-border/30 my-2" />}
              <div className="flex gap-3 py-2 group">
                <div
                  className={cn(
                    "h-6 w-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                    msg.role === "USER"
                      ? "bg-gradient-to-br from-[#7c3aed]/20 to-[#3b82f6]/20"
                      : msg.role === "SYSTEM"
                        ? "bg-[#f59e0b]/10"
                        : "bg-[#1a1a24]"
                  )}
                >
                  {msg.role === "USER" ? (
                    <User className="h-3 w-3 text-[#a78bfa]" />
                  ) : msg.role === "SYSTEM" ? (
                    <AlertTriangle className="h-3 w-3 text-[#f59e0b]" />
                  ) : (
                    <Bot className="h-3 w-3 text-[#8888a0]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[11px] font-medium text-[#8888a0]">
                      {msg.role === "USER" ? "You" : msg.role === "SYSTEM" ? "System" : "ForgeAI"}
                    </span>
                    {msg.createdAt && (
                      <span className="text-[10px] text-[#8888a0]/40">{formatTime(msg.createdAt)}</span>
                    )}
                  </div>
                  {msg.role === "ASSISTANT" ? (
                    <RichMessage message={msg} />
                  ) : (
                    <div className="text-sm text-[#e2e2e8] whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Agent Plan */}
        {currentPlan && (
          <div className="rounded-xl border border-border bg-[#13131a] p-3 animate-fade-in">
            <div className="text-[11px] font-medium text-[#8888a0] mb-2 uppercase tracking-wider">Plan</div>
            <p className="text-xs text-[#e2e2e8]/80 mb-3 leading-relaxed">{currentPlan.understanding}</p>
            <div className="space-y-1.5">
              {currentPlan.steps.map((step) => (
                <div key={step.id} className="flex items-start gap-2">
                  {getStepIcon(step.status)}
                  <span className={cn(
                    "text-xs leading-5",
                    step.status === "completed" ? "text-[#8888a0] line-through" :
                    step.status === "in_progress" ? "text-[#e2e2e8] font-medium" :
                    step.status === "failed" ? "text-[#ef4444]" :
                    "text-[#8888a0]/60"
                  )}>
                    {step.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Typing Indicator */}
        {isAgentRunning && (
          <div className="flex gap-3 animate-fade-in">
            <div className="h-6 w-6 rounded-lg bg-[#1a1a24] flex items-center justify-center shrink-0">
              <Loader2 className="h-3 w-3 text-[#a78bfa] animate-spin" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] text-[#8888a0] mb-0.5">ForgeAI</div>
              <div className="text-sm text-[#8888a0] italic flex items-center gap-2">
                {agentThinking || "ForgeAI is thinking..."}
                <span className="inline-flex gap-1">
                  <span className="h-1 w-1 rounded-full bg-[#a78bfa] animate-bounce [animation-delay:0ms]" />
                  <span className="h-1 w-1 rounded-full bg-[#a78bfa] animate-bounce [animation-delay:200ms]" />
                  <span className="h-1 w-1 rounded-full bg-[#a78bfa] animate-bounce [animation-delay:400ms]" />
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips — only after agent has responded at least once */}
      {!isAgentRunning && messages.some((m) => m.role === "ASSISTANT") && (
        <SuggestionChips lastAction={lastAction} onSelect={(chip) => handleSubmit(chip)} />
      )}

      {/* Input Area */}
      <div className="border-t border-border p-3">
        <div className="relative flex items-end gap-2 rounded-xl border border-border bg-[#13131a] p-2.5 focus-within:border-[#7c3aed]/30 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAgentRunning ? "Agent is working..." : "Ask ForgeAI to build something..."}
            disabled={isAgentRunning}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-[#e2e2e8] placeholder:text-[#8888a0]/40 outline-none disabled:opacity-40 min-h-[36px] max-h-[200px] py-1.5 px-1 leading-relaxed"
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
          <span className="text-[10px] text-[#8888a0]/40">
            Enter to send, Shift+Enter for new line
          </span>
        </div>
      </div>
    </div>
  );
}
