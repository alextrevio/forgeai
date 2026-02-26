"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FolderOpen,
  Trash2,
  ExternalLink,
  Loader2,
  Rocket,
  Code2,
  Layout,
  Globe,
  Server,
  BarChart3,
  CreditCard,
  FileText,
  ShoppingCart,
  BookOpen,
  Search,
  LayoutGrid,
  List,
  ArrowUpDown,
  Cloud,
  Layers,
  GitFork,
  Users,
  MoreVertical,
  Copy,
  Download,
  Clock,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { cn, formatDate } from "@/lib/utils";
import { FRAMEWORKS, TEMPLATES } from "@forgeai/shared";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  framework: string;
  deployUrl: string | null;
  forkedFrom: string | null;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  members?: Array<{ id: string; role: string; user: { email: string } }>;
}

const frameworkIcons: Record<string, React.ReactNode> = {
  "react-vite": <Code2 className="h-4 w-4" />,
  nextjs: <Globe className="h-4 w-4" />,
  vue: <Code2 className="h-4 w-4" />,
  landing: <Layout className="h-4 w-4" />,
  dashboard: <BarChart3 className="h-4 w-4" />,
  saas: <Rocket className="h-4 w-4" />,
  "api-only": <Server className="h-4 w-4" />,
};

const frameworkColors: Record<string, string> = {
  "react-vite": "from-[#61dafb]/20 to-[#7c3aed]/20",
  nextjs: "from-[#EDEDED]/10 to-[#7c3aed]/20",
  vue: "from-[#42b883]/20 to-[#35495e]/20",
  landing: "from-[#f59e0b]/20 to-[#7c3aed]/20",
  dashboard: "from-[#3b82f6]/20 to-[#7c3aed]/20",
  saas: "from-[#7c3aed]/20 to-[#3b82f6]/20",
  "api-only": "from-[#22c55e]/20 to-[#3b82f6]/20",
};

const templateIcons: Record<string, React.ReactNode> = {
  blank: <FileText className="h-5 w-5" />,
  landing: <Globe className="h-5 w-5" />,
  dashboard: <BarChart3 className="h-5 w-5" />,
  saas: <Rocket className="h-5 w-5" />,
  blog: <BookOpen className="h-5 w-5" />,
  ecommerce: <ShoppingCart className="h-5 w-5" />,
};

type StatusFilter = "all" | "active" | "deployed" | "draft";
type SortMode = "recent" | "alphabetical";
type ViewMode = "grid" | "list";

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] overflow-hidden">
      <div className="h-32 w-full bg-[#1A1A1A] skeleton-shimmer" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#1A1A1A] skeleton-shimmer" />
          <div className="h-4 w-28 rounded bg-[#1A1A1A] skeleton-shimmer" />
        </div>
        <div className="h-3 w-full rounded bg-[#1A1A1A] skeleton-shimmer" />
        <div className="h-3 w-2/3 rounded bg-[#1A1A1A] skeleton-shimmer" />
      </div>
    </div>
  );
}

