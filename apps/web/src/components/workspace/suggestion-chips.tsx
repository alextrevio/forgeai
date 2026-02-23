"use client";

import { Sparkles } from "lucide-react";

interface SuggestionChipsProps {
  lastAction: string | null;
  onSelect: (chip: string) => void;
}

const SUGGESTION_MAP: Record<string, string[]> = {
  // After creating UI components
  ui: ["Add dark mode toggle", "Make it responsive", "Add animations", "Improve the design"],
  // After CRUD operations
  crud: ["Add search functionality", "Add pagination", "Add filters", "Add sorting"],
  // After landing page
  landing: ["Add contact form", "Add testimonials", "Add pricing section", "Add FAQ"],
  // After dashboard
  dashboard: ["Add charts", "Add analytics", "Export to CSV", "Add date filters"],
  // After authentication
  auth: ["Add forgot password", "Add social login", "Add user profile", "Add role-based access"],
  // After forms
  form: ["Add form validation", "Add file upload", "Add auto-save", "Add multi-step form"],
  // Generic improvements
  default: ["Add loading states", "Improve error handling", "Add empty states", "Polish the UI"],
};

export function SuggestionChips({ lastAction, onSelect }: SuggestionChipsProps) {
  const chips = getSuggestions(lastAction);
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2 border-t border-border/50">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/10 transition-all cursor-pointer"
        >
          <Sparkles className="h-2.5 w-2.5 text-primary/60" />
          {chip}
        </button>
      ))}
    </div>
  );
}

function getSuggestions(lastAction: string | null): string[] {
  if (!lastAction) return SUGGESTION_MAP.default;

  const lower = lastAction.toLowerCase();

  if (lower.includes("button") || lower.includes("card") || lower.includes("component") || lower.includes("ui")) {
    return SUGGESTION_MAP.ui;
  }
  if (lower.includes("crud") || lower.includes("create") || lower.includes("list") || lower.includes("table")) {
    return SUGGESTION_MAP.crud;
  }
  if (lower.includes("landing") || lower.includes("hero") || lower.includes("homepage")) {
    return SUGGESTION_MAP.landing;
  }
  if (lower.includes("dashboard") || lower.includes("stats") || lower.includes("analytics")) {
    return SUGGESTION_MAP.dashboard;
  }
  if (lower.includes("auth") || lower.includes("login") || lower.includes("register")) {
    return SUGGESTION_MAP.auth;
  }
  if (lower.includes("form") || lower.includes("input") || lower.includes("submit")) {
    return SUGGESTION_MAP.form;
  }

  return SUGGESTION_MAP.default;
}
