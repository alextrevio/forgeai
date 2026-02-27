"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowUp,
  Paperclip,
  Loader2,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";

const QUICK_CHIPS = [
  { emoji: "\uD83D\uDED2", label: "E-commerce" },
  { emoji: "\uD83D\uDCCA", label: "Dashboard" },
  { emoji: "\uD83C\uDFA8", label: "Portfolio" },
  { emoji: "\uD83D\uDCF1", label: "Mobile app" },
  { emoji: "\uD83D\uDD0D", label: "Investigar" },
  { emoji: "\uD83D\uDCC4", label: "Reporte" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addToast } = useToast();

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
  }, [authLoading, isAuthenticated, router]);

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
      } catch {
        addToast("warning", "Engine could not start — you can retry from the project page.");
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
    const text = `${chip.emoji} ${chip.label}`;
    setPrompt((prev) => (prev ? prev + " " + text : text));
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
        {/* Greeting */}
        <div className="flex flex-col items-center animate-fade-in-up">
          <Sparkles className="w-10 h-10 text-[#7c3aed] animate-sparkle-pulse" />
          <h1 className="text-3xl font-light text-[#EDEDED] mt-4 text-center">
            {greeting}, {firstName}
          </h1>
          <p className="text-3xl font-light text-[#EDEDED] mt-1 text-center">
            ¿Qué quieres lograr hoy?
          </p>
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
            className="absolute left-4 bottom-3 text-[#555555] hover:text-[#999] transition-colors"
            title="Adjuntar archivo"
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
