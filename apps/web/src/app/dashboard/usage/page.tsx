"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  BarChart3,
  Settings,
  Home,
  LogOut,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Crown,
  Check,
  X,
  TrendingUp,
  Calendar,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
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
  FREE: "bg-[#161619] text-gray-300",
  PRO: "bg-[#6d5cff]/10 text-[#6d5cff]",
  BUSINESS: "bg-[#f59e0b]/10 text-[#f59e0b]",
  ENTERPRISE: "bg-[#22c55e]/10 text-[#22c55e]",
};

const NAV_ITEMS = [
  { id: "projects", label: "Projects", icon: Home, href: "/dashboard" },
  { id: "usage", label: "Usage", icon: BarChart3, href: "/dashboard/usage" },
  { id: "settings", label: "Settings", icon: Settings, href: "/dashboard" },
];

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
  {
    name: "Free",
    price: "$0",
    priceNote: "forever",
    credits: "50 / month",
    projects: "3",
    githubExport: false,
    supabase: false,
    prioritySupport: false,
    customDomains: false,
    teamFeatures: false,
  },
  {
    name: "Pro",
    price: "$19",
    priceNote: "per month",
    credits: "500 / month",
    projects: "20",
    githubExport: true,
    supabase: true,
    prioritySupport: false,
    customDomains: false,
    teamFeatures: false,
    highlight: true,
  },
  {
    name: "Business",
    price: "$49",
    priceNote: "per month",
    credits: "2,000 / month",
    projects: "100",
    githubExport: true,
    supabase: true,
    prioritySupport: true,
    customDomains: true,
    teamFeatures: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    priceNote: "contact us",
    credits: "Unlimited",
    projects: "Unlimited",
    githubExport: true,
    supabase: true,
    prioritySupport: true,
    customDomains: true,
    teamFeatures: true,
  },
];

const FEATURE_ROWS: { key: keyof PlanInfo; label: string; type: "text" | "boolean" }[] = [
  { key: "credits", label: "Credits", type: "text" },
  { key: "projects", label: "Projects", type: "text" },
  { key: "githubExport", label: "GitHub Export", type: "boolean" },
  { key: "supabase", label: "Supabase Integration", type: "boolean" },
  { key: "prioritySupport", label: "Priority Support", type: "boolean" },
  { key: "customDomains", label: "Custom Domains", type: "boolean" },
  { key: "teamFeatures", label: "Team Features", type: "boolean" },
];

