"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
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
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RichMessage } from "./rich-message";
import { SuggestionChips } from "./suggestion-chips";

const INITIAL_CHIPS = [
  "Build a todo app",
  "Create a landing page",
  "Dashboard with charts",
  "E-commerce store",
];

const AGENT_LABELS: Record<string, { icon: React.ReactNode; text: string }> = {
  planner: { icon: <ClipboardList className="h-3 w-3" />, text: "Planner is creating the plan..." },
  coder: { icon: <Code2 className="h-3 w-3" />, text: "Coder is generating components..." },
  designer: { icon: <Paintbrush className="h-3 w-3" />, text: "Designer is improving the UI..." },
  debugger: { icon: <Bug className="h-3 w-3" />, text: "Debugger is fixing an error..." },
  reviewer: { icon: <FileSearch className="h-3 w-3" />, text: "Reviewer is checking code quality..." },
  deployer: { icon: <Rocket className="h-3 w-3" />, text: "Deployer is building for production..." },
};

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function ChatPanel() {
  const [input, setInput] = useState("");
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

  // Track last completed action for contextual suggestions
  const lastAction = useMemo(() => {
    const assistantMsgs = messages.filter((m) => m.role === "ASSISTANT");
    return assistantMsgs[assistantMsgs.length - 1]?.content || null;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentThinking, currentPlan]);

  const handleSubmit = async (overrideContent?: string) => {
    const content = (overrideContent ?? input).trim();
    if (!content || !currentProjectId || isAgentRunning) return;

    setInput("");

    addMessage({
      id: crypto.randomUUID(),
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
      await api.sendMessage(currentProjectId, content);
    } catch (err) {
      console.error("Failed to send message:", err);
      setAgentRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Progress from currentPlan
  const progressPercent = useMemo(() => {
    if (!currentPlan?.steps?.length) return 0;
    const total = currentPlan.steps.length;
    const completed = currentPlan.steps.filter((s: { status: string }) => s.status === "completed").length;
    return Math.round((completed / total) * 100);
  }, [currentPlan]);

  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const agentLabel = activeAgent ? AGENT_LABELS[activeAgent] : null;

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Chat</span>
        </div>
        {isAgentRunning && agentLabel && (
          <div className="flex items-center gap-1.5 text-primary animate-pulse">
            {agentLabel.icon}
            <span className="text-[11px] text-muted-foreground">
              {agentLabel.text}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {currentPlan && isAgentRunning && (
        <div className="w-full h-1 bg-secondary/50 relative overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite] pointer-events-none" />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.length === 0 && !isAgentRunning && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-sm font-medium text-foreground mb-1">
              What would you like to build?
            </h3>
            <p className="text-xs text-muted-foreground max-w-[280px] mb-6">
              Describe your app in natural language and I&apos;ll build it for you.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-[320px]">
              {INITIAL_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSubmit(chip)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-all cursor-pointer"
                >
                  <Sparkles className="h-3 w-3 text-primary/60" />
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
            <div key={msg.id}>
              {showSeparator && (
                <div className="flex items-center gap-3 py-2 my-1">
                  <div className="flex-1 h-px bg-border/50" />
                </div>
              )}

              <div className="flex gap-3 py-2">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                    msg.role === "USER"
                      ? "bg-primary/20"
                      : msg.role === "SYSTEM"
                        ? "bg-warning/20"
                        : "bg-secondary"
                  )}
                >
                  {msg.role === "USER" ? (
                    <User className="h-3.5 w-3.5 text-primary" />
                  ) : msg.role === "SYSTEM" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {msg.role === "USER" ? "You" : msg.role === "SYSTEM" ? "System" : "ForgeAI"}
                    </span>
                    {msg.createdAt && (
                      <span className="text-[10px] text-muted-foreground/50">
                        {formatTime(msg.createdAt)}
                      </span>
                    )}
                  </div>
                  {msg.role === "ASSISTANT" ? (
                    <RichMessage message={msg} />
                  ) : (
                    <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Agent Plan */}
        {currentPlan && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">Plan</div>
            <p className="text-xs text-foreground mb-3">{currentPlan.understanding}</p>
            <div className="space-y-2">
              {currentPlan.steps.map((step) => (
                <div key={step.id} className="flex items-start gap-2">
                  {getStepIcon(step.status)}
                  <span
                    className={cn(
                      "text-xs",
                      step.status === "completed" ? "text-muted-foreground line-through" :
                      step.status === "in_progress" ? "text-foreground font-medium" :
                      step.status === "failed" ? "text-destructive" :
                      "text-muted-foreground"
                    )}
                  >
                    {step.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent Typing Indicator */}
        {agentThinking && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
            </div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground mb-1">ForgeAI</div>
              <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                {agentThinking}
                <span className="inline-flex gap-1">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:200ms]" />
                  <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:400ms]" />
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Contextual Suggestion Chips (after agent completes) */}
      {!isAgentRunning && messages.length > 0 && (
        <SuggestionChips lastAction={lastAction} onSelect={(chip) => handleSubmit(chip)} />
      )}

      {/* Input Area */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAgentRunning ? "Agent is working..." : "Describe what you want to build..."}
            disabled={isAgentRunning}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50 min-h-[36px] max-h-[200px] py-2 px-1"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isAgentRunning}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isAgentRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="text-[10px] text-muted-foreground">
            Press Enter to send, Shift+Enter for new line
          </span>
        </div>
      </div>
    </div>
  );
}
