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
    try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }, [message.content]);

  const messageType = message.messageType || inferMessageType(message);

  return (
    <div className="relative group" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      {/* Hover Actions */}
      {message.role === "ASSISTANT" && hovering && (
        <div className="absolute -top-3 right-0 flex items-center gap-0.5 rounded-lg border border-border bg-[#13131a] px-1 py-0.5 shadow-lg z-10 animate-fade-in">
          <button onClick={() => setFeedback("up")} className={cn("rounded-md p-1 transition-all duration-150", feedback === "up" ? "text-[#4ade80] bg-[#4ade80]/10" : "text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#1a1a24]")} title="Helpful">
            <ThumbsUp className="h-3 w-3" />
          </button>
          <button onClick={() => setFeedback("down")} className={cn("rounded-md p-1 transition-all duration-150", feedback === "down" ? "text-[#f87171] bg-[#f87171]/10" : "text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#1a1a24]")} title="Not helpful">
            <ThumbsDown className="h-3 w-3" />
          </button>
          <button onClick={handleCopy} className="rounded-md p-1 text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#1a1a24] transition-all duration-150" title="Copy">
            {copied ? <Check className="h-3 w-3 text-[#4ade80]" /> : <Copy className="h-3 w-3" />}
          </button>
          {onRegenerate && (
            <button onClick={() => onRegenerate(message.id)} className="rounded-md p-1 text-[#8888a0] hover:text-[#e2e2e8] hover:bg-[#1a1a24] transition-all duration-150" title="Regenerate">
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {messageType === "plan" && message.plan ? <PlanMessage plan={message.plan} /> :
       messageType === "file_change" && message.codeChanges ? <FileChangeMessage changes={message.codeChanges} onOpenFile={onOpenFile} /> :
       messageType === "error" ? <ErrorMessage content={message.content} /> :
       messageType === "review" ? <ReviewMessage content={message.content} /> :
       messageType === "deploy" ? <DeployMessage content={message.content} /> :
       messageType === "system" ? <SystemMessage content={message.content} /> :
       messageType === "code" ? <CodeMessage content={message.content} /> :
       <TextMessage content={message.content} />}
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

function PlanMessage({ plan }: { plan: AgentPlan }) {
  const getStepIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-[#4ade80]" />;
      case "in_progress": return <Loader2 className="h-3.5 w-3.5 text-[#a78bfa] animate-spin" />;
      case "failed": return <XCircle className="h-3.5 w-3.5 text-[#f87171]" />;
      default: return <Circle className="h-3.5 w-3.5 text-[#8888a0]/30" />;
    }
  };
  const completed = (plan?.steps || []).filter((s) => s.status === "completed").length;
  const total = (plan?.steps || []).length;

  return (
    <div className="rounded-xl border border-border bg-[#13131a] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-[#0e0e14]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold text-[#8888a0]/60 uppercase tracking-widest">Plan</span>
          <span className="text-[10px] text-[#8888a0]">{completed}/{total}</span>
        </div>
        <div className="h-1 rounded-full bg-[#1a1a24] overflow-hidden">
          <div className="h-full progress-animated transition-all duration-500" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="px-4 py-2 text-xs text-[#e2e2e8]/70 leading-relaxed">{plan.understanding}</div>
      <div className="px-4 pb-3 space-y-1">
        {(plan?.steps || []).map((step) => (
          <div key={step.id} className="flex items-start gap-2">
            {getStepIcon(step.status)}
            <span className={cn("text-xs leading-5", step.status === "completed" ? "text-[#8888a0] line-through" : step.status === "in_progress" ? "text-[#e2e2e8] font-medium" : step.status === "failed" ? "text-[#f87171]" : "text-[#8888a0]/50")}>
              {step.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeMessage({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const textParts = content.split(/```[\s\S]*?```/);

  const handleCopy = async (code: string) => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="space-y-2 text-sm">
      {textParts.map((text, i) => (
        <div key={`t${i}`}>
          {text.trim() && <div className="whitespace-pre-wrap text-[#e2e2e8] leading-relaxed">{text.trim()}</div>}
          {codeBlocks[i] && (() => {
            const raw = codeBlocks[i];
            const langMatch = raw.match(/```(\w+)?/);
            const lang = langMatch?.[1] || "";
            const code = raw.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
            return (
              <div className="relative rounded-xl border border-border bg-[#08080d] overflow-hidden my-2">
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/50 bg-[#0a0a0f]">
                  <span className="text-[10px] text-[#8888a0]/40 uppercase tracking-wider">{lang || "code"}</span>
                  <button onClick={() => handleCopy(code)} className="text-[#8888a0] hover:text-[#e2e2e8] transition-all duration-150">
                    {copied ? <Check className="h-3 w-3 text-[#4ade80]" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto"><code className="text-[11px] font-mono text-[#e2e2e8]/80 leading-relaxed">{code}</code></pre>
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function FileChangeMessage({ changes, onOpenFile }: { changes: CodeChange[]; onOpenFile?: (path: string) => void }) {
  const actionIcons = {
    create: <FilePlus2 className="h-3.5 w-3.5 text-[#4ade80]" />,
    edit: <FileEdit className="h-3.5 w-3.5 text-[#fbbf24]" />,
    delete: <FileX className="h-3.5 w-3.5 text-[#f87171]" />,
  };
  const actionLabels = { create: "Created", edit: "Modified", delete: "Deleted" };

  return (
    <div className="rounded-xl border border-border bg-[#13131a] overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-[#0e0e14]">
        <span className="text-[10px] font-semibold text-[#8888a0]/60 uppercase tracking-widest">{(changes || []).length} file{(changes || []).length !== 1 ? "s" : ""} changed</span>
      </div>
      <div className="divide-y divide-border/30">
        {(changes || []).map((change, i) => (
          <button key={i} onClick={() => onOpenFile?.(change.file)} className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-[#1a1a24]/50 transition-all duration-100">
            {actionIcons[change.action] || <FileText className="h-3.5 w-3.5" />}
            <span className="text-[11px] font-mono text-[#e2e2e8]/80 flex-1 truncate">{change.file}</span>
            <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium", change.action === "create" ? "bg-[#4ade80]/10 text-[#4ade80]" : change.action === "edit" ? "bg-[#fbbf24]/10 text-[#fbbf24]" : "bg-[#f87171]/10 text-[#f87171]")}>
              {actionLabels[change.action]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ErrorMessage({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split("\n");
  const summary = lines[0];
  const details = lines.slice(1).join("\n");

  return (
    <div className="rounded-xl border border-[#f87171]/15 bg-[#f87171]/5">
      <div className="px-3 py-2 flex items-start gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-[#f87171] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#fca5a5] leading-relaxed">{summary}</div>
          {details.trim() && (
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 mt-1 text-[10px] text-[#f87171]/40 hover:text-[#f87171] transition-all duration-150">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "Hide details" : "Show details"}
            </button>
          )}
          {expanded && details.trim() && <pre className="mt-2 text-[10px] font-mono text-[#fca5a5]/60 whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto">{details}</pre>}
        </div>
      </div>
    </div>
  );
}

function ReviewMessage({ content }: { content: string }) {
  const scoreMatch = content.match(/score[:\s]*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

  return (
    <div className="rounded-xl border border-border bg-[#13131a] overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-[#0e0e14] flex items-center justify-between">
        <span className="text-[10px] font-semibold text-[#8888a0]/60 uppercase tracking-widest">Code Review</span>
        {score !== null && (
          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", score >= 90 ? "bg-[#4ade80]/10 text-[#4ade80]" : score >= 70 ? "bg-[#fbbf24]/10 text-[#fbbf24]" : "bg-[#f87171]/10 text-[#f87171]")}>
            <Star className="h-2.5 w-2.5" /> {score}/100
          </div>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-[#e2e2e8]/70 whitespace-pre-wrap leading-relaxed">{content}</div>
    </div>
  );
}

function DeployMessage({ content }: { content: string }) {
  const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch?.[1];

  return (
    <div className="rounded-xl border border-[#4ade80]/15 bg-[#4ade80]/5">
      <div className="px-3 py-2 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-[#4ade80] shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-[#86efac] whitespace-pre-wrap leading-relaxed">{content}</div>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-[11px] text-[#4ade80] hover:text-[#86efac] transition-all duration-150">
              <ExternalLink className="h-3 w-3" /> Open deployment
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SystemMessage({ content }: { content: string }) {
  return <div className="px-3 py-1.5 rounded-lg bg-[#1a1a24]/50 text-[11px] text-[#8888a0]/60 italic">{content}</div>;
}

function TextMessage({ content }: { content: string }) {
  return <div className="text-sm text-[#e2e2e8] whitespace-pre-wrap break-words leading-relaxed">{content}</div>;
}
