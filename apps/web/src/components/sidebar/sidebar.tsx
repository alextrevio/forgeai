"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Sparkles,
  Plus,
  FileText,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ExternalLink,
  Copy,
  Trash2,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  status: string;
  framework: string;
  engineStatus?: string;
  updatedAt: string;
}

const planColors: Record<string, string> = {
  FREE: "bg-[#2A2A2A] text-[#8888a0]",
  PRO: "bg-[#7c3aed]/10 text-[#7c3aed]",
  BUSINESS: "bg-[#f59e0b]/10 text-[#f59e0b]",
  ENTERPRISE: "bg-[#22c55e]/10 text-[#22c55e]",
};

const STORAGE_KEY = "arya-sidebar-collapsed";

interface SidebarProps {
  onNewProject?: () => void;
}

export function Sidebar({ onNewProject }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  // Responsive check
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setMobileOpen(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await api.listProjects();
        setProjects(Array.isArray(data) ? data : []);
      } catch {
        // Silently fail — projects list is non-critical for sidebar
      }
    };
    fetchProjects();
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  // Close mobile sidebar on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ id: projectId, x: e.clientX, y: e.clientY });
  };

  const handleDeleteProject = async (id: string) => {
    setContextMenu(null);
    if (!confirm("¿Estás seguro de que quieres eliminar este proyecto?")) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (pathname === `/project/${id}`) {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
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

  const activeProjectId = pathname?.startsWith("/project/")
    ? pathname.split("/")[2]
    : null;

  const isSettingsActive = pathname === "/settings";
  const isUsageActive = pathname?.includes("/usage");

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "User";
  const userInitial = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  // ── Sidebar Content ────────────────────────────────────────

  const sidebarContent = (
    <>
      {/* Header: Logo + collapse toggle */}
      <div className="flex h-14 items-center justify-between border-b border-[#1E1E1E] px-4 shrink-0">
        <div className="flex items-center gap-2.5 cursor-default">
          <Sparkles className="h-5 w-5 text-[#7c3aed] shrink-0" />
          {!collapsed && (
            <span className="text-lg font-semibold text-[#EDEDED] tracking-tight">
              Arya AI
            </span>
          )}
        </div>
        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            className="rounded-md p-1 text-[#555555] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* New project button */}
      <div className="px-3 pt-4 pb-2 shrink-0">
        <button
          onClick={() => {
            setMobileOpen(false);
            onNewProject?.();
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border border-[#2A2A2A] text-sm font-medium text-[#EDEDED] transition-colors hover:bg-[#1A1A1A]",
            collapsed ? "justify-center p-2.5" : "px-3 py-2.5"
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Nuevo proyecto</span>}
        </button>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {!collapsed && (
          <p className="text-xs uppercase tracking-wider text-[#555555] px-3 mb-2">
            Recientes
          </p>
        )}
        <div className="space-y-0.5">
          {projects.slice(0, 20).map((project, index) => (
            <button
              key={project.id}
              onClick={() => router.push(`/project/${project.id}`)}
              onContextMenu={(e) => handleContextMenu(e, project.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md text-sm transition-colors duration-150",
                collapsed ? "justify-center p-2.5" : "px-3 py-2",
                activeProjectId === project.id
                  ? "bg-[#1A1A1A] border-l-2 border-[#7c3aed]"
                  : "hover:bg-[#1A1A1A] border-l-2 border-transparent"
              )}
              title={collapsed ? project.name : undefined}
              style={{
                animationDelay: `${index * 30}ms`,
              }}
            >
              <div className="relative shrink-0">
                <FileText
                  className={cn(
                    "h-4 w-4",
                    activeProjectId === project.id ? "text-[#7c3aed]" : "text-[#555555]"
                  )}
                />
                {(project.engineStatus === "running" || project.engineStatus === "planning") && (
                  <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#22c55e] live-pulse" />
                )}
              </div>
              {!collapsed && (
                <span
                  className={cn(
                    "truncate text-left",
                    activeProjectId === project.id ? "text-[#EDEDED]" : "text-[#8888a0]"
                  )}
                >
                  {project.name}
                </span>
              )}
            </button>
          ))}
          {projects.length === 0 && !collapsed && (
            <p className="px-3 py-4 text-xs text-[#555555] text-center">
              No hay proyectos aún
            </p>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-[#1E1E1E] px-3 py-2 space-y-0.5 shrink-0">
        <button
          onClick={() => router.push("/settings")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md text-sm transition-colors duration-150",
            collapsed ? "justify-center p-2.5" : "px-3 py-2",
            isSettingsActive
              ? "bg-[#1A1A1A] text-[#EDEDED]"
              : "text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED]"
          )}
          title={collapsed ? "Configuración" : undefined}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Configuración</span>}
        </button>

        <button
          onClick={() => router.push("/dashboard/usage")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md text-sm transition-colors duration-150",
            collapsed ? "justify-center p-2.5" : "px-3 py-2",
            isUsageActive
              ? "bg-[#1A1A1A] text-[#EDEDED]"
              : "text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED]"
          )}
          title={collapsed ? "Uso" : undefined}
        >
          <BarChart3 className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Uso</span>}
        </button>
      </div>

      {/* User section */}
      <div className="border-t border-[#1E1E1E] p-3 shrink-0">
        <div
          className={cn(
            "flex items-center rounded-md",
            collapsed ? "justify-center" : "gap-3 px-2 py-2"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7c3aed]/20 text-xs font-semibold text-[#7c3aed]">
            {userInitial}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#EDEDED]">{firstName}</p>
              <span
                className={cn(
                  "inline-block text-[10px] font-medium rounded-full px-2 py-0.5",
                  planColors[user?.plan || "FREE"]
                )}
              >
                {user?.plan || "FREE"}
              </span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="rounded-md p-1.5 text-[#555555] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </>
  );

  // ── Context Menu ───────────────────────────────────────────

  const contextMenuEl = contextMenu && (
    <div
      ref={contextRef}
      className="fixed z-[100] w-44 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] py-1 shadow-2xl animate-fade-in"
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <button
        onClick={() => {
          router.push(`/project/${contextMenu.id}`);
          setContextMenu(null);
        }}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#EDEDED] hover:bg-[#2A2A2A] transition-colors"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Abrir
      </button>
      <button
        onClick={() => handleForkProject(contextMenu.id)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#EDEDED] hover:bg-[#2A2A2A] transition-colors"
      >
        <Copy className="h-3.5 w-3.5" /> Duplicar
      </button>
      <div className="my-1 h-px bg-[#2A2A2A]" />
      <button
        onClick={() => handleDeleteProject(contextMenu.id)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar
      </button>
    </div>
  );

  // ── Mobile: Overlay sidebar ────────────────────────────────

  if (isMobile) {
    return (
      <>
        {/* Mobile header bar */}
        <header className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center justify-between border-b border-[#1E1E1E] bg-[#0E0E0E] px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-[#8888a0] hover:text-[#EDEDED] transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#7c3aed]" />
            <span className="text-sm font-semibold text-[#EDEDED]">Arya AI</span>
          </div>
          <div className="w-8" /> {/* Balance spacer */}
        </header>

        {/* Mobile overlay */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-[#0E0E0E] shadow-2xl animate-slide-in-left">
              <div className="absolute right-3 top-3">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-1.5 text-[#555555] hover:text-[#EDEDED] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebarContent}
            </aside>
          </>
        )}

        {contextMenuEl}
      </>
    );
  }

  // ── Desktop: Fixed sidebar ─────────────────────────────────

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#0E0E0E] border-r border-[#1E1E1E] transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {sidebarContent}
      </aside>

      {contextMenuEl}
    </>
  );
}

export { STORAGE_KEY as SIDEBAR_STORAGE_KEY };
