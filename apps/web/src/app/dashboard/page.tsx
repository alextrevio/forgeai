"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  ArrowUp,
  ShoppingCart,
  BarChart3,
  Palette,
  MessageSquare,
  Smartphone,
  Globe,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const QUICK_CHIPS = [
  { icon: ShoppingCart, label: "E-commerce", prompt: "Crea un e-commerce con carrito de compras y checkout" },
  { icon: BarChart3, label: "Dashboard", prompt: "Crea un dashboard de analytics con gráficas interactivas" },
  { icon: Palette, label: "Portfolio", prompt: "Crea un portfolio personal con animaciones modernas" },
  { icon: MessageSquare, label: "Chat app", prompt: "Crea una app de chat en tiempo real con WebSockets" },
  { icon: Smartphone, label: "Mobile app", prompt: "Crea una app mobile-first responsive con PWA" },
  { icon: Globe, label: "Landing page", prompt: "Crea una landing page SaaS con pricing y testimonials" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore();
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
  }, [authLoading, isAuthenticated, router]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Focus textarea on mount
  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 300);
  }, [authLoading]);

  const handleSubmit = async (overridePrompt?: string) => {
    const content = (overridePrompt ?? input).trim();
    if (!content || isCreating) return;

    setIsCreating(true);
    try {
      // Create project with prompt as name (truncated) and send first message
      const projectName = content.length > 40 ? content.slice(0, 40) + "..." : content;
      const project = await api.createProject(projectName, "react-vite");
      // Send the first message
      try { await api.sendMessage(project.id, content); } catch { /* will be handled in workspace */ }
      router.push(`/project/${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "";

  if (authLoading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-6 w-6 animate-spin text-[#7c3aed]" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell onNewProject={() => textareaRef.current?.focus()}>
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-16">
        <div className="w-full max-w-2xl mx-auto text-center">
          {/* Sparkles icon */}
          <div className="mb-6 dashboard-hero-enter">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7c3aed]/10">
              <Sparkles className="h-7 w-7 text-[#7c3aed] animate-sparkle-pulse" />
            </div>
          </div>

          {/* Greeting */}
          <h1 className="text-3xl font-light text-[#EDEDED] mb-2 dashboard-hero-enter" style={{ animationDelay: "0.05s" }}>
            {firstName ? `${greeting}, ${firstName}` : "¿Qué quieres construir?"}
          </h1>
          {firstName && (
            <p className="text-[15px] text-[#555555] mb-8 dashboard-hero-enter" style={{ animationDelay: "0.1s" }}>
              ¿Qué quieres construir hoy?
            </p>
          )}
          {!firstName && <div className="mb-8" />}

          {/* Input area */}
          <div className="relative w-full dashboard-hero-enter" style={{ animationDelay: "0.15s" }}>
            <div className={cn(
              "rounded-2xl border bg-[#111111] transition-all duration-200",
              input.trim()
                ? "border-[#7c3aed]/40 shadow-lg shadow-[#7c3aed]/5"
                : "border-[#2A2A2A] hover:border-[#3A3A3A]"
            )}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe tu app ideal..."
                disabled={isCreating}
                rows={1}
                className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[14px] text-[#EDEDED] placeholder:text-[#555555] outline-none disabled:opacity-40 min-h-[56px] max-h-[160px] leading-relaxed"
              />
              {/* Bottom bar inside input */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {/* placeholder for future attachments */}
                </div>
                <button
                  onClick={() => handleSubmit()}
                  disabled={!input.trim() || isCreating}
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all duration-200",
                    input.trim() && !isCreating
                      ? "h-9 w-9 bg-[#7c3aed] text-white shadow-lg shadow-[#7c3aed]/25 hover:bg-[#6d28d9] hover:shadow-[#7c3aed]/40 hover:scale-105 active:scale-95"
                      : "h-9 w-9 bg-transparent text-[#555555] cursor-default"
                  )}
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUp className={cn("h-4 w-4 transition-opacity", input.trim() ? "opacity-100" : "opacity-0")} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick action chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5 dashboard-hero-enter" style={{ animationDelay: "0.25s" }}>
            {QUICK_CHIPS.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.label}
                  onClick={() => {
                    setInput(chip.prompt);
                    setTimeout(() => textareaRef.current?.focus(), 50);
                  }}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-transparent px-4 py-2 text-[13px] text-[#999999] hover:text-[#EDEDED] hover:bg-[#1A1A1A] hover:border-[#3A3A3A] transition-all duration-150 disabled:opacity-40"
                >
                  <Icon className="h-3.5 w-3.5 text-[#555555]" />
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Hint */}
          <p className="text-[11px] text-[#555555]/60 mt-6 dashboard-hero-enter" style={{ animationDelay: "0.35s" }}>
            Enter para enviar · Shift+Enter nueva línea
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
