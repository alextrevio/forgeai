"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Palette,
  Key,
  CreditCard,
  AlertTriangle,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Save,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "preferences" | "api-keys" | "billing" | "danger";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: "profile", label: "Perfil", icon: <User className="h-4 w-4" /> },
  { id: "preferences", label: "Preferencias", icon: <Palette className="h-4 w-4" /> },
  { id: "api-keys", label: "API Keys", icon: <Key className="h-4 w-4" /> },
  { id: "billing", label: "Facturación", icon: <CreditCard className="h-4 w-4" /> },
  { id: "danger", label: "Zona peligrosa", icon: <AlertTriangle className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadUser, isLoading: authLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const [fontSize, setFontSize] = useState(14);
  const [defaultFramework, setDefaultFramework] = useState("react-vite");
  const [autoSave, setAutoSave] = useState(true);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(10);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [usageSummary, setUsageSummary] = useState<{ totalSpent: number; monthlyBudget: number; plan: string } | null>(null);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    if (user) {
      setName(user.name || "");
      const settings = user.settings || {};
      setTheme((settings as Record<string, string>)?.theme as "light" | "dark" | "system" || "dark");
      setFontSize(Number((settings as Record<string, number>)?.editorFontSize) || 14);
      setDefaultFramework((settings as Record<string, string>)?.defaultFramework || "react-vite");
      setAutoSave((settings as Record<string, boolean>)?.autoSave !== false);
    }
  }, [user, authLoading, isAuthenticated, router]);

  // Fetch usage data for billing tab
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const data = await api.getUsageSummary();
        setUsageSummary({ totalSpent: data.totalSpent ?? 0, monthlyBudget: data.monthlyBudget ?? 10, plan: data.plan ?? "FREE" });
        setMonthlyBudget(data.monthlyBudget ?? 10);
      } catch { /* ignore */ }
    })();
  }, [isAuthenticated]);

  const handleSaveBudget = async () => {
    setBudgetSaving(true);
    try {
      await api.updateBudget(monthlyBudget);
      setBudgetSaved(true);
      setTimeout(() => setBudgetSaved(false), 2000);
      if (usageSummary) setUsageSummary({ ...usageSummary, monthlyBudget });
    } catch (err) { console.error("Save budget failed:", err); }
    finally { setBudgetSaving(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateUserSettings({ theme, editorFontSize: fontSize, defaultFramework, autoSave, anthropicApiKey: anthropicKey || undefined, openaiApiKey: openaiKey || undefined });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error("Save settings failed:", err); }
    finally { setSaving(false); }
  };

  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#EDEDED]">Ajustes</h1>
          <p className="text-sm text-[#8888a0] mt-1">Configura tu cuenta y preferencias</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar tabs */}
          <nav className="w-48 shrink-0 space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-[#7c3aed]/10 text-[#EDEDED]"
                    : tab.id === "danger"
                      ? "text-[#ef4444]/70 hover:bg-[#ef4444]/5 hover:text-[#ef4444]"
                      : "text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED]"
                )}
              >
                {activeTab === tab.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#7c3aed]" />
                )}
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === "profile" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">Perfil</h2>
                  <p className="text-sm text-[#8888a0]">Tu información personal</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-[#7c3aed]/20 flex items-center justify-center text-2xl font-bold text-[#7c3aed]">
                    {(name || user?.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#EDEDED]">{user?.email}</p>
                    <p className="text-xs text-[#8888a0]">Miembro desde {user?.createdAt ? new Date(user.createdAt).toLocaleDateString("es-ES") : "N/A"}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#EDEDED] mb-1.5">Nombre</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full max-w-md rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed]"
                    placeholder="Tu nombre" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#EDEDED] mb-1.5">Email</label>
                  <input type="email" value={user?.email || ""} disabled
                    className="w-full max-w-md rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#8888a0] outline-none opacity-60" />
                </div>
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">Preferencias</h2>
                  <p className="text-sm text-[#8888a0]">Personaliza tu experiencia</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#EDEDED] mb-2">Tema</label>
                  <div className="flex gap-2">
                    {(["dark", "light", "system"] as const).map((t) => (
                      <button key={t} onClick={() => setTheme(t)}
                        className={cn("rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors",
                          theme === t ? "border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]" : "border-[#2A2A2A] text-[#8888a0] hover:border-[#7c3aed]/50"
                        )}>{t === "dark" ? "Oscuro" : t === "light" ? "Claro" : "Sistema"}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#EDEDED] mb-2">Tamaño de fuente del editor: {fontSize}px</label>
                  <input type="range" min={12} max={20} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full max-w-xs accent-[#7c3aed]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#EDEDED] mb-2">Framework predeterminado</label>
                  <select value={defaultFramework} onChange={(e) => setDefaultFramework(e.target.value)}
                    className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#EDEDED] outline-none focus:border-[#7c3aed]">
                    <option value="react-vite">React + Vite</option>
                    <option value="nextjs">Next.js</option>
                    <option value="vue">Vue</option>
                  </select>
                </div>
                <div className="flex items-center justify-between max-w-md">
                  <div>
                    <label className="text-sm font-medium text-[#EDEDED]">Auto-guardado</label>
                    <p className="text-xs text-[#8888a0]">Guardar archivos automáticamente</p>
                  </div>
                  <button onClick={() => setAutoSave(!autoSave)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", autoSave ? "bg-[#7c3aed]" : "bg-[#2A2A2A]")}>
                    <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform", autoSave ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === "api-keys" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">API Keys</h2>
                  <p className="text-sm text-[#8888a0]">Conecta tus propias API keys para uso extendido</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#EDEDED] mb-1.5">Anthropic API Key</label>
                  <div className="relative max-w-md">
                    <input type={showAnthropicKey ? "text" : "password"} value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)}
                      className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 pr-10 text-sm text-[#EDEDED] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed]"
                      placeholder="sk-ant-..." />
                    <button onClick={() => setShowAnthropicKey(!showAnthropicKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888a0] hover:text-[#EDEDED]">
                      {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#EDEDED] mb-1.5">OpenAI API Key</label>
                  <div className="relative max-w-md">
                    <input type={showOpenaiKey ? "text" : "password"} value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)}
                      className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 pr-10 text-sm text-[#EDEDED] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed]"
                      placeholder="sk-..." />
                    <button onClick={() => setShowOpenaiKey(!showOpenaiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8888a0] hover:text-[#EDEDED]">
                      {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">Facturación</h2>
                  <p className="text-sm text-[#8888a0]">Gestiona tu plan, presupuesto y uso</p>
                </div>

                {/* Current plan */}
                <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-[#8888a0]">Plan actual</p>
                      <p className="text-xl font-bold text-[#EDEDED]">{usageSummary?.plan || user?.plan || "FREE"}</p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium",
                      (usageSummary?.plan || user?.plan) === "PRO" ? "bg-[#7c3aed]/10 text-[#7c3aed]" :
                      (usageSummary?.plan || user?.plan) === "BUSINESS" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                      (usageSummary?.plan || user?.plan) === "ENTERPRISE" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                      "bg-[#2A2A2A] text-[#8888a0]"
                    )}>{usageSummary?.plan || user?.plan || "FREE"}</span>
                  </div>

                  {/* Plan selection */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {(["FREE", "PRO", "BUSINESS", "ENTERPRISE"] as const).map((plan) => {
                      const prices: Record<string, string> = { FREE: "$0", PRO: "$20", BUSINESS: "$50", ENTERPRISE: "$200" };
                      const limits: Record<string, string> = { FREE: "$10/mes", PRO: "$50/mes", BUSINESS: "$200/mes", ENTERPRISE: "Ilimitado" };
                      const isCurrent = (usageSummary?.plan || user?.plan || "FREE") === plan;
                      return (
                        <button key={plan}
                          onClick={() => !isCurrent && router.push("/dashboard/usage")}
                          className={cn("rounded-lg border p-3 text-center transition-colors",
                            isCurrent ? "border-[#7c3aed] bg-[#7c3aed]/10" : "border-[#2A2A2A] hover:border-[#7c3aed]/50"
                          )}>
                          <p className="text-xs font-bold text-[#EDEDED]">{plan}</p>
                          <p className="text-[10px] text-[#8888a0] mt-0.5">{prices[plan]}/mes</p>
                          <p className="text-[10px] text-[#7c3aed] mt-0.5">{limits[plan]}</p>
                        </button>
                      );
                    })}
                  </div>

                  <button onClick={() => router.push("/dashboard/usage")}
                    className="w-full rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors shadow-lg shadow-[#7c3aed]/20">
                    Ver planes y mejorar
                  </button>
                </div>

                {/* Spending cap */}
                <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-1">Spending cap mensual</h3>
                  <p className="text-xs text-[#8888a0] mb-4">
                    Establece un límite de gasto mensual. Arya dejará de procesar cuando se alcance.
                  </p>

                  {/* Current usage bar */}
                  {usageSummary && (
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#8888a0]">Gasto este mes</span>
                        <span className="text-[#EDEDED]">
                          ${usageSummary.totalSpent.toFixed(2)} / ${usageSummary.monthlyBudget.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#2A2A2A] overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all",
                            usageSummary.totalSpent / usageSummary.monthlyBudget > 0.9
                              ? "bg-[#ef4444]"
                              : usageSummary.totalSpent / usageSummary.monthlyBudget > 0.7
                                ? "bg-[#f59e0b]"
                                : "bg-[#7c3aed]"
                          )}
                          style={{ width: `${Math.min(100, (usageSummary.totalSpent / usageSummary.monthlyBudget) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Budget input */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1 max-w-xs">
                      <label className="block text-xs text-[#8888a0] mb-1.5">Límite mensual (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8888a0]">$</span>
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          step={5}
                          value={monthlyBudget}
                          onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] pl-7 pr-4 py-2.5 text-sm text-[#EDEDED] outline-none focus:border-[#7c3aed]"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSaveBudget}
                      disabled={budgetSaving}
                      className="flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
                    >
                      {budgetSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : budgetSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                      {budgetSaved ? "Guardado" : "Guardar"}
                    </button>
                  </div>

                  {/* Quick presets */}
                  <div className="flex gap-2 mt-3">
                    {[5, 10, 25, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setMonthlyBudget(preset)}
                        className={cn("rounded-md border px-3 py-1 text-xs transition-colors",
                          monthlyBudget === preset
                            ? "border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]"
                            : "border-[#2A2A2A] text-[#8888a0] hover:border-[#7c3aed]/50"
                        )}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Credits usage (legacy display) */}
                <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-1">Créditos</h3>
                  <p className="text-xs text-[#8888a0] mb-4">Créditos incluidos con tu plan</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8888a0]">Usados</span>
                      <span className="text-[#EDEDED]">{user?.creditsUsed ?? 0} / {user?.creditsLimit ?? 50}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#2A2A2A] overflow-hidden">
                      <div className="h-full rounded-full bg-[#7c3aed] transition-all" style={{ width: `${Math.min(100, ((user?.creditsUsed ?? 0) / (user?.creditsLimit ?? 50)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "danger" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-[#ef4444] mb-1">Zona peligrosa</h2>
                  <p className="text-sm text-[#8888a0]">Acciones irreversibles y destructivas</p>
                </div>
                <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-6">
                  <h3 className="text-sm font-medium text-[#EDEDED] mb-1">Eliminar cuenta</h3>
                  <p className="text-xs text-[#8888a0] mb-4">Elimina permanentemente tu cuenta y todos los datos asociados. Esta acción no se puede deshacer.</p>
                  <button className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-2 text-sm font-medium text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors">Eliminar cuenta</button>
                </div>
              </div>
            )}

            {/* Save button */}
            <div className="mt-8 pt-4 border-t border-[#2A2A2A]">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50 shadow-lg shadow-[#7c3aed]/20">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? "¡Guardado!" : "Guardar ajustes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
