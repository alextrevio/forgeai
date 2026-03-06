"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowUp,
  Paperclip,
  Loader2,
  AlertTriangle,
  X,
  Brain,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";

const QUICK_CHIPS = [
  { emoji: "\uD83D\uDED2", label: "E-commerce", skillSlug: "ecommerce", prompt: "Crear una tienda online con catálogo de productos, carrito de compras y checkout" },
  { emoji: "\uD83D\uDCCA", label: "Dashboard", skillSlug: "dashboard", prompt: "Crear un dashboard de analytics con métricas KPI, gráficos y tablas de datos" },
  { emoji: "\uD83C\uDFA8", label: "Portfolio", skillSlug: "landing-page", prompt: "Crear un portfolio personal profesional con secciones de proyectos, about y contacto" },
  { emoji: "\uD83D\uDCF1", label: "React App", skillSlug: "react-app", prompt: "Crear una aplicación React moderna con routing, componentes reutilizables y dark mode" },
  { emoji: "\uD83D\uDD0D", label: "Blog", skillSlug: "blog", prompt: "Crear un blog con soporte de markdown, categorías, búsqueda y diseño editorial" },
  { emoji: "\u{1F680}", label: "REST API", skillSlug: "express-api", prompt: "Crear una REST API con Express, autenticación JWT, validación y base de datos" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addToast } = useToast();
  const [showApiKeyBanner, setShowApiKeyBanner] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [memorySummary, setMemorySummary] = useState<string | null>(null);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
  }, [authLoading, isAuthenticated, router]);

  // Check if user has configured their Anthropic API key + fetch memory summary
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const status = await api.getProviderKeyStatus();
        if (!status.anthropic) setShowApiKeyBanner(true);
      } catch { /* ignore */ }
      try {
        const data = await api.getMemorySummary();
        if (data.summary) setMemorySummary(data.summary);
      } catch { /* ignore */ }
    })();
  }, [isAuthenticated]);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "56px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => { adjustHeight(); }, [prompt, adjustHeight]);

  const handleSubmit = async () => {
    const text = prompt.trim();
    if (!text || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Create project with prompt as name (truncated) and description
      const name = text.length > 60 ? text.slice(0, 57) + "..." : text;
      const project = await api.createProject(name, "react-vite", text);
      // Start the engine
      try {
        await api.startEngine(project.id, text);
      } catch (engineErr: any) {
        const msg = engineErr?.message || "";
        if (msg.includes("credit balance") || msg.includes("insufficient") || engineErr?.status === 402) {
          addToast("error", "El proveedor de AI no tiene créditos. Verifica tu API key de Anthropic en console.anthropic.com.");
        } else if (msg.includes("API key") || msg.includes("authentication") || msg.includes("invalid_api_key")) {
          addToast("error", "API key inválida. Verifica tu configuración de Anthropic API key.");
        } else if (msg.includes("rate limit") || msg.includes("too many")) {
          addToast("warning", "Límite de solicitudes alcanzado. Espera un momento e intenta de nuevo.");
        } else {
          addToast("warning", "El engine no pudo iniciar — puedes reintentar desde la página del proyecto.");
        }
      }
      router.push(`/project/${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      addToast("error", "Failed to create project. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChipClick = (chip: typeof QUICK_CHIPS[number]) => {
    setPrompt(chip.prompt);
    textareaRef.current?.focus();
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Usuario";

  // Loading
  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-screen max-w-2xl w-full mx-auto px-6">
        {/* API Key Banner */}
        {showApiKeyBanner && !bannerDismissed && (
          <div className="w-full mb-6 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 p-4 flex items-center gap-3 animate-fade-in">
            <AlertTriangle className="h-4.5 w-4.5 text-[#f59e0b] shrink-0" />
            <p className="flex-1 text-sm text-[#EDEDED]">
              Configura tu API key de Anthropic para empezar a usar los agentes.{" "}
              <button
                onClick={() => router.push("/settings")}
                className="text-[#7c3aed] hover:text-[#6d28d9] font-medium transition-colors"
              >
                Configurar &rarr;
              </button>
            </p>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-[#8888a0] hover:text-[#EDEDED] transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Greeting */}
        <div className="flex flex-col items-center animate-fade-in-up">
          <Sparkles className="w-10 h-10 text-[#7c3aed] animate-sparkle-pulse" />
          <h1 className="text-3xl font-light text-[#EDEDED] mt-4 text-center">
            {greeting}, {firstName}
          </h1>
          <p className="text-3xl font-light text-[#EDEDED] mt-1 text-center">
            ¿Qué quieres lograr hoy?
          </p>
          {memorySummary && (
            <div className="flex items-center gap-2 mt-3 text-xs text-[#8888a0] animate-fade-in">
              <Brain className="h-3.5 w-3.5 text-[#7c3aed]" />
              <span>Arya recuerda tu stack: {memorySummary}</span>
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="relative w-full mt-8 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe lo que necesitas..."
            disabled={isSubmitting}
            rows={1}
            className="w-full rounded-2xl border border-[#2A2A2A] bg-[#111111] p-4 pb-12 pr-14 text-[#EDEDED] text-sm placeholder:text-[#555555] resize-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] focus:outline-none transition-colors disabled:opacity-60"
            style={{ minHeight: "56px", maxHeight: "200px" }}
          />
          {/* Attach button */}
          <button
            type="button"
            onClick={() => addToast("info", "Adjuntar archivos estará disponible próximamente.")}
            className="absolute left-4 bottom-3 text-[#555555] hover:text-[#999] transition-colors"
            title="Adjuntar archivo (próximamente)"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
          {/* Send button */}
          {prompt.trim() && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="absolute right-3 bottom-3 flex items-center justify-center w-9 h-9 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white transition-colors disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Quick action chips */}
        <div
          className="flex flex-wrap gap-2 mt-6 justify-center animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleChipClick(chip)}
              className="px-4 py-2 rounded-full border border-[#2A2A2A] bg-transparent hover:bg-[#1A1A1A] hover:border-[#3A3A3A] text-sm text-[#888] transition-all duration-200 cursor-pointer"
            >
              {chip.emoji} {chip.label}
            </button>
          ))}
        </div>

        {/* Subtitle */}
        <p className="text-sm text-[#555555] mt-8 text-center">
          Arya orquesta agentes especializados para entregar tu proyecto completo
        </p>

        {/* Footer */}
        <p className="text-xs text-[#444444] mt-12">
          Arya AI puede cometer errores. Verifica los resultados.
        </p>
      </div>
    </AppLayout>
  );
}
