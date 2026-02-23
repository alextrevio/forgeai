"use client";

import { Sparkles, Paintbrush, Search, BarChart3, Shield, FileText, Wand2 } from "lucide-react";

interface SuggestionChipsProps {
  lastAction: string | null;
  onSelect: (chip: string) => void;
}

const SUGGESTION_MAP: Record<string, { chips: string[]; icon: React.ReactNode }> = {
  ui: { chips: ["Add dark mode toggle", "Make it responsive", "Add animations", "Improve the design"], icon: <Paintbrush className="h-2.5 w-2.5" /> },
  crud: { chips: ["Add search functionality", "Add pagination", "Add filters", "Add sorting"], icon: <Search className="h-2.5 w-2.5" /> },
  landing: { chips: ["Add contact form", "Add testimonials", "Add pricing section", "Add FAQ"], icon: <FileText className="h-2.5 w-2.5" /> },
  dashboard: { chips: ["Add charts", "Add analytics", "Export to CSV", "Add date filters"], icon: <BarChart3 className="h-2.5 w-2.5" /> },
  auth: { chips: ["Add forgot password", "Add social login", "Add user profile", "Add role-based access"], icon: <Shield className="h-2.5 w-2.5" /> },
  form: { chips: ["Add form validation", "Add file upload", "Add auto-save", "Add multi-step form"], icon: <FileText className="h-2.5 w-2.5" /> },
  default: { chips: ["Add loading states", "Improve error handling", "Add empty states", "Polish the UI"], icon: <Wand2 className="h-2.5 w-2.5" /> },
};

export function SuggestionChips({ lastAction, onSelect }: SuggestionChipsProps) {
  const { chips, icon } = getSuggestions(lastAction);
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2 border-t border-border/30">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[#13131a] px-2.5 py-1 text-[11px] text-[#8888a0] hover:text-[#e2e2e8] hover:border-[#7c3aed]/30 hover:bg-[#7c3aed]/5 transition-all duration-150 hover:scale-[1.02] cursor-pointer"
        >
          <span className="text-[#7c3aed]/50">{icon}</span>
          {chip}
        </button>
      ))}
    </div>
  );
}

function getSuggestions(lastAction: string | null): { chips: string[]; icon: React.ReactNode } {
  if (!lastAction) return SUGGESTION_MAP.default;

  const lower = lastAction.toLowerCase();
  if (lower.includes("button") || lower.includes("card") || lower.includes("component") || lower.includes("ui")) return SUGGESTION_MAP.ui;
  if (lower.includes("crud") || lower.includes("create") || lower.includes("list") || lower.includes("table")) return SUGGESTION_MAP.crud;
  if (lower.includes("landing") || lower.includes("hero") || lower.includes("homepage")) return SUGGESTION_MAP.landing;
  if (lower.includes("dashboard") || lower.includes("stats") || lower.includes("analytics")) return SUGGESTION_MAP.dashboard;
  if (lower.includes("auth") || lower.includes("login") || lower.includes("register")) return SUGGESTION_MAP.auth;
  if (lower.includes("form") || lower.includes("input") || lower.includes("submit")) return SUGGESTION_MAP.form;
  return SUGGESTION_MAP.default;
}
