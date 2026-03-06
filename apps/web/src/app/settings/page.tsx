"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Palette,
  Key,
  CreditCard,
  AlertTriangle,
  Loader2,
  Check,
  Save,
  Plus,
  Trash2,
  Copy,
  Globe,
  Shield,
  ToggleLeft,
  ToggleRight,
  Brain,
  Pencil,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "memory" | "preferences" | "api-keys" | "webhooks" | "billing" | "danger";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: "profile", label: "Perfil", icon: <User className="h-4 w-4" /> },
  { id: "memory", label: "Memoria", icon: <Brain className="h-4 w-4" /> },
  { id: "preferences", label: "Preferencias", icon: <Palette className="h-4 w-4" /> },
  { id: "api-keys", label: "API Keys", icon: <Key className="h-4 w-4" /> },
  { id: "webhooks", label: "Webhooks", icon: <Globe className="h-4 w-4" /> },
  { id: "billing", label: "Facturación", icon: <CreditCard className="h-4 w-4" /> },
  { id: "danger", label: "Zona peligrosa", icon: <AlertTriangle className="h-4 w-4" /> },
];

const ALL_SCOPES = [
  { value: "projects.read", label: "Projects: Read" },
  { value: "projects.write", label: "Projects: Write" },
  { value: "engine.start", label: "Engine: Start" },
  { value: "engine.read", label: "Engine: Read" },
  { value: "skills.read", label: "Skills: Read" },
  { value: "usage.read", label: "Usage: Read" },
];

