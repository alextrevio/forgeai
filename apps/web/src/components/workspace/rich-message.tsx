"use client";

import { useState, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ExternalLink,
  FileText,
  FilePlus2,
  FileEdit,
  FileX,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message, AgentPlan, CodeChange, ReviewReport } from "@forgeai/shared";

interface RichMessageProps {
  message: Message;
  onOpenFile?: (path: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export function RichMessage({ message, onOpenFile, onRegenerate }: RichMessageProps) {
  const [hovering, setHovering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [message.content]);

  const messageType = message.messageType || inferMessageType(message);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Message Actions (hover) */}
      {message.role === "ASSISTANT" && hovering && (
        <div className="absolute -top-3 right-0 flex items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm z-10">
          <button
            onClick={() => setFeedback("up")}
            className={cn(
              "rounded p-1 transition-colors",
              feedback === "up" ? "text-green-500" : "text-muted-foreground hover:text-foreground"
            )}
            title="Helpful"
          >
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => setFeedback("down")}
            className={cn(
              "rounded p-1 transition-colors",
              feedback === "down" ? "text-red-500" : "text-muted-foreground hover:text-foreground"
            )}
            title="Not helpful"
          >
            <ThumbsDown className="h-3 w-3" />
          </button>
          <button
            onClick={handleCopy}
            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </button>
          {onRegenerate && (
            <button
              onClick={() => onRegenerate(message.id)}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Regenerate"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Render based on message type */}
      {messageType === "plan" && message.plan ? (
        <PlanMessage plan={message.plan} />
      ) : messageType === "file_change" && message.codeChanges ? (
        <FileChangeMessage changes={message.codeChanges} onOpenFile={onOpenFile} />
      ) : messageType === "error" ? (
        <ErrorMessage content={message.content} />
      ) : messageType === "review" ? (
        <ReviewMessage content={message.content} />
      ) : messageType === "deploy" ? (
        <DeployMessage content={message.content} />
      ) : messageType === "system" ? (
        <SystemMessage content={message.content} />
      ) : messageType === "code" ? (
        <CodeMessage content={message.content} />
      ) : (
        <TextMessage content={message.content} />
      )}
    </div>
  );
}

function inferMessageType(message: Message): string | null {
  if (message.plan) return "plan";
  if (message.codeChanges && message.codeChanges.length > 0) return "file_change";
  if (message.role === "SYSTEM") return "system";

  const content = message.content.toLowerCase();
  if (content.includes("error") && content.includes("fix")) return "error";
  if (content.includes("review") && content.includes("score")) return "review";
  if (content.includes("deployed") && content.includes("url")) return "deploy";
  if (content.includes("```")) return "code";

  return null;
}

// ─── Plan Message ────────────────────────────────────────────────

function PlanMessage({ plan }: { plan: AgentPlan }) {
  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "in_progress": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Circle className="h-4 w-4 text-muted-foreground/50" />;
    }
  };

  const completed = plan.steps.filter((s) => s.status === "completed").length;
  const total = plan.steps.length;

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</span>
          <span className="text-xs text-muted-foreground">{completed}/{total} steps</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="px-4 py-2 text-xs text-foreground/80">{plan.understanding}</div>
      <div className="px-4 pb-3 space-y-1.5">
        {plan.steps.map((step) => (
          <div key={step.id} className="flex items-start gap-2">
            {getStepIcon(step.status)}
            <span
              className={cn(
                "text-xs leading-5",
                step.status === "completed" ? "text-muted-foreground line-through" :
                step.status === "in_progress" ? "text-foreground font-medium" :
                step.status === "failed" ? "text-red-400" :
                "text-muted-foreground"
              )}
            >
              {step.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Code Message ────────────────────────────────────────────────

function CodeMessage({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const textParts = content.split(/```[\s\S]*?```/);

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2 text-sm">
      {textParts.map((text, i) => (
        <div key={`t${i}`}>
          {text.trim() && (
            <div className="whitespace-pre-wrap text-foreground">{text.trim()}</div>
          )}
          {codeBlocks[i] && (() => {
            const raw = codeBlocks[i];
            const langMatch = raw.match(/```(\w+)?/);
            const lang = langMatch?.[1] || "";
            const code = raw.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
            return (
              <div className="relative rounded-lg border border-border bg-[#0d0d1a] overflow-hidden my-2">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-muted/20">
                  <span className="text-[10px] text-muted-foreground uppercase">{lang || "code"}</span>
                  <button
                    onClick={() => handleCopy(code)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto">
                  <code className="text-xs font-mono text-foreground/90">{code}</code>
                </pre>
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

// ─── File Change Message ─────────────────────────────────────────

function FileChangeMessage({ changes, onOpenFile }: { changes: CodeChange[]; onOpenFile?: (path: string) => void }) {
  const actionIcons = {
    create: <FilePlus2 className="h-3.5 w-3.5 text-green-500" />,
    edit: <FileEdit className="h-3.5 w-3.5 text-amber-500" />,
    delete: <FileX className="h-3.5 w-3.5 text-red-500" />,
  };
  const actionLabels = { create: "Created", edit: "Modified", delete: "Deleted" };

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <div className="px-3 py-2 border-b border-border bg-muted/20">
        <span className="text-xs font-medium text-muted-foreground">
          {changes.length} file{changes.length !== 1 ? "s" : ""} changed
        </span>
      </div>
      <div className="divide-y divide-border/50">
        {changes.map((change, i) => (
          <button
            key={i}
            onClick={() => onOpenFile?.(change.file)}
            className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-muted/30 transition-colors"
          >
            {actionIcons[change.action] || <FileText className="h-3.5 w-3.5" />}
            <span className="text-xs font-mono text-foreground flex-1 truncate">{change.file}</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              change.action === "create" ? "bg-green-500/10 text-green-400" :
              change.action === "edit" ? "bg-amber-500/10 text-amber-400" :
              "bg-red-500/10 text-red-400"
            )}>
              {actionLabels[change.action]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Error Message ───────────────────────────────────────────────

function ErrorMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split("\n");
  const summary = lines[0];
  const details = lines.slice(1).join("\n");

  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/5">
      <div className="px-3 py-2 flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-red-300">{summary}</div>
          {details.trim() && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 mt-1 text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "Hide details" : "Show details"}
            </button>
          )}
          {expanded && details.trim() && (
            <pre className="mt-2 text-[10px] font-mono text-red-300/70 whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">
              {details}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Review Message ──────────────────────────────────────────────

function ReviewMessage({ content }: { content: string }) {
  // Try to parse score from content
  const scoreMatch = content.match(/score[:\s]*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <div className="px-3 py-2 border-b border-border bg-muted/20 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Code Review</span>
        {score !== null && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
            score >= 90 ? "bg-green-500/10 text-green-400" :
            score >= 70 ? "bg-amber-500/10 text-amber-400" :
            "bg-red-500/10 text-red-400"
          )}>
            <Star className="h-3 w-3" />
            {score}/100
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-foreground/80 whitespace-pre-wrap">{content}</div>
    </div>
  );
}

// ─── Deploy Message ──────────────────────────────────────────────

function DeployMessage({ content }: { content: string }) {
  const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch?.[1];

  return (
    <div className="rounded-lg border border-green-500/20 bg-green-500/5">
      <div className="px-3 py-2 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-green-300 whitespace-pre-wrap">{content}</div>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1 text-xs text-green-400 hover:text-green-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open deployment
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── System Message ──────────────────────────────────────────────

function SystemMessage({ content }: { content: string }) {
  return (
    <div className="px-3 py-1.5 rounded bg-muted/30 text-xs text-muted-foreground italic">
      {content}
    </div>
  );
}

// ─── Text Message ────────────────────────────────────────────────

function TextMessage({ content }: { content: string }) {
  return (
    <div className="text-sm text-foreground whitespace-pre-wrap break-words">{content}</div>
  );
}