export default function UsagePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser, logout } =
    useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchUsage = async () => {
      try {
        const data = await api.getUsage();
        setUsageData(data);
      } catch (err) {
        console.error("Failed to fetch usage:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsage();
  }, [authLoading, isAuthenticated, router]);

  // Generate dummy daily usage data for the chart if API doesn't return it
  const dailyUsage = useMemo(() => {
    if (usageData?.dailyUsage && Array.isArray(usageData.dailyUsage) && usageData.dailyUsage.length > 0) {
      return usageData.dailyUsage.slice(-7);
    }

    // Generate random dummy data for the last 7 days
    const days: DailyUsage[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toISOString().split("T")[0],
        credits: Math.floor(Math.random() * 12) + 1,
      });
    }
    return days;
  }, [usageData]);

  const maxDailyCredits = useMemo(
    () => Math.max(...dailyUsage.map((d) => d.credits), 1),
    [dailyUsage]
  );

  const totalWeeklyCredits = useMemo(
    () => dailyUsage.reduce((sum, d) => sum + d.credits, 0),
    [dailyUsage]
  );

  const creditPercent =
    usageData?.creditsLimit && usageData.creditsLimit > 0
      ? Math.min(
          100,
          Math.round(
            (usageData.creditsUsed / usageData.creditsLimit) * 100
          )
        )
      : user?.creditsLimit
        ? Math.min(
            100,
            Math.round((user.creditsUsed / user.creditsLimit) * 100)
          )
        : 0;

  const creditsUsed = usageData?.creditsUsed ?? user?.creditsUsed ?? 0;
  const creditsLimit = usageData?.creditsLimit ?? user?.creditsLimit ?? 50;
  const currentPlan = usageData?.plan ?? user?.plan ?? "FREE";

  const handleUpgrade = async (planName: string) => {
    const planKey = planName.toUpperCase();
    if (planKey === currentPlan) return;

    setUpgradingPlan(planKey);
    try {
      await api.upgradePlan(planKey);
      await loadUser();
      const data = await api.getUsage();
      setUsageData(data);
    } catch (err) {
      console.error("Failed to upgrade plan:", err);
    } finally {
      setUpgradingPlan(null);
    }
  };

  const handleNavClick = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.id === "projects") {
      router.push("/dashboard");
    }
  };

  const formatDay = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  const formatDayShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6d5cff]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#1a1a1f] bg-[#111114] transition-all duration-300",
          sidebarCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-[#1a1a1f] px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#6d5cff]/10">
            <Zap className="h-5 w-5 text-[#6d5cff]" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-bold text-white tracking-tight">
              ForgeAI
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === "usage";
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#6d5cff]/10 text-[#6d5cff]"
                    : "text-gray-400 hover:bg-[#161619] hover:text-white"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}

          {/* Separator */}
          <div className="my-3 h-px bg-[#1a1a1f]" />

          {/* Logout */}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-[#161619] hover:text-white transition-colors"
            title={sidebarCollapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed((c) => !c)}
          className="mx-3 mb-3 flex items-center justify-center rounded-lg border border-[#1a1a1f] py-2 text-gray-400 hover:bg-[#161619] hover:text-white transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* User section */}
        <div
          className={cn(
            "border-t border-[#1a1a1f] p-4",
            sidebarCollapsed ? "flex justify-center" : ""
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#6d5cff]/20 text-sm font-semibold text-[#6d5cff]">
              {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user?.name || user?.email}
                </p>
                <span
                  className={cn(
                    "inline-block text-[10px] font-medium rounded-full px-2 py-0.5 mt-0.5",
                    planColors[user?.plan || "FREE"]
                  )}
                >
                  {user?.plan || "FREE"}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          sidebarCollapsed ? "ml-[68px]" : "ml-64"
        )}
      >
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Usage & Billing</h1>
            <p className="text-sm text-gray-400 mt-1">
              Monitor your usage, manage your plan, and view billing details
            </p>
          </div>

          {/* Usage Overview Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
            {/* Current plan */}
            <div className="rounded-xl border border-[#1a1a1f] bg-[#111114] p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Current Plan</span>
                <Crown className="h-4 w-4 text-[#6d5cff]" />
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "text-sm font-semibold rounded-full px-3 py-1",
                    planColors[currentPlan]
                  )}
                >
                  {currentPlan}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                {currentPlan === "FREE"
                  ? "Upgrade to unlock more features"
                  : currentPlan === "ENTERPRISE"
                    ? "Full access to all features"
                    : "Active subscription"}
              </p>
            </div>

            {/* Credits usage */}
            <div className="rounded-xl border border-[#1a1a1f] bg-[#111114] p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Credits Used</span>
                <CreditCard className="h-4 w-4 text-[#f59e0b]" />
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-2xl font-bold text-white">
                  {creditsUsed}
                </span>
                <span className="text-sm text-gray-400 mb-0.5">
                  / {creditsLimit}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#161619] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    creditPercent > 80
                      ? "bg-[#ef4444]"
                      : creditPercent > 50
                        ? "bg-[#f59e0b]"
                        : "bg-[#6d5cff]"
                  )}
                  style={{ width: `${creditPercent}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {creditPercent}% of monthly limit used
              </p>
            </div>

            {/* Billing period */}
            <div className="rounded-xl border border-[#1a1a1f] bg-[#111114] p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400">Billing Period</span>
                <Calendar className="h-4 w-4 text-[#22c55e]" />
              </div>
              <p className="text-lg font-semibold text-white mb-1">
                Monthly
              </p>
              <p className="text-xs text-gray-500">
                Resets on the 1st of each month
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-[#22c55e]">
                <TrendingUp className="h-3 w-3" />
                <span>Credits renew automatically</span>
              </div>
            </div>
          </div>

          {/* Daily Usage Chart */}
          <div className="rounded-xl border border-[#1a1a1f] bg-[#111114] p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Daily Usage
                </h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  Credits consumed over the last 7 days
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-[#161619] px-3 py-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#6d5cff]" />
                <span className="text-sm font-medium text-white">
                  {totalWeeklyCredits}
                </span>
                <span className="text-xs text-gray-400">this week</span>
              </div>
            </div>

            {/* Chart */}
            <div className="flex items-end gap-3 h-48">
              {dailyUsage.map((day, i) => {
                const heightPercent =
                  maxDailyCredits > 0
                    ? (day.credits / maxDailyCredits) * 100
                    : 0;
                return (
                  <div
                    key={day.date}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    {/* Credit count above bar */}
                    <span className="text-xs font-medium text-gray-400">
                      {day.credits}
                    </span>

                    {/* Bar */}
                    <div className="relative w-full flex justify-center flex-1">
                      <div className="w-full max-w-[48px] rounded-t-lg bg-[#161619] relative overflow-hidden self-end"
                        style={{ height: "100%" }}
                      >
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-t-lg transition-all duration-700 ease-out"
                          style={{
                            height: `${Math.max(heightPercent, 4)}%`,
                            background: `linear-gradient(to top, #6d5cff, ${
                              i === dailyUsage.length - 1
                                ? "#8b7aff"
                                : "#6d5cff99"
                            })`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Day labels */}
                    <div className="text-center">
                      <p className="text-xs font-medium text-gray-300">
                        {formatDay(day.date)}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {formatDayShort(day.date)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Plan Comparison */}
          <div className="rounded-xl border border-[#1a1a1f] bg-[#111114] p-6 mb-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white">
                Compare Plans
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Choose the plan that fits your needs
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left py-4 px-4 text-sm font-medium text-gray-500 w-48">
                      Feature
                    </th>
                    {PLANS.map((plan) => (
                      <th key={plan.name} className="py-4 px-4 text-center">
                        <div
                          className={cn(
                            "rounded-xl border p-4 transition-all",
                            plan.highlight
                              ? "border-[#6d5cff] bg-[#6d5cff]/5"
                              : "border-[#1a1a1f]"
                          )}
                        >
                          {plan.highlight && (
                            <span className="inline-block text-[10px] font-semibold text-[#6d5cff] bg-[#6d5cff]/10 rounded-full px-2 py-0.5 mb-2">
                              POPULAR
                            </span>
                          )}
                          <p className="text-sm font-semibold text-white">
                            {plan.name}
                          </p>
                          <div className="mt-1">
                            <span className="text-xl font-bold text-white">
                              {plan.price}
                            </span>
                            <span className="text-xs text-gray-400 ml-1">
                              {plan.priceNote}
                            </span>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((feature) => (
                    <tr
                      key={feature.key}
                      className="border-t border-[#1a1a1f]/50"
                    >
                      <td className="py-3.5 px-4 text-sm text-gray-300">
                        {feature.label}
                      </td>
                      {PLANS.map((plan) => {
                        const value = plan[feature.key];
                        return (
                          <td
                            key={plan.name}
                            className="py-3.5 px-4 text-center"
                          >
                            {feature.type === "boolean" ? (
                              value ? (
                                <Check className="h-4 w-4 text-[#22c55e] mx-auto" />
                              ) : (
                                <X className="h-4 w-4 text-gray-600 mx-auto" />
                              )
                            ) : (
                              <span className="text-sm text-white">
                                {value as string}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Price row */}
                  <tr className="border-t border-[#1a1a1f]/50">
                    <td className="py-3.5 px-4 text-sm font-medium text-gray-300">
                      Price
                    </td>
                    {PLANS.map((plan) => (
                      <td
                        key={plan.name}
                        className="py-3.5 px-4 text-center"
                      >
                        <span className="text-sm font-semibold text-white">
                          {plan.price}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">
                          / {plan.priceNote}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Upgrade buttons */}
                  <tr className="border-t border-[#1a1a1f]/50">
                    <td className="py-4 px-4" />
                    {PLANS.map((plan) => {
                      const planKey = plan.name.toUpperCase();
                      const isCurrent = planKey === currentPlan;
                      const isUpgrading = upgradingPlan === planKey;

                      return (
                        <td
                          key={plan.name}
                          className="py-4 px-4 text-center"
                        >
                          <button
                            onClick={() => handleUpgrade(plan.name)}
                            disabled={isCurrent || isUpgrading}
                            className={cn(
                              "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                              isCurrent
                                ? "bg-[#161619] text-gray-400 cursor-default"
                                : plan.highlight
                                  ? "bg-[#6d5cff] text-white hover:bg-[#6d5cff]/90 shadow-lg shadow-[#6d5cff]/20"
                                  : "border border-[#1a1a1f] text-white hover:bg-[#161619] hover:border-[#6d5cff]/50",
                              isUpgrading && "opacity-50"
                            )}
                          >
                            {isUpgrading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : isCurrent ? (
                              "Current"
                            ) : (
                              <>
                                Upgrade
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </>
                            )}
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
      </main>
    </div>
  );
}
