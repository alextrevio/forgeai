"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Sparkles,
  ExternalLink,
  Copy,
  Trash2,
  MoreHorizontal,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  status: string;
  framework: string;
  updatedAt: string;
}

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
  onNewProject?: () => void;
}

export function DashboardShell({ children, onNewProject }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  // Sidebar collapse state — persisted in localStorage
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Projects for sidebar
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Load sidebar collapse from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  // Responsive
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch projects for sidebar
  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.listProjects();
        setProjects(Array.isArray(data) ? data : []);
      } catch { /* silent */ }
      finally { setProjectsLoaded(true); }
    };
    load();
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenu]);

  // Active nav
  const activeNav = pathname === "/settings"
    ? "settings"
    : pathname?.includes("/usage")
      ? "usage"
      : "projects";

  // Active project (if in /project/[id])
  const activeProjectId = pathname?.startsWith("/project/")
    ? pathname.split("/")[2] || null
    : null;

  // Context menu actions
  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id: projectId, x: e.clientX, y: e.clientY });
  };

  const handleDeleteProject = async (id: string) => {
    setContextMenu(null);
    if (!confirm("¿Eliminar este proyecto?")) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProjectId === id) router.push("/dashboard");
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleForkProject = async (id: string) => {
    setContextMenu(null);
    try {
      const forked = await api.forkProject(id);
      router.push(`/project/${forked.id}`);
    } catch (err) {
      console.error("Fork failed:", err);
    }
  };

  const handleNewProject = () => {
    setMobileOpen(false);
    if (onNewProject) {
      onNewProject();
    } else {
      router.push("/dashboard");
    }
  };

  const sidebarWidth = collapsed ? "w-[64px]" : "w-[240px]";
  const marginLeft = collapsed ? "ml-[64px]" : "ml-[240px]";

  // ─── Sidebar Content (shared between mobile/desktop) ───
  const renderSidebar = (isMobileMode: boolean) => (
    <div className={cn(
      "flex h-full flex-col bg-[#0E0E0E]",
      !isMobileMode && "border-r border-[#1E1E1E]",
    )}>
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[#1E1E1E] px-4 shrink-0">
        <Sparkles className="h-5 w-5 text-[#7c3aed] shrink-0" />
        {(!collapsed || isMobileMode) && (
          <span className="text-[15px] font-semibold text-[#EDEDED] tracking-tight">Arya AI</span>
        )}
        {isMobileMode && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-[#8888a0] hover:text-[#EDEDED]">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* New project button */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <button
          onClick={handleNewProject}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-[#2A2A2A] text-[#EDEDED] text-[13px] font-medium transition-all hover:bg-[#1A1A1A] hover:border-[#3A3A3A]",
            (collapsed && !isMobileMode) ? "justify-center p-2.5" : "px-3 py-2.5"
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobileMode) && <span>Nuevo proyecto</span>}
        </button>
      </div>

      {/* Recent projects */}
      {(!collapsed || isMobileMode) && (
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          <p className="text-[10px] font-semibold text-[#555555] uppercase tracking-wider px-2 mb-2">Recientes</p>
          {!projectsLoaded ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-[#555555]" />
            </div>
          ) : projects.length === 0 ? (
            <p className="text-[12px] text-[#555555] px-2 py-3">
              No hay proyectos aún
            </p>
          ) : (
            <div className="space-y-0.5">
              {projects.slice(0, 20).map((project, i) => (
                <Link
                  key={project.id}
                  href={`/project/${project.id}`}
                  onClick={() => setMobileOpen(false)}
                  onContextMenu={(e) => handleContextMenu(e, project.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 group sidebar-item-enter",
                    activeProjectId === project.id
                      ? "bg-[#1A1A1A] text-[#EDEDED] border-l-2 border-[#7c3aed] pl-2"
                      : "text-[#999999] hover:bg-[#1A1A1A] hover:text-[#EDEDED]"
                  )}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#555555]" />
                  <span className="truncate flex-1">{project.name}</span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleContextMenu(e, project.id);
                    }}
                    className="shrink-0 rounded p-0.5 text-[#555555] opacity-0 group-hover:opacity-100 hover:text-[#EDEDED] hover:bg-[#2A2A2A] transition-all"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Collapsed: just spacer */}
      {collapsed && !isMobileMode && <div className="flex-1" />}

      {/* Bottom nav */}
      <div className="shrink-0 border-t border-[#1E1E1E] px-3 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-[#1A1A1A] text-[#EDEDED]"
                  : "text-[#999999] hover:bg-[#1A1A1A] hover:text-[#EDEDED]",
                (collapsed && !isMobileMode) && "justify-center"
              )}
              title={(collapsed && !isMobileMode) ? item.label : undefined}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full bg-[#7c3aed]" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {(!collapsed || isMobileMode) && <span>{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* User section */}
      <div className={cn(
        "shrink-0 border-t border-[#1E1E1E] p-3",
        (collapsed && !isMobileMode) && "flex justify-center"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7c3aed]/20 text-[12px] font-semibold text-[#7c3aed]">
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          {(!collapsed || isMobileMode) && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-[#EDEDED]">{user?.name || user?.email?.split("@")[0]}</p>
              <span className={cn(
                "inline-block text-[9px] font-medium rounded-full px-1.5 py-0.5 mt-0.5",
                planColors[user?.plan || "FREE"]
              )}>
                {user?.plan || "FREE"}
              </span>
            </div>
          )}
          {(!collapsed || isMobileMode) && (
            <button
              onClick={logout}
              className="shrink-0 rounded-md p-1.5 text-[#555555] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Collapse toggle (desktop only) */}
      {!isMobileMode && (
        <button
          onClick={toggleCollapsed}
          className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-[#2A2A2A] bg-[#0E0E0E] text-[#555555] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-all"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      )}
    </div>
  );

  // ─── Mobile Layout ───
  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0A0A0A]">
        {/* Mobile header */}
        <header className="flex items-center justify-between border-b border-[#1E1E1E] bg-[#0E0E0E] px-4 py-3 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="text-[#999999] hover:text-[#EDEDED]">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#7c3aed]" />
            <span className="text-[14px] font-semibold text-[#EDEDED]">Arya AI</span>
          </div>
          <NotificationBell />
        </header>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-[280px] animate-slide-in-sidebar">
              {renderSidebar(true)}
            </div>
          </>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    );
  }

  // ─── Desktop Layout ───
  return (
    <div className="flex min-h-screen bg-[#0A0A0A]">
      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-200 relative",
        sidebarWidth
      )}>
        {renderSidebar(false)}
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 transition-all duration-200 overflow-auto", marginLeft)}>
        {children}
      </main>

      {/* Context menu portal */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setContextMenu(null)} />
          <div
            ref={contextRef}
            className="fixed z-[70] w-44 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] py-1.5 shadow-2xl shadow-black/50 animate-dropdown"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => { router.push(`/project/${contextMenu.id}`); setContextMenu(null); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#EDEDED] hover:bg-[#2A2A2A] rounded-md mx-1.5 transition-colors"
              style={{ width: "calc(100% - 12px)" }}
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#999999]" /> Abrir
            </button>
            <button
              onClick={() => handleForkProject(contextMenu.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#EDEDED] hover:bg-[#2A2A2A] rounded-md mx-1.5 transition-colors"
              style={{ width: "calc(100% - 12px)" }}
            >
              <Copy className="h-3.5 w-3.5 text-[#999999]" /> Duplicar
            </button>
            <div className="my-1 h-px bg-[#2A2A2A] mx-1.5" />
            <button
              onClick={() => handleDeleteProject(contextMenu.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-[#ef4444] hover:bg-[#ef4444]/10 rounded-md mx-1.5 transition-colors"
              style={{ width: "calc(100% - 12px)" }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
