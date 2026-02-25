"use client";

import { Sparkles, Paintbrush, Search, BarChart3, Shield, FileText, Wand2 } from "lucide-react";

interface SuggestionChipsProps {
  lastAction: string | null;
  onSelect: (chip: string) => void;
}

const SUGGESTION_MAP: Record<string, { chips: string[]; icon: React.ReactNode }> = {
  ui: { chips: ["Agregar modo oscuro", "Hacerlo responsive", "Agregar animaciones", "Mejorar el diseño"], icon: <Paintbrush className="h-2.5 w-2.5" /> },
  crud: { chips: ["Agregar búsqueda", "Agregar paginación", "Agregar filtros", "Agregar ordenamiento"], icon: <Search className="h-2.5 w-2.5" /> },
  landing: { chips: ["Agregar formulario de contacto", "Agregar testimonios", "Agregar sección de precios", "Agregar FAQ"], icon: <FileText className="h-2.5 w-2.5" /> },
  dashboard: { chips: ["Agregar gráficos", "Agregar analytics", "Exportar a CSV", "Agregar filtros de fecha"], icon: <BarChart3 className="h-2.5 w-2.5" /> },
  auth: { chips: ["Agregar recuperar contraseña", "Agregar login social", "Agregar perfil de usuario", "Agregar roles de acceso"], icon: <Shield className="h-2.5 w-2.5" /> },
  form: { chips: ["Agregar validación", "Agregar subida de archivos", "Agregar auto-guardado", "Agregar formulario multi-paso"], icon: <FileText className="h-2.5 w-2.5" /> },
  default: { chips: ["Agregar estados de carga", "Mejorar manejo de errores", "Agregar estados vacíos", "Pulir la interfaz"], icon: <Wand2 className="h-2.5 w-2.5" /> },
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
