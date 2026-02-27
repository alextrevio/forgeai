"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CreditCard,
  Crown,
  Check,
  X,
  TrendingUp,
  Calendar,
  Sparkles,
  ArrowUpRight,
  DollarSign,
  Cpu,
  FolderOpen,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface UsageSummary {
  plan: string;
  monthlyBudget: number;
  totalSpent: number;
  creditsUsed: number;
  creditsLimit: number;
  dailyCost: Record<string, { cost: number; tokens: number }>;
  byModel: Record<string, { cost: number; tokens: number; count: number }>;
  byAgent: Record<string, { cost: number; tokens: number; count: number }>;
  topProjects: Array<{ id: string; name: string; cost: number; tokens: number }>;
}

interface UsageRecord {
  id: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  agentType: string | null;
  action: string;
  projectId: string | null;
  createdAt: string;
}

const planColors: Record<string, string> = {
  FREE: "bg-[#2A2A2A] text-[#8888a0]",
  PRO: "bg-[#7c3aed]/10 text-[#7c3aed]",
  BUSINESS: "bg-[#f59e0b]/10 text-[#f59e0b]",
  ENTERPRISE: "bg-[#22c55e]/10 text-[#22c55e]",
};

interface PlanInfo {
  name: string;
  price: string;
  priceNote: string;
  credits: string;
  projects: string;
  githubExport: boolean;
  supabase: boolean;
  prioritySupport: boolean;
  customDomains: boolean;
  teamFeatures: boolean;
  highlight?: boolean;
}

const PLANS: PlanInfo[] = [
  { name: "Free", price: "$0", priceNote: "para siempre", credits: "50 / mes", projects: "3", githubExport: false, supabase: false, prioritySupport: false, customDomains: false, teamFeatures: false },
  { name: "Pro", price: "$19", priceNote: "por mes", credits: "500 / mes", projects: "20", githubExport: true, supabase: true, prioritySupport: false, customDomains: false, teamFeatures: false, highlight: true },
  { name: "Business", price: "$49", priceNote: "por mes", credits: "2,000 / mes", projects: "100", githubExport: true, supabase: true, prioritySupport: true, customDomains: true, teamFeatures: false },
  { name: "Enterprise", price: "Custom", priceNote: "contactanos", credits: "Ilimitados", projects: "Ilimitados", githubExport: true, supabase: true, prioritySupport: true, customDomains: true, teamFeatures: true },
];