const ALL_WEBHOOK_EVENTS = [
  { value: "engine.completed", label: "Engine completed" },
  { value: "engine.failed", label: "Engine failed" },
  { value: "engine.started", label: "Engine started" },
  { value: "project.created", label: "Project created" },
  { value: "project.deleted", label: "Project deleted" },
];

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

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
  const [monthlyBudget, setMonthlyBudget] = useState(10);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [usageSummary, setUsageSummary] = useState<{ totalSpent: number; monthlyBudget: number; plan: string } | null>(null);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(ALL_SCOPES.map((s) => s.value));
  const [newKeyExpiry, setNewKeyExpiry] = useState<number | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(ALL_WEBHOOK_EVENTS.map((e) => e.value));
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Memory state
  const [memories, setMemories] = useState<any[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryValue, setEditingMemoryValue] = useState("");
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [newMemoryCategory, setNewMemoryCategory] = useState("preferences");
  const [newMemoryKey, setNewMemoryKey] = useState("");
  const [newMemoryValue, setNewMemoryValue] = useState("");
  const [memoryAdding, setMemoryAdding] = useState(false);

  // Danger zone state
  const [deleteConfirm, setDeleteConfirm] = useState("");

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

  // Fetch memories when memory tab is active
  const fetchMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const data = await api.getMemories();
      setMemories(data.memories || []);
    } catch { /* ignore */ }
    setMemoriesLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === "memory" && isAuthenticated) fetchMemories();
  }, [activeTab, isAuthenticated, fetchMemories]);

  // Fetch API keys when tab is active
  const fetchApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    try {
      const keys = await api.listApiKeys();
      setApiKeys(keys);
    } catch { /* ignore */ }
    finally { setApiKeysLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "api-keys" && isAuthenticated) fetchApiKeys();
  }, [activeTab, isAuthenticated, fetchApiKeys]);

  // Fetch webhooks when tab is active
  const fetchWebhooks = useCallback(async () => {
    setWebhooksLoading(true);
    try {
      const hooks = await api.listWebhooks();
      setWebhooks(hooks);
    } catch { /* ignore */ }
    finally { setWebhooksLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === "webhooks" && isAuthenticated) fetchWebhooks();
  }, [activeTab, isAuthenticated, fetchWebhooks]);

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
      await api.updateUserSettings({ name, theme, editorFontSize: fontSize, defaultFramework, autoSave });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) { console.error("Save settings failed:", err); }
    finally { setSaving(false); }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const result = await api.createApiKey(newKeyName, newKeyScopes, newKeyExpiry ?? undefined);
      setNewlyCreatedKey(result.key);
      setNewKeyName("");
      setNewKeyScopes(ALL_SCOPES.map((s) => s.value));
      setNewKeyExpiry(null);
      await fetchApiKeys();
    } catch (err) { console.error("Create API key failed:", err); }
    finally { setCreatingKey(false); }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      await api.deleteApiKey(keyId);
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) { console.error("Delete API key failed:", err); }
  };

  const handleToggleApiKey = async (keyId: string, isActive: boolean) => {
    try {
      await api.updateApiKey(keyId, { isActive: !isActive });
      setApiKeys((prev) => prev.map((k) => k.id === keyId ? { ...k, isActive: !isActive } : k));
    } catch (err) { console.error("Toggle API key failed:", err); }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim()) return;
    setCreatingWebhook(true);
    try {
      const result = await api.createWebhook(newWebhookUrl, newWebhookEvents);
      setNewlyCreatedSecret(result.secret);
      setNewWebhookUrl("");
      setNewWebhookEvents(ALL_WEBHOOK_EVENTS.map((e) => e.value));
      await fetchWebhooks();
    } catch (err) { console.error("Create webhook failed:", err); }
    finally { setCreatingWebhook(false); }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      await api.deleteWebhook(webhookId);
      setWebhooks((prev) => prev.filter((w) => w.id !== webhookId));
    } catch (err) { console.error("Delete webhook failed:", err); }
  };

  const handleToggleWebhook = async (webhookId: string, isActive: boolean) => {
    try {
      await api.updateWebhook(webhookId, { isActive: !isActive });
      setWebhooks((prev) => prev.map((w) => w.id === webhookId ? { ...w, isActive: !isActive } : w));
    } catch (err) { console.error("Toggle webhook failed:", err); }
  };

  const copyToClipboard = (text: string, type: "key" | "secret") => {
    navigator.clipboard.writeText(text);
    if (type === "key") { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000); }
    else { setCopiedSecret(true); setTimeout(() => setCopiedSecret(false), 2000); }
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
                    <p className="text-xs text-[#8888a0]">Guardar archivos automaticamente</p>
                  </div>
                  <button onClick={() => setAutoSave(!autoSave)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", autoSave ? "bg-[#7c3aed]" : "bg-[#2A2A2A]")}>
                    <span className={cn("inline-block h-4 w-4 rounded-full bg-white transition-transform", autoSave ? "translate-x-6" : "translate-x-1")} />
                  </button>
                </div>

              </div>
            )}

            {/* ─── Memory Tab ──────────────────────────────────────── */}
            {activeTab === "memory" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">Memoria de Arya</h2>
                  <p className="text-sm text-[#8888a0]">
                    Arya recuerda tus preferencias y stack para personalizar cada proyecto.
                  </p>
                </div>

                {memoriesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#7c3aed]" />
                  </div>
                ) : memories.length === 0 ? (
                  <div className="rounded-xl border border-[#1E1E1E] bg-[#111111] p-8 text-center">
                    <Brain className="h-10 w-10 text-[#555555] mx-auto mb-3" />
                    <p className="text-sm text-[#8888a0] mb-1">Arya aún no tiene memorias</p>
                    <p className="text-xs text-[#555555]">
                      Las memorias se crean automáticamente de tus proyectos, o puedes agregarlas manualmente.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(
                      memories.reduce((acc: Record<string, any[]>, m: any) => {
                        if (!acc[m.category]) acc[m.category] = [];
                        acc[m.category].push(m);
                        return acc;
                      }, {} as Record<string, any[]>)
                    ).map(([category, items]) => {
                      const categoryLabels: Record<string, { label: string; color: string }> = {
                        stack: { label: "Stack tecnológico", color: "#3b82f6" },
                        preferences: { label: "Preferencias", color: "#7c3aed" },
                        patterns: { label: "Patrones de código", color: "#10b981" },
                        context: { label: "Contexto", color: "#f59e0b" },
                        feedback: { label: "Feedback", color: "#ef4444" },
                      };
                      const cat = categoryLabels[category] || { label: category, color: "#8888a0" };

                      return (
                        <div key={category} className="rounded-xl border border-[#1E1E1E] bg-[#111111] overflow-hidden">
                          <div className="px-4 py-3 border-b border-[#1E1E1E] flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                            <span className="text-sm font-medium text-[#EDEDED]">{cat.label}</span>
                            <span className="text-xs text-[#555555] ml-auto">{items.length} memorias</span>
                          </div>
                          <div className="divide-y divide-[#1E1E1E]">
                            {items.map((mem: any) => (
                              <div key={mem.id} className="px-4 py-3 flex items-center gap-3 group">
                                {editingMemoryId === mem.id ? (
                                  <>
                                    <span className="text-xs text-[#8888a0] min-w-[120px] shrink-0">{mem.key}</span>
                                    <input
                                      value={editingMemoryValue}
                                      onChange={(e) => setEditingMemoryValue(e.target.value)}
                                      className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-1.5 text-sm text-[#EDEDED] outline-none focus:border-[#7c3aed]"
                                      autoFocus
                                      onKeyDown={async (e) => {
                                        if (e.key === "Enter") {
                                          await api.saveMemory({ category: mem.category, key: mem.key, value: editingMemoryValue, source: "manual" });
                                          setEditingMemoryId(null);
                                          fetchMemories();
                                        }
                                        if (e.key === "Escape") setEditingMemoryId(null);
                                      }}
                                    />
                                    <button
                                      onClick={async () => {
                                        await api.saveMemory({ category: mem.category, key: mem.key, value: editingMemoryValue, source: "manual" });
                                        setEditingMemoryId(null);
                                        fetchMemories();
                                      }}
                                      className="text-[#10b981] hover:text-[#059669] transition-colors"
                                    >
                                      <Check className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => setEditingMemoryId(null)} className="text-[#8888a0] hover:text-[#EDEDED] transition-colors">
                                      <X className="h-4 w-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-xs text-[#8888a0] min-w-[120px] shrink-0">{mem.key}</span>
                                    <span className="flex-1 text-sm text-[#EDEDED]">{mem.value}</span>
                                    {mem.source === "auto" && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7c3aed]/10 text-[#7c3aed] shrink-0">auto</span>
                                    )}
                                    <button
                                      onClick={() => { setEditingMemoryId(mem.id); setEditingMemoryValue(mem.value); }}
                                      className="text-[#555555] hover:text-[#EDEDED] transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        await api.deleteMemory(mem.id);
                                        fetchMemories();
                                      }}
                                      className="text-[#555555] hover:text-[#ef4444] transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add memory form */}
                {showAddMemory ? (
                  <div className="rounded-xl border border-[#7c3aed]/30 bg-[#111111] p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <select
                        value={newMemoryCategory}
                        onChange={(e) => setNewMemoryCategory(e.target.value)}
                        className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-[#EDEDED] outline-none focus:border-[#7c3aed]"
                      >
                        <option value="preferences">Preferencias</option>
                        <option value="stack">Stack</option>
                        <option value="patterns">Patrones</option>
                        <option value="context">Contexto</option>
                        <option value="feedback">Feedback</option>
                      </select>
                      <input
                        value={newMemoryKey}
                        onChange={(e) => setNewMemoryKey(e.target.value)}
                        placeholder="Clave (ej: coding_style)"
                        className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-[#EDEDED] placeholder:text-[#555555] outline-none focus:border-[#7c3aed]"
                      />
                    </div>
                    <input
                      value={newMemoryValue}
                      onChange={(e) => setNewMemoryValue(e.target.value)}
                      placeholder="Valor (ej: Clean code, well-documented)"
                      className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-[#EDEDED] placeholder:text-[#555555] outline-none focus:border-[#7c3aed]"
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && newMemoryKey.trim() && newMemoryValue.trim()) {
                          setMemoryAdding(true);
                          await api.saveMemory({ category: newMemoryCategory, key: newMemoryKey.trim(), value: newMemoryValue.trim(), source: "manual" });
                          setNewMemoryKey("");
                          setNewMemoryValue("");
                          setShowAddMemory(false);
                          setMemoryAdding(false);
                          fetchMemories();
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={!newMemoryKey.trim() || !newMemoryValue.trim() || memoryAdding}
                        onClick={async () => {
                          setMemoryAdding(true);
                          await api.saveMemory({ category: newMemoryCategory, key: newMemoryKey.trim(), value: newMemoryValue.trim(), source: "manual" });
                          setNewMemoryKey("");
                          setNewMemoryValue("");
                          setShowAddMemory(false);
                          setMemoryAdding(false);
                          fetchMemories();
                        }}
                        className="rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
                      >
                        {memoryAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
                      </button>
                      <button onClick={() => setShowAddMemory(false)} className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowAddMemory(true)}
                      className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] px-4 py-2.5 text-sm text-[#8888a0] hover:border-[#7c3aed]/50 hover:text-[#EDEDED] transition-colors"
                    >
                      <Plus className="h-4 w-4" /> Agregar memoria
                    </button>
                    {memories.length > 0 && (
                      <button
                        onClick={async () => {
                          if (confirm("¿Borrar todas las memorias de Arya? Esta acción no se puede deshacer.")) {
                            await api.clearMemories();
                            fetchMemories();
                          }
                        }}
                        className="flex items-center gap-2 rounded-lg border border-[#ef4444]/20 px-4 py-2.5 text-sm text-[#ef4444]/70 hover:bg-[#ef4444]/5 hover:text-[#ef4444] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" /> Borrar todas
                      </button>
                    )}
                  </div>
                )}

                <p className="text-xs text-[#555555]">
                  Las memorias se crean automáticamente de tus proyectos. También puedes agregarlas manualmente.
                </p>
              </div>
            )}

            {/* ─── API Keys Tab ─────────────────────────────────────── */}
            {activeTab === "api-keys" && (
              <div className="space-y-8 animate-fade-in">
                {/* ── Arya API Keys Section ─────────────────────────── */}
                <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">Arya API Keys</h2>
                    <p className="text-sm text-[#8888a0]">Gestiona tus API keys para acceder a la API publica v1</p>
                  </div>
                  <button
                    onClick={() => { setShowCreateKey(true); setNewlyCreatedKey(null); }}
                    className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Crear key
                  </button>
                </div>

                {/* Newly created key alert */}
                {newlyCreatedKey && (
                  <div className="rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-[#22c55e]" />
                      <p className="text-sm font-medium text-[#22c55e]">API Key creada exitosamente</p>
                    </div>
                    <p className="text-xs text-[#8888a0] mb-3">Copia esta key ahora. No se mostrara de nuevo.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-[#0A0A0A] px-3 py-2 text-xs text-[#EDEDED] font-mono break-all border border-[#2A2A2A]">
                        {newlyCreatedKey}
                      </code>
                      <button
                        onClick={() => copyToClipboard(newlyCreatedKey, "key")}
                        className="shrink-0 rounded-lg border border-[#2A2A2A] p-2 text-[#8888a0] hover:text-[#EDEDED] hover:border-[#7c3aed]/50 transition-colors"
                      >
                        {copiedKey ? <Check className="h-4 w-4 text-[#22c55e]" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Create key form */}
                {showCreateKey && !newlyCreatedKey && (
                  <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-[#EDEDED]">Nueva API Key</h3>
                    <div>
                      <label className="block text-xs text-[#8888a0] mb-1.5">Nombre</label>
                      <input
                        type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                        className="w-full max-w-md rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#EDEDED] outline-none focus:border-[#7c3aed]"
                        placeholder="e.g. Production API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8888a0] mb-2">Scopes</label>
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_SCOPES.map((scope) => (
                          <label key={scope.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newKeyScopes.includes(scope.value)}
                              onChange={(e) => {
                                if (e.target.checked) setNewKeyScopes((prev) => [...prev, scope.value]);
                                else setNewKeyScopes((prev) => prev.filter((s) => s !== scope.value));
                              }}
                              className="rounded border-[#2A2A2A] bg-[#0A0A0A] accent-[#7c3aed]"
                            />
                            <span className="text-xs text-[#EDEDED]">{scope.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[#8888a0] mb-1.5">Expiracion (opcional)</label>
                      <select
                        value={newKeyExpiry ?? ""}
                        onChange={(e) => setNewKeyExpiry(e.target.value ? Number(e.target.value) : null)}
                        className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#EDEDED] outline-none focus:border-[#7c3aed]"
                      >
                        <option value="">Nunca expira</option>
                        <option value="30">30 dias</option>
                        <option value="60">60 dias</option>
                        <option value="90">90 dias</option>
                        <option value="365">1 año</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleCreateApiKey}
                        disabled={creatingKey || !newKeyName.trim()}
                        className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
                      >
                        {creatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Key className="h-3.5 w-3.5" />}
                        Crear
                      </button>
                      <button onClick={() => setShowCreateKey(false)}
                        className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Key list */}
                {apiKeysLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#7c3aed]" />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-8 text-center">
                    <Key className="h-8 w-8 text-[#8888a0]/40 mx-auto mb-3" />
                    <p className="text-sm text-[#8888a0]">No tienes API keys. Crea una para empezar a usar la API.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className={cn("h-2 w-2 rounded-full", key.isActive ? "bg-[#22c55e]" : "bg-[#8888a0]")} />
                            <span className="text-sm font-medium text-[#EDEDED]">{key.name}</span>
                            <code className="text-xs text-[#8888a0] font-mono">{key.prefix}...</code>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleToggleApiKey(key.id, key.isActive)}
                              className="text-[#8888a0] hover:text-[#EDEDED] transition-colors" title={key.isActive ? "Desactivar" : "Activar"}>
                              {key.isActive ? <ToggleRight className="h-5 w-5 text-[#22c55e]" /> : <ToggleLeft className="h-5 w-5" />}
                            </button>
                            <button onClick={() => handleDeleteApiKey(key.id)}
                              className="text-[#8888a0] hover:text-[#ef4444] transition-colors" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-[#8888a0]">
                          <span>{key.scopes.length} scopes</span>
                          {key.lastUsedAt && <span>Ultimo uso: {new Date(key.lastUsedAt).toLocaleDateString("es-ES")}</span>}
                          {key.expiresAt && <span>Expira: {new Date(key.expiresAt).toLocaleDateString("es-ES")}</span>}
                          <span>Creada: {new Date(key.createdAt).toLocaleDateString("es-ES")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* API Documentation link */}
                <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[#EDEDED]">Documentacion de la API</p>
                      <p className="text-xs text-[#8888a0] mt-0.5">Aprende como usar la API publica con curl, JavaScript y mas</p>
                    </div>
                    <button onClick={() => router.push("/docs")}
                      className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm text-[#EDEDED] hover:border-[#7c3aed]/50 transition-colors">
                      Ver docs
                    </button>
                  </div>
                </div>
                </div>
              </div>
            )}

            {/* ─── Webhooks Tab ─────────────────────────────────────── */}
            {activeTab === "webhooks" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">Webhooks</h2>
                    <p className="text-sm text-[#8888a0]">Recibe notificaciones HTTP cuando ocurran eventos</p>
                  </div>
                  <button
                    onClick={() => { setShowCreateWebhook(true); setNewlyCreatedSecret(null); }}
                    className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors"
                  >
                    <Plus className="h-4 w-4" /> Crear webhook
                  </button>
                </div>

                {/* Newly created secret alert */}
                {newlyCreatedSecret && (
                  <div className="rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-[#22c55e]" />
                      <p className="text-sm font-medium text-[#22c55e]">Webhook creado exitosamente</p>
                    </div>
                    <p className="text-xs text-[#8888a0] mb-3">Copia el signing secret ahora. No se mostrara de nuevo.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-[#0A0A0A] px-3 py-2 text-xs text-[#EDEDED] font-mono break-all border border-[#2A2A2A]">
                        {newlyCreatedSecret}
                      </code>
                      <button
                        onClick={() => copyToClipboard(newlyCreatedSecret, "secret")}
                        className="shrink-0 rounded-lg border border-[#2A2A2A] p-2 text-[#8888a0] hover:text-[#EDEDED] hover:border-[#7c3aed]/50 transition-colors"
                      >
                        {copiedSecret ? <Check className="h-4 w-4 text-[#22c55e]" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Create webhook form */}
                {showCreateWebhook && !newlyCreatedSecret && (
                  <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-[#EDEDED]">Nuevo Webhook</h3>
                    <div>
                      <label className="block text-xs text-[#8888a0] mb-1.5">URL</label>
                      <input
                        type="url" value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)}
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#EDEDED] outline-none focus:border-[#7c3aed]"
                        placeholder="https://your-server.com/webhook"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#8888a0] mb-2">Eventos</label>
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_WEBHOOK_EVENTS.map((event) => (
                          <label key={event.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newWebhookEvents.includes(event.value)}
                              onChange={(e) => {
                                if (e.target.checked) setNewWebhookEvents((prev) => [...prev, event.value]);
                                else setNewWebhookEvents((prev) => prev.filter((ev) => ev !== event.value));
                              }}
                              className="rounded border-[#2A2A2A] bg-[#0A0A0A] accent-[#7c3aed]"
                            />
                            <span className="text-xs text-[#EDEDED]">{event.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleCreateWebhook}
                        disabled={creatingWebhook || !newWebhookUrl.trim()}
                        className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
                      >
                        {creatingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                        Crear
                      </button>
                      <button onClick={() => setShowCreateWebhook(false)}
                        className="rounded-lg border border-[#2A2A2A] px-4 py-2 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Webhook list */}
                {webhooksLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-[#7c3aed]" />
                  </div>
                ) : webhooks.length === 0 ? (
                  <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-8 text-center">
                    <Globe className="h-8 w-8 text-[#8888a0]/40 mx-auto mb-3" />
                    <p className="text-sm text-[#8888a0]">No tienes webhooks configurados.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {webhooks.map((wh) => (
                      <div key={wh.id} className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={cn("h-2 w-2 shrink-0 rounded-full", wh.isActive ? "bg-[#22c55e]" : "bg-[#8888a0]")} />
                            <span className="text-sm font-medium text-[#EDEDED] truncate">{wh.url}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => handleToggleWebhook(wh.id, wh.isActive)}
                              className="text-[#8888a0] hover:text-[#EDEDED] transition-colors">
                              {wh.isActive ? <ToggleRight className="h-5 w-5 text-[#22c55e]" /> : <ToggleLeft className="h-5 w-5" />}
                            </button>
                            <button onClick={() => handleDeleteWebhook(wh.id)}
                              className="text-[#8888a0] hover:text-[#ef4444] transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {wh.events.map((ev) => (
                            <span key={ev} className="rounded-md bg-[#1A1A1A] px-2 py-0.5 text-[10px] text-[#8888a0]">{ev}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Verification info */}
                <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-4">
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-2">Verificacion de firma</h3>
                  <p className="text-xs text-[#8888a0] mb-3">Cada delivery incluye un header <code className="text-[#7c3aed]">X-Arya-Signature</code> con firma HMAC-SHA256.</p>
                  <pre className="rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] p-3 text-xs text-[#EDEDED] overflow-x-auto font-mono">
{`const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}`}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === "billing" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">Facturacion</h2>
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
                  <button onClick={() => router.push("/dashboard/usage")}
                    className="w-full rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors shadow-lg shadow-[#7c3aed]/20">
                    Ver planes y mejorar
                  </button>
                </div>

                {/* Spending cap */}
                <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-1">Spending cap mensual</h3>
                  <p className="text-xs text-[#8888a0] mb-4">Arya dejara de procesar cuando se alcance.</p>

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
                            usageSummary.totalSpent / usageSummary.monthlyBudget > 0.9 ? "bg-[#ef4444]" :
                            usageSummary.totalSpent / usageSummary.monthlyBudget > 0.7 ? "bg-[#f59e0b]" : "bg-[#7c3aed]"
                          )}
                          style={{ width: `${Math.min(100, (usageSummary.totalSpent / usageSummary.monthlyBudget) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-end gap-3">
                    <div className="flex-1 max-w-xs">
                      <label className="block text-xs text-[#8888a0] mb-1.5">Limite mensual (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8888a0]">$</span>
                        <input type="number" min={0} max={100000} step={5} value={monthlyBudget} onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                          className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] pl-7 pr-4 py-2.5 text-sm text-[#EDEDED] outline-none focus:border-[#7c3aed]" />
                      </div>
                    </div>
                    <button onClick={handleSaveBudget} disabled={budgetSaving}
                      className="flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50">
                      {budgetSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : budgetSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                      {budgetSaved ? "Guardado" : "Guardar"}
                    </button>
                  </div>

                  <div className="flex gap-2 mt-3">
                    {[5, 10, 25, 50, 100].map((preset) => (
                      <button key={preset} onClick={() => setMonthlyBudget(preset)}
                        className={cn("rounded-md border px-3 py-1 text-xs transition-colors",
                          monthlyBudget === preset ? "border-[#7c3aed] bg-[#7c3aed]/10 text-[#7c3aed]" : "border-[#2A2A2A] text-[#8888a0] hover:border-[#7c3aed]/50"
                        )}>
                        ${preset}
                      </button>
                    ))}
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
                  <p className="text-xs text-[#8888a0] mb-4">Elimina permanentemente tu cuenta y todos los datos asociados. Esta accion no se puede deshacer.</p>
                  <div className="space-y-3 max-w-md">
                    <div>
                      <label className="block text-xs text-[#8888a0] mb-1.5">Escribe <code className="text-[#ef4444]">ELIMINAR</code> para confirmar</label>
                      <input
                        type="text"
                        value={deleteConfirm}
                        onChange={(e) => setDeleteConfirm(e.target.value)}
                        className="w-full rounded-lg border border-[#ef4444]/20 bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#8888a0]/50 outline-none focus:border-[#ef4444]"
                        placeholder="ELIMINAR"
                      />
                    </div>
                    <button
                      disabled={deleteConfirm !== "ELIMINAR"}
                      onClick={() => { alert("Contacta soporte para eliminar tu cuenta: soporte@arya.ai"); setDeleteConfirm(""); }}
                      className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-2 text-sm font-medium text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Eliminar cuenta
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Save button */}
            {(activeTab === "profile" || activeTab === "preferences") && (
              <div className="mt-8 pt-4 border-t border-[#2A2A2A]">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50 shadow-lg shadow-[#7c3aed]/20">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saved ? "Guardado!" : "Guardar ajustes"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
