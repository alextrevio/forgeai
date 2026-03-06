"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const planColors: Record<string, string> = {
  FREE: "bg-[#2A2A2A] text-[#8888a0]",
  PRO: "bg-[#7c3aed]/10 text-[#7c3aed]",
  BUSINESS: "bg-[#f59e0b]/10 text-[#f59e0b]",
  ENTERPRISE: "bg-[#22c55e]/10 text-[#22c55e]",
};

const NAV_ITEMS = [
  { id: "projects", label: "Proyectos", icon: Home, href: "/dashboard" },
  { id: "usage", label: "Uso", icon: BarChart3, href: "/dashboard/usage" },
  { id: "settings", label: "Ajustes", icon: Settings, href: "/settings" },
];

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const handleNewProject = async () => {
    if (creatingProject) return;
    setCreatingProject(true);
    try {
      const project = await api.createProject("Proyecto sin título", "react-vite");
      router.push(`/project/${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreatingProject(false);
    }
  };

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const activeNav = pathname === "/settings"
    ? "settings"
    : pathname?.includes("/usage")
      ? "usage"
      : "projects";

  const handleNavClick = (item: (typeof NAV_ITEMS)[number]) => {
    router.push(item.href);
  };

  // Mobile: bottom nav bar
  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0A0A0A]">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-[#2A2A2A] bg-[#0A0A0A] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <span className="text-base font-bold text-[#EDEDED] tracking-tight">Arya AI</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={handleNewProject}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed] text-white"
            >
              {creatingProject ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto animate-fade-in">
          {children}
        </main>

        {/* Bottom nav */}
        <nav className="flex items-center justify-around border-t border-[#2A2A2A] bg-[#0A0A0A] px-2 py-2 safe-area-bottom">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg px-4 py-1.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-[#7c3aed]" : "text-[#8888a0]"
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={logout}
            className="flex flex-col items-center gap-0.5 rounded-lg px-4 py-1.5 text-[10px] font-medium text-[#8888a0] transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Salir
          </button>
        </nav>
      </div>
    );
  }

  // Desktop: sidebar
  return (
    <div className="flex min-h-screen bg-[#0A0A0A]">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#2A2A2A] bg-[#0A0A0A] transition-all duration-300",
          sidebarCollapsed ? "w-[64px]" : "w-[240px]"
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-[#2A2A2A] px-4 group cursor-default">
          <span className="text-xl shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12">✨</span>
          {!sidebarCollapsed && (
            <span className="text-base font-bold text-[#EDEDED] tracking-tight">Arya AI</span>
          )}
        </div>

        {/* New project button */}
        <div className="px-3 pt-4 pb-2">
          <button
            onClick={handleNewProject}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg bg-[#7c3aed] text-white text-sm font-medium transition-all hover:bg-[#6d28d9] shadow-lg shadow-[#7c3aed]/20",
              sidebarCollapsed ? "justify-center p-2.5" : "px-3 py-2.5"
            )}
          >
            {creatingProject ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 shrink-0" />
            )}
            {!sidebarCollapsed && <span>Nueva conversación</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#7c3aed]/10 text-[#EDEDED]"
                    : "text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED]"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#7c3aed] transition-all duration-200" />
                )}
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}

          <div className="my-3 h-px bg-[#2A2A2A]" />

          {/* Logout */}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED] transition-colors"
            title={sidebarCollapsed ? "Cerrar sesión" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span>Cerrar sesión</span>}
          </button>
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed((c) => !c)}
          className="mx-3 mb-3 flex items-center justify-center rounded-lg border border-[#2A2A2A] py-2 text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED] transition-colors"
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* User section */}
        <div className={cn("border-t border-[#2A2A2A] p-4", sidebarCollapsed ? "flex justify-center" : "")}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7c3aed]/20 text-sm font-semibold text-[#7c3aed]">
              {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#EDEDED]">{user?.name || user?.email}</p>
                <span className={cn(
                  "inline-block text-[10px] font-medium rounded-full px-2 py-0.5 mt-0.5",
                  planColors[user?.plan || "FREE"]
                )}>
                  {user?.plan || "FREE"}
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn(
        "flex-1 transition-all duration-300 animate-fade-in",
        sidebarCollapsed ? "ml-[64px]" : "ml-[240px]"
      )}>
        {children}
      </main>
    </div>
  );
}
