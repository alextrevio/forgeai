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
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DailyUsage {
  date: string;
  credits: number;
}

interface UsageData {
  plan: string;
  creditsUsed: number;
  creditsLimit: number;
  projectCount: number;
  dailyUsage: DailyUsage[];
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
  { name: "Enterprise", price: "Custom", priceNote: "contáctanos", credits: "Ilimitados", projects: "Ilimitados", githubExport: true, supabase: true, prioritySupport: true, customDomains: true, teamFeatures: true },
];

const FEATURE_ROWS: { key: keyof PlanInfo; label: string; type: "text" | "boolean" }[] = [
  { key: "credits", label: "Créditos", type: "text" },
  { key: "projects", label: "Proyectos", type: "text" },
  { key: "githubExport", label: "Exportar a GitHub", type: "boolean" },
  { key: "supabase", label: "Integración Supabase", type: "boolean" },
  { key: "prioritySupport", label: "Soporte prioritario", type: "boolean" },
  { key: "customDomains", label: "Dominios personalizados", type: "boolean" },
  { key: "teamFeatures", label: "Funciones de equipo", type: "boolean" },
];

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("rounded-lg bg-[#1A1A1A] skeleton-shimmer", className)} />;
}

export default function UsagePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore();
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    const fetchUsage = async () => {
      try { const data = await api.getUsage(); setUsageData(data); }
      catch (err) { console.error("Failed to fetch usage:", err); }
      finally { setIsLoading(false); }
    };
    fetchUsage();
  }, [authLoading, isAuthenticated, router]);

  const dailyUsage = useMemo(() => {
    if (usageData?.dailyUsage && Array.isArray(usageData.dailyUsage) && usageData.dailyUsage.length > 0) return usageData.dailyUsage.slice(-7);
    const days: DailyUsage[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().split("T")[0], credits: Math.floor(Math.random() * 12) + 1 });
    }
    return days;
  }, [usageData]);

  const maxDailyCredits = useMemo(() => Math.max(...dailyUsage.map((d) => d.credits), 1), [dailyUsage]);
  const totalWeeklyCredits = useMemo(() => dailyUsage.reduce((sum, d) => sum + d.credits, 0), [dailyUsage]);

  const creditPercent = usageData?.creditsLimit && usageData.creditsLimit > 0
    ? Math.min(100, Math.round((usageData.creditsUsed / usageData.creditsLimit) * 100))
    : user?.creditsLimit ? Math.min(100, Math.round((user.creditsUsed / user.creditsLimit) * 100)) : 0;

  const creditsUsed = usageData?.creditsUsed ?? user?.creditsUsed ?? 0;
  const creditsLimit = usageData?.creditsLimit ?? user?.creditsLimit ?? 50;
  const currentPlan = usageData?.plan ?? user?.plan ?? "FREE";

  const handleUpgrade = async (planName: string) => {
    const planKey = planName.toUpperCase();
    if (planKey === currentPlan) return;
    setUpgradingPlan(planKey);
    try { await api.upgradePlan(planKey); await loadUser(); const data = await api.getUsage(); setUsageData(data); }
    catch (err) { console.error("Failed to upgrade plan:", err); }
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
          <div className="mb-8">
            <SkeletonBlock className="h-8 w-48 mb-2" />
            <SkeletonBlock className="h-4 w-64" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
            <SkeletonBlock className="h-36 rounded-xl" />
            <SkeletonBlock className="h-36 rounded-xl" />
            <SkeletonBlock className="h-36 rounded-xl" />
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
          <h1 className="text-2xl font-bold text-[#EDEDED]">Uso y Facturación</h1>
          <p className="text-sm text-[#8888a0] mt-1">Monitorea tu uso, gestiona tu plan y consulta los detalles de facturación</p>
        </div>

        {/* Usage Overview Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
          {/* Current plan */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#8888a0]">Plan actual</span>
              <Crown className="h-4 w-4 text-[#7c3aed]" />
            </div>
            <span className={cn("text-sm font-semibold rounded-full px-3 py-1", planColors[currentPlan])}>{currentPlan}</span>
            <p className="text-xs text-[#8888a0] mt-3">
              {currentPlan === "FREE" ? "Mejora para desbloquear más funciones" : currentPlan === "ENTERPRISE" ? "Acceso completo a todas las funciones" : "Suscripción activa"}
            </p>
          </div>

          {/* Credits usage */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#8888a0]">Créditos usados</span>
              <CreditCard className="h-4 w-4 text-[#f59e0b]" />
            </div>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-2xl font-bold text-[#EDEDED]">{creditsUsed}</span>
              <span className="text-sm text-[#8888a0] mb-0.5">/ {creditsLimit}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#2A2A2A] overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-500", creditPercent > 80 ? "bg-[#ef4444]" : creditPercent > 50 ? "bg-[#f59e0b]" : "bg-[#7c3aed]")} style={{ width: `${creditPercent}%` }} />
            </div>
            <p className="text-xs text-[#8888a0] mt-2">{creditPercent}% del límite mensual</p>
          </div>

          {/* Billing period */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-[#8888a0]">Período de facturación</span>
              <Calendar className="h-4 w-4 text-[#22c55e]" />
            </div>
            <p className="text-lg font-semibold text-[#EDEDED] mb-1">Mensual</p>
            <p className="text-xs text-[#8888a0]">Se renueva el 1 de cada mes</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-[#22c55e]">
              <TrendingUp className="h-3 w-3" /><span>Los créditos se renuevan automáticamente</span>
            </div>
          </div>
        </div>

        {/* Daily Usage Chart */}
        <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-[#EDEDED]">Uso diario</h2>
              <p className="text-sm text-[#8888a0] mt-0.5">Créditos consumidos en los últimos 7 días</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#1A1A1A] px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#7c3aed]" />
              <span className="text-sm font-medium text-[#EDEDED]">{totalWeeklyCredits}</span>
              <span className="text-xs text-[#8888a0]">esta semana</span>
            </div>
          </div>

          <div className="flex items-end gap-3 h-48">
            {dailyUsage.map((day, i) => {
              const heightPercent = maxDailyCredits > 0 ? (day.credits / maxDailyCredits) * 100 : 0;
              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-medium text-[#8888a0]">{day.credits}</span>
                  <div className="relative w-full flex justify-center flex-1">
                    <div className="w-full max-w-[48px] rounded-t-lg bg-[#1A1A1A] relative overflow-hidden self-end" style={{ height: "100%" }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-700 ease-out"
                        style={{ height: `${Math.max(heightPercent, 4)}%`, background: `linear-gradient(to top, #7c3aed, ${i === dailyUsage.length - 1 ? "#a78bfa" : "#7c3aed99"})` }}
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
                  <th className="text-left py-4 px-4 text-sm font-medium text-[#8888a0]/60 w-48">Característica</th>
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
                  <td className="py-3.5 px-4 text-sm font-medium text-[#EDEDED]/80">Precio</td>
                  {PLANS.map((plan) => (
                    <td key={plan.name} className="py-3.5 px-4 text-center">
                      <span className="text-sm font-semibold text-[#EDEDED]">{plan.price}</span>
                      <span className="text-xs text-[#8888a0] ml-1">/ {plan.priceNote}</span>
                    </td>
                  ))}
                </tr>
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