function SkeletonStat() {
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 rounded bg-[#1A1A1A] skeleton-shimmer" />
        <div className="h-9 w-9 rounded-lg bg-[#1A1A1A] skeleton-shimmer" />
      </div>
      <div className="h-7 w-16 rounded bg-[#1A1A1A] skeleton-shimmer" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectFramework, setNewProjectFramework] = useState("react-vite");
  const [newProjectTemplate, setNewProjectTemplate] = useState("blank");
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<"template" | "details">("template");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
    const fetchProjects = async () => {
      try { const data = await api.listProjects(); setProjects(Array.isArray(data) ? data : []); }
      catch (err) { console.error("Failed to fetch projects:", err); }
      finally { setIsLoading(false); }
    };
    fetchProjects();
  }, [authLoading, isAuthenticated, router]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    try {
      const project = await api.createProject(newProjectName.trim(), newProjectFramework, undefined, newProjectTemplate !== "blank" ? newProjectTemplate : undefined);
      router.push(`/project/${project.id}`);
    } catch (err) { console.error("Failed to create project:", err); }
    finally { setIsCreating(false); }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu(null);
    if (!confirm("¿Estás seguro de que quieres eliminar este proyecto?")) return;
    try { await api.deleteProject(id); setProjects((prev) => prev.filter((p) => p.id !== id)); }
    catch (err) { console.error("Failed to delete project:", err); }
  };

  const handleSelectTemplate = (templateId: string) => {
    setNewProjectTemplate(templateId);
    if (templateId !== "blank") setNewProjectFramework("react-vite");
    setStep("details");
  };

  const openNewProjectModal = () => {
    setShowNewProject(true);
    setStep("template");
    setNewProjectName("");
    setNewProjectTemplate("blank");
    setNewProjectFramework("react-vite");
  };

  const handleForkProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContextMenu(null);
    try { const forked = await api.forkProject(projectId); router.push(`/project/${forked.id}`); }
    catch (err) { console.error("Fork failed:", err); }
  };

  const filteredProjects = useMemo(() => {
    let result = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
    }
    if (statusFilter !== "all") {
      result = result.filter((p) => {
        const s = p.status.toLowerCase();
        if (statusFilter === "active") return s === "active" || s === "building" || s === "deploying";
        if (statusFilter === "deployed") return s === "deployed";
        if (statusFilter === "draft") return s === "draft" || s === "created";
        return true;
      });
    }
    if (sortMode === "recent") result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    else result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }, [projects, searchQuery, statusFilter, sortMode]);

  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status.toLowerCase() === "active" || p.status.toLowerCase() === "building").length;
    const deployed = projects.filter((p) => p.status.toLowerCase() === "deployed").length;
    return { total, active, deployed };
  }, [projects]);

  const creditPercent = user?.creditsLimit ? Math.min(100, Math.round((user.creditsUsed / user.creditsLimit) * 100)) : 0;

  // Loading skeleton
  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-8">
            <div className="h-8 w-48 rounded-lg bg-[#1A1A1A] skeleton-shimmer mb-2" />
            <div className="h-4 w-64 rounded bg-[#1A1A1A] skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            <SkeletonStat /><SkeletonStat /><SkeletonStat />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        </div>
      </AppLayout>
    );
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Usuario";

  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  return (
    <AppLayout onNewProject={openNewProjectModal}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Page header — personalized greeting */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#EDEDED]">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-sm text-[#8888a0] mt-1 capitalize">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={openNewProjectModal}
              className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors shadow-lg shadow-[#7c3aed]/20"
            >
              <Plus className="h-4 w-4" />
              Nuevo Proyecto
            </button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Active projects */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-5 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#8888a0]">Proyectos activos</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7c3aed]/10">
                <Layers className="h-4 w-4 text-[#7c3aed]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#EDEDED]">{stats.active}</p>
            <p className="text-xs text-[#8888a0] mt-1">{stats.total} total</p>
          </div>

          {/* Credits used */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-5 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#8888a0]">Créditos usados</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f59e0b]/10">
                <CreditCard className="h-4 w-4 text-[#f59e0b]" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-2xl font-bold text-[#EDEDED]">{user?.creditsUsed ?? 0}</p>
              <span className="text-sm text-[#8888a0] mb-0.5">/ {user?.creditsLimit ?? 50}</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[#2A2A2A] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", creditPercent > 80 ? "bg-[#ef4444]" : creditPercent > 50 ? "bg-[#f59e0b]" : "bg-[#7c3aed]")}
                style={{ width: `${creditPercent}%` }}
              />
            </div>
          </div>

          {/* Deployments */}
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-5 transition-all hover:border-[#7c3aed]/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-[#8888a0]">Despliegues</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#22c55e]/10">
                <Cloud className="h-4 w-4 text-[#22c55e]" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#EDEDED]">{stats.deployed}</p>
            <p className="text-xs text-[#8888a0] mt-1">aplicaciones en línea</p>
          </div>
        </div>

        {/* Search / filter bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8888a0]/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar proyectos..."
                className="w-full rounded-lg border border-[#2A2A2A] bg-[#111111] py-2 pl-9 pr-4 text-sm text-[#EDEDED] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] transition-colors"
              />
            </div>

            <div className="flex items-center rounded-lg border border-[#2A2A2A] bg-[#111111] p-1">
              {([
                { value: "all", label: "Todos" },
                { value: "active", label: "Activos" },
                { value: "deployed", label: "Desplegados" },
                { value: "draft", label: "Borrador" },
              ] as const).map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    statusFilter === filter.value ? "bg-[#7c3aed]/10 text-[#7c3aed]" : "text-[#8888a0] hover:text-[#EDEDED]"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSortMode((m) => m === "recent" ? "alphabetical" : "recent")}
              className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#111111] px-3 py-2 text-xs font-medium text-[#8888a0] hover:text-[#EDEDED] transition-colors"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortMode === "recent" ? "Reciente" : "A-Z"}
            </button>

            <div className="flex items-center rounded-lg border border-[#2A2A2A] bg-[#111111] p-1">
              <button onClick={() => setViewMode("grid")} className={cn("rounded-md p-1.5 transition-colors", viewMode === "grid" ? "bg-[#7c3aed]/10 text-[#7c3aed]" : "text-[#8888a0] hover:text-[#EDEDED]")}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("rounded-md p-1.5 transition-colors", viewMode === "list" ? "bg-[#7c3aed]/10 text-[#7c3aed]" : "text-[#8888a0] hover:text-[#EDEDED]")}>
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* New Project Modal */}
        {showNewProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl rounded-xl border border-[#2A2A2A] bg-[#111111] p-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-fade-in">
              {step === "template" ? (
                <>
                  <h2 className="text-lg font-semibold text-[#EDEDED] mb-1">Elige una Plantilla</h2>
                  <p className="text-sm text-[#8888a0] mb-4">Comienza con una plantilla prediseñada o un proyecto en blanco</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                      <button
                        key={key}
                        onClick={() => handleSelectTemplate(key)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:border-[#7c3aed]/50 hover:bg-[#7c3aed]/5 hover:-translate-y-0.5",
                          newProjectTemplate === key ? "border-[#7c3aed] bg-[#7c3aed]/10" : "border-[#2A2A2A]"
                        )}
                      >
                        <div className="text-[#7c3aed]">{templateIcons[key] || <FileText className="h-5 w-5" />}</div>
                        <div className="text-sm font-medium text-[#EDEDED]">{tmpl.name}</div>
                        <div className="text-[11px] text-[#8888a0]">{tmpl.description}</div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button onClick={() => setShowNewProject(false)} className="rounded-lg px-4 py-2 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Cancelar</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setStep("template")} className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Plantillas</button>
                    <span className="text-[#8888a0]/50">/</span>
                    <span className="text-sm font-medium text-[#EDEDED]">{TEMPLATES[newProjectTemplate as keyof typeof TEMPLATES]?.name || "Nuevo Proyecto"}</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#EDEDED] mb-1.5">Nombre del Proyecto</label>
                      <input
                        type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)}
                        className="w-full rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-4 py-2.5 text-sm text-[#EDEDED] placeholder:text-[#8888a0]/50 outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]"
                        placeholder="Mi App Increíble" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#EDEDED] mb-2">Framework</label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(FRAMEWORKS).map(([key, fw]) => (
                          <button key={key} onClick={() => setNewProjectFramework(key)}
                            className={cn("flex items-center gap-3 rounded-lg border p-3 text-left transition-all", newProjectFramework === key ? "border-[#7c3aed] bg-[#7c3aed]/10" : "border-[#2A2A2A] hover:border-[#7c3aed]/50 hover:bg-[#1A1A1A]")}
                          >
                            <div className="text-[#7c3aed]">{frameworkIcons[key] || <Code2 className="h-4 w-4" />}</div>
                            <div>
                              <div className="text-sm font-medium text-[#EDEDED]">{fw.label}</div>
                              <div className="text-xs text-[#8888a0]">{fw.description}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button onClick={() => setShowNewProject(false)} className="rounded-lg px-4 py-2 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Cancelar</button>
                    <button onClick={handleCreateProject} disabled={!newProjectName.trim() || isCreating}
                      className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50 shadow-lg shadow-[#7c3aed]/20"
                    >
                      {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                      Crear Proyecto
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Projects content */}
        {filteredProjects.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#2A2A2A] py-20">
            <div className="mb-6">
              <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="20" y="15" width="80" height="60" rx="8" stroke="#2A2A2A" strokeWidth="2" />
                <rect x="20" y="15" width="80" height="12" rx="8" fill="#111111" />
                <circle cx="30" cy="21" r="2" fill="#ef4444" opacity="0.4" />
                <circle cx="37" cy="21" r="2" fill="#f59e0b" opacity="0.4" />
                <circle cx="44" cy="21" r="2" fill="#22c55e" opacity="0.4" />
                <rect x="35" y="40" width="50" height="4" rx="2" fill="#2A2A2A" />
                <rect x="42" y="48" width="36" height="3" rx="1.5" fill="#2A2A2A" opacity="0.5" />
                <rect x="47" y="58" width="26" height="8" rx="4" fill="#7c3aed" opacity="0.15" />
                <text x="60" y="64" textAnchor="middle" fill="#7c3aed" fontSize="5" opacity="0.5">Crear</text>
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[#EDEDED] mb-1">
              {projects.length === 0 ? "Aún no hay proyectos" : "No se encontraron proyectos"}
            </h3>
            <p className="text-sm text-[#8888a0] mb-6 max-w-[280px] text-center">
              {projects.length === 0 ? "Crea tu primer proyecto y deja que Arya lo construya por ti" : "Intenta ajustar tu búsqueda o filtros"}
            </p>
            {projects.length === 0 && (
              <button onClick={openNewProjectModal} className="flex items-center gap-2 rounded-lg bg-[#7c3aed] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors shadow-lg shadow-[#7c3aed]/20">
                <Plus className="h-4 w-4" /> Nuevo Proyecto
              </button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          /* Grid view */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => router.push(`/project/${project.id}`)}
                className="group relative cursor-pointer rounded-xl border border-[#2A2A2A] bg-[#111111] overflow-hidden transition-all duration-200 hover:border-[#7c3aed]/40 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#7c3aed]/5"
              >
                {/* Thumbnail */}
                {project.thumbnail ? (
                  <div className="h-36 w-full bg-[#0A0A0A] overflow-hidden">
                    <img src={project.thumbnail} alt={project.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                ) : (
                  <div className={cn("h-36 w-full bg-gradient-to-br flex items-center justify-center", frameworkColors[project.framework] || "from-[#7c3aed]/20 to-[#3b82f6]/20")}>
                    <div className="text-[#EDEDED]/20">{frameworkIcons[project.framework] || <Code2 className="h-10 w-10" />}</div>
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="rounded-lg bg-[#7c3aed]/10 p-1.5 text-[#7c3aed] shrink-0">
                        {frameworkIcons[project.framework] || <Code2 className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#EDEDED] truncate">{project.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-[#8888a0] rounded-full bg-[#1A1A1A] px-2 py-0.5">
                            {FRAMEWORKS[project.framework as keyof typeof FRAMEWORKS]?.label || project.framework}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Context menu trigger */}
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setContextMenu(contextMenu === project.id ? null : project.id); }}
                        className="rounded-md p-1 text-[#8888a0] opacity-0 group-hover:opacity-100 hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-all"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {contextMenu === project.id && (
                        <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-[#2A2A2A] bg-[#111111] py-1 shadow-xl animate-fade-in">
                          <button onClick={(e) => { e.stopPropagation(); router.push(`/project/${project.id}`); setContextMenu(null); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors">
                            <ExternalLink className="h-3.5 w-3.5" /> Abrir
                          </button>
                          <button onClick={(e) => handleForkProject(project.id, e)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors">
                            <Copy className="h-3.5 w-3.5" /> Duplicar
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setContextMenu(null); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors">
                            <Download className="h-3.5 w-3.5" /> Exportar
                          </button>
                          <div className="my-1 h-px bg-[#2A2A2A]" />
                          <button onClick={(e) => handleDeleteProject(project.id, e)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-xs text-[#8888a0] mb-3 line-clamp-2">{project.description}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-[#8888a0]/50" />
                      <span className="text-[11px] text-[#8888a0]">{formatDate(project.updatedAt)}</span>
                      {project.members && project.members.length > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-[#7c3aed]/10 px-1.5 py-0.5 text-[10px] text-[#7c3aed]">
                          <Users className="h-2.5 w-2.5" /> Shared
                        </span>
                      )}
                      {project.forkedFrom && (
                        <span className="flex items-center gap-1 rounded-full bg-[#f59e0b]/10 px-1.5 py-0.5 text-[10px] text-[#f59e0b]">
                          <GitFork className="h-2.5 w-2.5" /> Fork
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      project.status === "DEPLOYED" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                      project.status === "DEPLOYING" ? "bg-[#f59e0b]/10 text-[#f59e0b]" :
                      "bg-[#2A2A2A] text-[#8888a0]"
                    )}>
                      {project.status.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List view */
          <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] overflow-hidden">
            <div className="grid grid-cols-[1fr_140px_110px_140px_60px] items-center gap-4 border-b border-[#2A2A2A] px-5 py-3 text-xs font-medium text-[#8888a0]/60 uppercase tracking-wider">
              <span>Nombre</span><span>Framework</span><span>Estado</span><span>Actualizado</span><span className="text-right">Acciones</span>
            </div>
            {filteredProjects.map((project) => (
              <div key={project.id} onClick={() => router.push(`/project/${project.id}`)}
                className="group grid grid-cols-[1fr_140px_110px_140px_60px] items-center gap-4 border-b border-[#2A2A2A] last:border-b-0 px-5 py-3.5 cursor-pointer hover:bg-[#1A1A1A]/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-lg bg-[#7c3aed]/10 p-1.5 text-[#7c3aed] shrink-0">{frameworkIcons[project.framework] || <Code2 className="h-3.5 w-3.5" />}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#EDEDED] truncate">{project.name}</p>
                    {project.description && <p className="text-xs text-[#8888a0]/60 truncate">{project.description}</p>}
                  </div>
                </div>
                <span className="text-xs text-[#8888a0]">{FRAMEWORKS[project.framework as keyof typeof FRAMEWORKS]?.label || project.framework}</span>
                <span className={cn("inline-flex w-fit rounded-full px-2 py-0.5 text-xs", project.status === "DEPLOYED" ? "bg-[#22c55e]/10 text-[#22c55e]" : project.status === "DEPLOYING" ? "bg-[#f59e0b]/10 text-[#f59e0b]" : "bg-[#2A2A2A] text-[#8888a0]")}>
                  {project.status.toLowerCase()}
                </span>
                <span className="text-xs text-[#8888a0]/60">{formatDate(project.updatedAt)}</span>
                <div className="flex items-center justify-end gap-1">
                  {project.deployUrl && (
                    <a href={project.deployUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-1 text-[#8888a0] hover:text-[#7c3aed] transition-colors"><ExternalLink className="h-3.5 w-3.5" /></a>
                  )}
                  <button onClick={(e) => handleDeleteProject(project.id, e)} className="rounded p-1 text-[#8888a0] opacity-0 group-hover:opacity-100 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Click outside to close context menu */}
      {contextMenu && <div className="fixed inset-0 z-10" onClick={() => setContextMenu(null)} />}
    </AppLayout>
  );
}
