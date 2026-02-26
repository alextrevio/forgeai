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
import { DashboardShell } from "@/components/dashboard-shell";
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
      <DashboardShell>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
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
                  <p className="text-sm text-[#8888a0]">Gestiona tu plan y uso</p>
                </div>
                <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-[#8888a0]">Plan actual</p>
                      <p className="text-xl font-bold text-[#EDEDED]">{user?.plan || "FREE"}</p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-medium",
                      user?.plan === "PRO" ? "bg-[#7c3aed]/10 text-[#7c3aed]" : user?.plan === "BUSINESS" ? "bg-[#f59e0b]/10 text-[#f59e0b]" : "bg-[#2A2A2A] text-[#8888a0]"
                    )}>{user?.plan || "FREE"}</span>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#8888a0]">Créditos usados</span>
                      <span className="text-[#EDEDED]">{user?.creditsUsed ?? 0} / {user?.creditsLimit ?? 50}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#2A2A2A] overflow-hidden">
                      <div className="h-full rounded-full bg-[#7c3aed] transition-all" style={{ width: `${Math.min(100, ((user?.creditsUsed ?? 0) / (user?.creditsLimit ?? 50)) * 100)}%` }} />
                    </div>
                  </div>
                  <button onClick={() => router.push("/dashboard/usage")}
                    className="w-full rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors shadow-lg shadow-[#7c3aed]/20">
                    Mejorar plan
                  </button>
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
    </DashboardShell>
  );
}
