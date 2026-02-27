"use client";

import { cn } from "@/lib/utils";

// ══════════════════════════════════════════════════════════════════
// AGENT STYLES — Shared visual identity for each agent type
// ══════════════════════════════════════════════════════════════════

export const AGENT_STYLES: Record<
  string,
  { icon: string; color: string; bg: string; text: string; label: string }
> = {
  coder:    { icon: "💻", color: "#3b82f6", bg: "bg-[#3b82f6]/10", text: "text-[#60a5fa]", label: "Coder Agent" },
  research: { icon: "🔍", color: "#8b5cf6", bg: "bg-[#8b5cf6]/10", text: "text-[#a78bfa]", label: "Research Agent" },
  designer: { icon: "🎨", color: "#ec4899", bg: "bg-[#ec4899]/10", text: "text-[#f472b6]", label: "Designer Agent" },
  analyst:  { icon: "📊", color: "#f59e0b", bg: "bg-[#f59e0b]/10", text: "text-[#fbbf24]", label: "Analyst Agent" },
  writer:   { icon: "✍️", color: "#10b981", bg: "bg-[#10b981]/10", text: "text-[#34d399]", label: "Writer Agent" },
  deploy:   { icon: "🚀", color: "#ef4444", bg: "bg-[#ef4444]/10", text: "text-[#f87171]", label: "Deploy Agent" },
  qa:       { icon: "🔒", color: "#06b6d4", bg: "bg-[#06b6d4]/10", text: "text-[#22d3ee]", label: "QA Agent" },
  planner:  { icon: "🧠", color: "#7c3aed", bg: "bg-[#7c3aed]/10", text: "text-[#a78bfa]", label: "Orchestrator" },
};

const DEFAULT_STYLE = { icon: "⚙️", color: "#8888a0", bg: "bg-[#2A2A2A]", text: "text-[#8888a0]", label: "Agent" };

export function getAgentStyle(agentType: string) {
  return AGENT_STYLES[agentType] || DEFAULT_STYLE;
}

// ══════════════════════════════════════════════════════════════════
// AGENT BADGE — Visual pill identifying an agent
// ══════════════════════════════════════════════════════════════════

interface AgentBadgeProps {
  agentType: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function AgentBadge({ agentType, size = "md", showLabel = true, className }: AgentBadgeProps) {
  const style = getAgentStyle(agentType);

  const sizeClasses = {
    sm: "text-[9px] px-1.5 py-0.5 gap-1",
    md: "text-[10px] px-2 py-0.5 gap-1.5",
    lg: "text-[11px] px-2.5 py-1 gap-1.5",
  };

  const iconSizes = {
    sm: "text-[10px]",
    md: "text-[12px]",
    lg: "text-[14px]",
  };

  const dotSizes = {
    sm: "h-1 w-1",
    md: "h-1.5 w-1.5",
    lg: "h-2 w-2",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium shrink-0",
        style.bg,
        style.text,
        sizeClasses[size],
        className
      )}
    >
      <span className={iconSizes[size]}>{style.icon}</span>
      {showLabel && <span>{style.label}</span>}
      <span
        className={cn("rounded-full shrink-0", dotSizes[size])}
        style={{ backgroundColor: style.color }}
      />
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════
// AGENT AVATAR — Colored circle with icon (for chat messages)
// ══════════════════════════════════════════════════════════════════

interface AgentAvatarProps {
  agentType: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AgentAvatar({ agentType, size = "md", className }: AgentAvatarProps) {
  const style = getAgentStyle(agentType);

  const sizeClasses = {
    sm: "h-5 w-5 text-[10px]",
    md: "h-7 w-7 text-[13px]",
    lg: "h-9 w-9 text-[16px]",
  };

  return (
    <div
      className={cn(
        "rounded-lg flex items-center justify-center shrink-0",
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: `${style.color}20` }}
    >
      <span>{style.icon}</span>
    </div>
  );
}