const FEATURE_ROWS: { key: keyof PlanInfo; label: string; type: "text" | "boolean" }[] = [
  { key: "credits", label: "Creditos", type: "text" },
  { key: "projects", label: "Proyectos", type: "text" },
  { key: "githubExport", label: "Exportar a GitHub", type: "boolean" },
  { key: "supabase", label: "Integracion Supabase", type: "boolean" },
  { key: "prioritySupport", label: "Soporte prioritario", type: "boolean" },
  { key: "customDomains", label: "Dominios personalizados", type: "boolean" },
  { key: "teamFeatures", label: "Funciones de equipo", type: "boolean" },
];

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("rounded-lg bg-[#1A1A1A] skeleton-shimmer", className)} />;
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsagePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore();
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    const fetchData = async () => {
      try {
        const [summaryData, recordsData] = await Promise.all([
          api.getUsageSummary().catch(() => null),
          api.getUsageRecords({ limit: 20 }).catch(() => ({ records: [] })),
        ]);
        if (summaryData) setSummary(summaryData);
        setRecords(Array.isArray(recordsData?.records) ? recordsData.records : []);
      } catch (err) { console.error("Failed to fetch usage:", err); }
      finally { setIsLoading(false); }
    };
    fetchData();
  }, [authLoading, isAuthenticated, router]);

  // Daily chart data (last 7 days)
  const dailyData = useMemo(() => {
    const days: Array<{ date: string; cost: number; tokens: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const entry = summary?.dailyCost?.[key];
      days.push({ date: key, cost: entry?.cost || 0, tokens: entry?.tokens || 0 });
    }
    return days;
  }, [summary]);

  const maxDailyCost = useMemo(() => Math.max(...dailyData.map((d) => d.cost), 0.01), [dailyData]);
  const totalWeeklyCost = useMemo(() => dailyData.reduce((sum, d) => sum + d.cost, 0), [dailyData]);

  const currentPlan = summary?.plan ?? user?.plan ?? "FREE";
  const monthlyBudget = summary?.monthlyBudget ?? 10;
  const totalSpent = summary?.totalSpent ?? 0;
  const spendingPercent = monthlyBudget > 0 ? Math.min(100, Math.round((totalSpent / monthlyBudget) * 100)) : 0;

  const handleUpgrade = async (planName: string) => {
    const planKey = planName.toUpperCase();
    if (planKey === currentPlan) return;
    setUpgradingPlan(planKey);
    try {
      await api.upgradePlan(planKey);
      await loadUser();
      const data = await api.getUsageSummary();
      if (data) setSummary(data);
    } catch (err) { console.error("Failed to upgrade plan:", err); }
    finally { setUpgradingPlan(null); }
  };

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-ES", { weekday: "short" });
  };
  const formatDayShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="mb-8"><SkeletonBlock className="h-8 w-48 mb-2" /><SkeletonBlock className="h-4 w-64" /></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
            <SkeletonBlock className="h-36 rounded-xl" /><SkeletonBlock className="h-36 rounded-xl" /><SkeletonBlock className="h-36 rounded-xl" />
          </div>
          <SkeletonBlock className="h-72 rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#EDEDED]">Uso y Facturacion</h1>
          <p className="text-sm text-[#8888a0] mt-1">Monitorea tu uso, gestiona tu plan y consulta los detalles de facturacion</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
          {/* Current plan */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#8888a0]">Plan actual</span>
              <Crown className="h-4 w-4 text-[#7c3aed]" />
            </div>
            <span className={cn("text-sm font-semibold rounded-full px-3 py-1", planColors[currentPlan])}>{currentPlan}</span>
            <p className="text-xs text-[#8888a0] mt-3">
              {currentPlan === "FREE" ? "Mejora para desbloquear mas funciones" : "Suscripcion activa"}
            </p>
          </div>

          {/* Spending cap */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#8888a0]">Gasto este mes</span>
              <DollarSign className="h-4 w-4 text-[#f59e0b]" />
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-2xl font-bold text-[#EDEDED]">{formatUsd(totalSpent)}</span>
              <span className="text-sm text-[#8888a0] mb-0.5">/ {formatUsd(monthlyBudget)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#2A2A2A] overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500", spendingPercent > 80 ? "bg-[#ef4444]" : spendingPercent > 50 ? "bg-[#f59e0b]" : "bg-[#7c3aed]")} style={{ width: `${spendingPercent}%` }} />
            </div>
            <p className="text-xs text-[#8888a0] mt-2">{spendingPercent}% del limite mensual</p>
          </div>

          {/* Billing period */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#8888a0]">Periodo de facturacion</span>
              <Calendar className="h-4 w-4 text-[#22c55e]" />
            </div>
            <p className="text-lg font-semibold text-[#EDEDED] mb-1">Mensual</p>
            <p className="text-xs text-[#8888a0]">Se renueva el 1 de cada mes</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#22c55e]">
              <TrendingUp className="h-3 w-3" /><span>El gasto se reinicia automaticamente</span>
            </div>
          </div>
        </div>

        {/* Daily Cost Chart */}
        <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[#EDEDED]">Costo diario</h2>
              <p className="text-sm text-[#8888a0] mt-0.5">Gasto en USD de los ultimos 7 dias</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#1A1A1A] px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#7c3aed]" />
              <span className="text-sm font-medium text-[#EDEDED]">{formatUsd(totalWeeklyCost)}</span>
              <span className="text-xs text-[#8888a0]">esta semana</span>
            </div>
          </div>
          <div className="flex items-end gap-3 h-48">
            {dailyData.map((day, i) => {
              const heightPercent = maxDailyCost > 0 ? (day.cost / maxDailyCost) * 100 : 0;
              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-medium text-[#8888a0]">{formatUsd(day.cost)}</span>
                  <div className="relative w-full flex justify-center flex-1">
                    <div className="w-full max-w-[48px] rounded-t-lg bg-[#1A1A1A] relative overflow-hidden self-end" style={{ height: "100%" }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-700 ease-out"
                        style={{ height: `${Math.max(heightPercent, 4)}%`, background: `linear-gradient(to top, #7c3aed, ${i === dailyData.length - 1 ? "#a78bfa" : "#7c3aed99"})` }}
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-[#EDEDED]/80">{formatDay(day.date)}</p>
                    <p className="text-[10px] text-[#8888a0]/60">{formatDayShort(day.date)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Breakdown: Model + Agent side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* By Model */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="h-4 w-4 text-[#7c3aed]" />
              <h3 className="text-sm font-semibold text-[#EDEDED]">Por modelo</h3>
            </div>
            <div className="space-y-3">
              {summary?.byModel && Object.entries(summary.byModel).length > 0 ? (
                Object.entries(summary.byModel)
                  .sort(([, a], [, b]) => b.cost - a.cost)
                  .map(([model, data]) => (
                    <div key={model} className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#EDEDED] truncate">{model.replace("claude-", "").replace("-20250929", "").replace("-20250514", "")}</p>
                        <p className="text-[10px] text-[#8888a0]">{formatTokens(data.tokens)} tokens / {data.count} llamadas</p>
                      </div>
                      <span className="text-xs font-medium text-[#EDEDED] tabular-nums">{formatUsd(data.cost)}</span>
                    </div>
                  ))
              ) : (
                <p className="text-xs text-[#8888a0]/60">Sin datos aun</p>
              )}
            </div>
          </div>

          {/* By Agent */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-[#7c3aed]" />
              <h3 className="text-sm font-semibold text-[#EDEDED]">Por agente</h3>
            </div>
            <div className="space-y-3">
              {summary?.byAgent && Object.entries(summary.byAgent).length > 0 ? (
                Object.entries(summary.byAgent)
                  .sort(([, a], [, b]) => b.cost - a.cost)
                  .map(([agent, data]) => (
                    <div key={agent} className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[#EDEDED] capitalize">{agent}</p>
                        <p className="text-[10px] text-[#8888a0]">{formatTokens(data.tokens)} tokens / {data.count} llamadas</p>
                      </div>
                      <span className="text-xs font-medium text-[#EDEDED] tabular-nums">{formatUsd(data.cost)}</span>
                    </div>
                  ))
              ) : (
                <p className="text-xs text-[#8888a0]/60">Sin datos aun</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Projects */}
        {summary?.topProjects && summary.topProjects.length > 0 && (
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FolderOpen className="h-4 w-4 text-[#7c3aed]" />
              <h3 className="text-sm font-semibold text-[#EDEDED]">Top proyectos por costo</h3>
            </div>
            <div className="space-y-2">
              {summary.topProjects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/project/${p.id}`)}
                  className="flex items-center justify-between w-full rounded-lg px-3 py-2 hover:bg-[#1A1A1A] transition-colors"
                >
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-xs text-[#EDEDED] truncate">{p.name}</p>
                    <p className="text-[10px] text-[#8888a0]">{formatTokens(p.tokens)} tokens</p>
                  </div>
                  <span className="text-xs font-medium text-[#EDEDED] tabular-nums">{formatUsd(p.cost)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Records Table */}
        {records.length > 0 && (
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 mb-8">
            <h3 className="text-sm font-semibold text-[#EDEDED] mb-4">Registros recientes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2A2A2A]/50">
                    <th className="text-left py-2 px-2 text-[#8888a0] font-medium">Modelo</th>
                    <th className="text-left py-2 px-2 text-[#8888a0] font-medium">Agente</th>
                    <th className="text-right py-2 px-2 text-[#8888a0] font-medium">Tokens</th>
                    <th className="text-right py-2 px-2 text-[#8888a0] font-medium">Costo</th>
                    <th className="text-right py-2 px-2 text-[#8888a0] font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-[#2A2A2A]/30">
                      <td className="py-2 px-2 text-[#EDEDED]">{r.model.replace("claude-", "").replace("-20250929", "").replace("-20250514", "")}</td>
                      <td className="py-2 px-2 text-[#8888a0] capitalize">{r.agentType || r.action}</td>
                      <td className="py-2 px-2 text-right text-[#8888a0] tabular-nums">{formatTokens(r.totalTokens)}</td>
                      <td className="py-2 px-2 text-right text-[#EDEDED] tabular-nums">{formatUsd(r.costUsd)}</td>
                      <td className="py-2 px-2 text-right text-[#8888a0]">{new Date(r.createdAt).toLocaleDateString("es-ES", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Plan Comparison */}
        <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 mb-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[#EDEDED]">Compara planes</h2>
            <p className="text-sm text-[#8888a0] mt-0.5">Elige el plan que se adapte a tus necesidades</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left py-4 px-4 text-sm font-medium text-[#8888a0]/60 w-48">Caracteristica</th>
                  {PLANS.map((plan) => (
                    <th key={plan.name} className="py-4 px-4 text-center">
                      <div className={cn("rounded-xl border p-4 transition-all", plan.highlight ? "border-[#7c3aed] bg-[#7c3aed]/5" : "border-[#2A2A2A]")}>
                        {plan.highlight && <span className="inline-block text-[10px] font-semibold text-[#7c3aed] bg-[#7c3aed]/10 rounded-full px-2 py-0.5 mb-2">POPULAR</span>}
                        <p className="text-sm font-semibold text-[#EDEDED]">{plan.name}</p>
                        <div className="mt-1">
                          <span className="text-xl font-bold text-[#EDEDED]">{plan.price}</span>
                          <span className="text-xs text-[#8888a0] ml-1">{plan.priceNote}</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((feature) => (
                  <tr key={feature.key} className="border-t border-[#2A2A2A]/50">
                    <td className="py-3.5 px-4 text-sm text-[#EDEDED]/80">{feature.label}</td>
                    {PLANS.map((plan) => {
                      const value = plan[feature.key];
                      return (
                        <td key={plan.name} className="py-3.5 px-4 text-center">
                          {feature.type === "boolean" ? (
                            value ? <Check className="h-4 w-4 text-[#22c55e] mx-auto" /> : <X className="h-4 w-4 text-[#8888a0]/30 mx-auto" />
                          ) : (
                            <span className="text-sm text-[#EDEDED]">{value as string}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t border-[#2A2A2A]/50">
                  <td className="py-4 px-4" />
                  {PLANS.map((plan) => {
                    const planKey = plan.name.toUpperCase();
                    const isCurrent = planKey === currentPlan;
                    const isUpgrading = upgradingPlan === planKey;
                    return (
                      <td key={plan.name} className="py-4 px-4 text-center">
                        <button onClick={() => handleUpgrade(plan.name)} disabled={isCurrent || isUpgrading}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                            isCurrent ? "bg-[#1A1A1A] text-[#8888a0] cursor-default" :
                            plan.highlight ? "bg-[#7c3aed] text-white hover:bg-[#6d28d9] shadow-lg shadow-[#7c3aed]/20" :
                            "border border-[#2A2A2A] text-[#EDEDED] hover:bg-[#1A1A1A] hover:border-[#7c3aed]/50",
                            isUpgrading && "opacity-50"
                          )}
                        >
                          {isUpgrading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isCurrent ? "Actual" : <><span>Mejorar</span><ArrowUpRight className="h-3.5 w-3.5" /></>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
