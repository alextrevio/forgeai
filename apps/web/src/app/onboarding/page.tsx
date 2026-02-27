"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Globe,
  Smartphone,
  Server,
  Layout,
  BarChart3,
  ShoppingCart,
  Rocket,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Step 1: Project types ───────────────────────────────────

const PROJECT_TYPES = [
  { id: "web-apps", label: "Web Apps", icon: Globe, description: "SPAs, dashboards, portales" },
  { id: "landing", label: "Landing Pages", icon: Layout, description: "Marketing, producto, startup" },
  { id: "saas", label: "SaaS", icon: BarChart3, description: "Productos con auth y billing" },
  { id: "ecommerce", label: "E-commerce", icon: ShoppingCart, description: "Tiendas online, marketplaces" },
  { id: "mobile", label: "Mobile", icon: Smartphone, description: "Apps responsivas, PWAs" },
  { id: "apis", label: "APIs", icon: Server, description: "REST APIs, backends" },
];

// ── Step 2: Stack ────────────────────────────────────────────

const STACKS = [
  { id: "react-vite", label: "React + Vite", color: "#61dafb" },
  { id: "nextjs", label: "Next.js", color: "#EDEDED" },
  { id: "vue", label: "Vue", color: "#42b883" },
  { id: "landing", label: "Landing (HTML)", color: "#f59e0b" },
  { id: "dashboard", label: "Dashboard", color: "#7c3aed" },
  { id: "api-only", label: "API Only", color: "#3b82f6" },
];

// ── Step 3: Templates ────────────────────────────────────────

const STARTER_TEMPLATES = [
  { id: "blank", name: "Proyecto en blanco", desc: "Empieza desde cero" },
  { id: "landing-page", name: "Landing Page", desc: "Hero, features, pricing, CTA" },
  { id: "dashboard", name: "Dashboard", desc: "Charts, tablas, sidebar" },
  { id: "saas-starter", name: "SaaS Starter", desc: "Auth, billing, settings" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, loadUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedStack, setSelectedStack] = useState<string>("react-vite");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("blank");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    // If already onboarded, skip
    const settings = user?.settings as Record<string, unknown> | null;
    if (settings?.onboarded) { router.push("/dashboard"); }
  }, [authLoading, isAuthenticated, user, router]);

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      // Save preferences
      await api.updateUserSettings({
        projectTypes: selectedTypes,
        defaultFramework: selectedStack,
        preferredTemplate: selectedTemplate,
        onboarded: true,
      });

      // Create first project if template selected
      if (selectedTemplate !== "blank") {
        await api.createProject(
          STARTER_TEMPLATES.find((t) => t.id === selectedTemplate)?.name || "Mi primer proyecto",
          selectedStack,
          undefined,
          selectedTemplate
        );
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Onboarding save failed:", err);
      // Still redirect even if save fails
      router.push("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = step === 1 ? selectedTypes.length > 0 : true;

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.08)_0%,transparent_60%)]" />

      <div className="relative flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <Sparkles className="h-6 w-6 text-[#7c3aed]" />
          <span className="text-xl font-bold">Arya AI</span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                s < step ? "bg-[#22c55e] text-white" :
                s === step ? "bg-[#7c3aed] text-white" :
                "bg-[#2A2A2A] text-[#8888a0]"
              )}>
                {s < step ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={cn("w-12 h-0.5 rounded-full transition-all", s < step ? "bg-[#22c55e]" : "bg-[#2A2A2A]")} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="w-full max-w-2xl">
          {/* ─── Step 1: Project Types ─────────────── */}
          {step === 1 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">Que tipo de proyectos construyes?</h1>
                <p className="text-[#8888a0]">Selecciona todos los que apliquen</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PROJECT_TYPES.map((type) => {
                  const selected = selectedTypes.includes(type.id);
                  return (
                    <button
                      key={type.id}
                      onClick={() => toggleType(type.id)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all",
                        selected
                          ? "border-[#7c3aed] bg-[#7c3aed]/10"
                          : "border-[#2A2A2A] bg-[#111111] hover:border-[#7c3aed]/30"
                      )}
                    >
                      <type.icon className={cn("h-6 w-6 mb-2", selected ? "text-[#7c3aed]" : "text-[#8888a0]")} />
                      <p className="text-sm font-semibold text-[#EDEDED]">{type.label}</p>
                      <p className="text-xs text-[#8888a0] mt-0.5">{type.description}</p>
                      {selected && <Check className="h-4 w-4 text-[#7c3aed] mt-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Step 2: Stack ─────────────────────── */}
          {step === 2 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">Cual es tu stack favorito?</h1>
                <p className="text-[#8888a0]">Lo usaremos como default para tus proyectos</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STACKS.map((stack) => {
                  const selected = selectedStack === stack.id;
                  return (
                    <button
                      key={stack.id}
                      onClick={() => setSelectedStack(stack.id)}
                      className={cn(
                        "rounded-xl border p-5 text-center transition-all",
                        selected
                          ? "border-[#7c3aed] bg-[#7c3aed]/10"
                          : "border-[#2A2A2A] bg-[#111111] hover:border-[#7c3aed]/30"
                      )}
                    >
                      <div className="w-3 h-3 rounded-full mx-auto mb-3" style={{ backgroundColor: stack.color }} />
                      <p className="text-sm font-semibold text-[#EDEDED]">{stack.label}</p>
                      {selected && <Check className="h-4 w-4 text-[#7c3aed] mx-auto mt-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Step 3: First Project ─────────────── */}
          {step === 3 && (
            <div className="animate-fade-in-up">
              <div className="text-center mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">Listo! Prueba tu primer proyecto</h1>
                <p className="text-[#8888a0]">Elige un template para empezar o comienza en blanco</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STARTER_TEMPLATES.map((template) => {
                  const selected = selectedTemplate === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={cn(
                        "rounded-xl border p-5 text-left transition-all",
                        selected
                          ? "border-[#7c3aed] bg-[#7c3aed]/10"
                          : "border-[#2A2A2A] bg-[#111111] hover:border-[#7c3aed]/30"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#EDEDED]">{template.name}</p>
                          <p className="text-xs text-[#8888a0] mt-0.5">{template.desc}</p>
                        </div>
                        {selected && <Check className="h-5 w-5 text-[#7c3aed] shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-4 mt-10">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 rounded-xl border border-[#2A2A2A] px-6 py-3 text-sm font-medium text-[#8888a0] hover:text-[#EDEDED] hover:border-[#7c3aed]/30 transition-all">
              <ArrowLeft className="h-4 w-4" /> Atras
            </button>
          )}

          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canProceed}
              className={cn(
                "flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all",
                canProceed
                  ? "bg-[#7c3aed] text-white hover:bg-[#6d28d9] shadow-lg shadow-[#7c3aed]/20"
                  : "bg-[#2A2A2A] text-[#8888a0] cursor-not-allowed"
              )}>
              Siguiente <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={handleComplete} disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-[#7c3aed] px-8 py-3 text-sm font-semibold text-white hover:bg-[#6d28d9] transition-all shadow-lg shadow-[#7c3aed]/20 disabled:opacity-50">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {isSubmitting ? "Creando..." : "Empezar a construir"}
            </button>
          )}
        </div>

        {/* Skip link */}
        <button onClick={() => { api.updateUserSettings({ onboarded: true }).catch(() => {}); router.push("/dashboard"); }}
          className="mt-4 text-xs text-[#8888a0] hover:text-[#EDEDED] transition-colors">
          Saltar por ahora
        </button>
      </div>
    </div>
  );
}
