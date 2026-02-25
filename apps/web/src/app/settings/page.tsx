"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Palette,
  Key,
  CreditCard,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Check,
  Eye,
  EyeOff,
  Zap,
  Sparkles,
  Save,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "preferences" | "api-keys" | "billing" | "danger";

const TABS: Array<{ id: SettingsTab; label: string; icon: React.ReactNode }> = [
  { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
  { id: "preferences", label: "Preferences", icon: <Palette className="h-4 w-4" /> },
  { id: "api-keys", label: "API Keys", icon: <Key className="h-4 w-4" /> },
  { id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
  { id: "danger", label: "Danger Zone", icon: <AlertTriangle className="h-4 w-4" /> },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loadUser, isLoading: authLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings state
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const [fontSize, setFontSize] = useState(14);
  const [defaultFramework, setDefaultFramework] = useState("react-vite");
  const [autoSave, setAutoSave] = useState(true);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (user) {
      setName(user.name || "");
      // Load user settings
      const settings = user.settings || {};
      setTheme((settings as any)?.theme || "dark");
      setFontSize((settings as any)?.editorFontSize || 14);
      setDefaultFramework((settings as any)?.defaultFramework || "react-vite");
      setAutoSave((settings as any)?.autoSave !== false);
    }
  }, [user, authLoading, isAuthenticated, router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateUserSettings({
        theme,
        editorFontSize: fontSize,
        defaultFramework,
        autoSave,
        anthropicApiKey: anthropicKey || undefined,
        openaiApiKey: openaiKey || undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save settings failed:", err);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6d5cff]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <header className="border-b border-[#2A2A2A] bg-[#111111]">
        <div className="mx-auto max-w-4xl flex items-center gap-4 px-6 py-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#6d5cff]" />
            <span className="text-lg font-bold text-white">Settings</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl flex gap-8 px-6 py-8">
        {/* Sidebar tabs */}
        <nav className="w-48 shrink-0 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-[#6d5cff]/10 text-[#6d5cff]"
                  : tab.id === "danger"
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-gray-400 hover:bg-[#1A1A1A] hover:text-white"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Profile</h2>
                <p className="text-sm text-gray-400">Your personal information</p>
              </div>

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-[#6d5cff]/20 flex items-center justify-center text-2xl font-bold text-[#6d5cff]">
                  {(name || user?.email || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{user?.email}</p>
                  <p className="text-xs text-gray-500">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}</p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full max-w-md rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#6d5cff]"
                  placeholder="Your name"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Email</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full max-w-md rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-gray-500 outline-none opacity-60"
                />
              </div>
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Preferences</h2>
                <p className="text-sm text-gray-400">Customize your experience</p>
              </div>

              {/* Theme */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Theme</label>
                <div className="flex gap-2">
                  {(["dark", "light", "system"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors",
                        theme === t
                          ? "border-[#6d5cff] bg-[#6d5cff]/10 text-[#6d5cff]"
                          : "border-[#2A2A2A] text-gray-400 hover:border-[#6d5cff]/50"
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Editor Font Size: {fontSize}px</label>
                <input
                  type="range"
                  min={12}
                  max={20}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full max-w-xs"
                />
              </div>

              {/* Default framework */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Default Framework</label>
                <select
                  value={defaultFramework}
                  onChange={(e) => setDefaultFramework(e.target.value)}
                  className="rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-white outline-none focus:border-[#6d5cff]"
                >
                  <option value="react-vite">React + Vite</option>
                  <option value="nextjs">Next.js</option>
                  <option value="vue">Vue</option>
                </select>
              </div>

              {/* Auto-save */}
              <div className="flex items-center justify-between max-w-md">
                <div>
                  <label className="text-sm font-medium text-white">Auto-save</label>
                  <p className="text-xs text-gray-500">Save files automatically</p>
                </div>
                <button
                  onClick={() => setAutoSave(!autoSave)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    autoSave ? "bg-[#6d5cff]" : "bg-[#2A2A2A]"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white transition-transform",
                      autoSave ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>
          )}

          {activeTab === "api-keys" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">API Keys</h2>
                <p className="text-sm text-gray-400">Connect your own API keys for extended usage</p>
              </div>

              {/* Anthropic */}
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">Anthropic API Key</label>
                <div className="relative max-w-md">
                  <input
                    type={showAnthropicKey ? "text" : "password"}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 pr-10 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#6d5cff]"
                    placeholder="sk-ant-..."
                  />
                  <button
                    onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showAnthropicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* OpenAI */}
              <div>
                <label className="block text-sm font-medium text-white mb-1.5">OpenAI API Key</label>
                <div className="relative max-w-md">
                  <input
                    type={showOpenaiKey ? "text" : "password"}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 pr-10 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#6d5cff]"
                    placeholder="sk-..."
                  />
                  <button
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showOpenaiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "billing" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Billing</h2>
                <p className="text-sm text-gray-400">Manage your plan and usage</p>
              </div>

              <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Current Plan</p>
                    <p className="text-xl font-bold text-white">{user?.plan || "FREE"}</p>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    user?.plan === "PRO" ? "bg-[#6d5cff]/10 text-[#6d5cff]" :
                    user?.plan === "BUSINESS" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                    "bg-[#1A1A1A] text-gray-400"
                  )}>
                    {user?.plan || "FREE"}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Credits used</span>
                    <span className="text-white">{user?.creditsUsed ?? 0} / {user?.creditsLimit ?? 50}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#1A1A1A] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#6d5cff] transition-all"
                      style={{ width: `${Math.min(100, ((user?.creditsUsed ?? 0) / (user?.creditsLimit ?? 50)) * 100)}%` }}
                    />
                  </div>
                </div>

                <button className="w-full rounded-lg bg-[#6d5cff] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d5cff]/90 transition-colors">
                  Upgrade Plan
                </button>
              </div>
            </div>
          )}

          {activeTab === "danger" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-red-400 mb-1">Danger Zone</h2>
                <p className="text-sm text-gray-400">Irreversible and destructive actions</p>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                <h3 className="text-sm font-medium text-white mb-1">Delete Account</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          )}

          {/* Save button (sticky) */}
          <div className="mt-8 pt-4 border-t border-[#2A2A2A]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#6d5cff] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#6d5cff]/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : saved ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saved ? "Saved!" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
