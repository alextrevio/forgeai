"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Plus,
  FolderOpen,
  Trash2,
  ExternalLink,
  LogOut,
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
  Crown,
  Search,
  Settings,
  Home,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  ArrowUpDown,
  Activity,
  Cloud,
  Layers,
  GitFork,
  Users,
  Bell,
} from "lucide-react";
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

const templateIcons: Record<string, React.ReactNode> = {
  blank: <FileText className="h-5 w-5" />,
  landing: <Globe className="h-5 w-5" />,
  dashboard: <BarChart3 className="h-5 w-5" />,
  saas: <Rocket className="h-5 w-5" />,
  blog: <BookOpen className="h-5 w-5" />,
  ecommerce: <ShoppingCart className="h-5 w-5" />,
};

const planColors: Record<string, string> = {
  FREE: "bg-[#1e1e3a] text-gray-300",
  PRO: "bg-[#6d5cff]/10 text-[#6d5cff]",
  BUSINESS: "bg-[#f59e0b]/10 text-[#f59e0b]",
  ENTERPRISE: "bg-[#22c55e]/10 text-[#22c55e]",
};

type StatusFilter = "all" | "active" | "deployed" | "draft";
type SortMode = "recent" | "alphabetical";
type ViewMode = "grid" | "list";

const NAV_ITEMS = [
  { id: "projects", label: "Projects", icon: Home, href: "/dashboard" },
  { id: "usage", label: "Usage", icon: BarChart3, href: "/dashboard/usage" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser, logout } =
    useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectFramework, setNewProjectFramework] = useState("react-vite");
  const [newProjectTemplate, setNewProjectTemplate] = useState("blank");
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState<"template" | "details">("template");

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState("projects");

  // Search / filter / sort / view state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    const fetchProjects = async () => {
      try {
        const data = await api.listProjects();
        setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch projects:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProjects();
  }, [authLoading, isAuthenticated, router]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreating(true);

    try {
      const project = await api.createProject(
        newProjectName.trim(),
        newProjectFramework,
        undefined,
        newProjectTemplate !== "blank" ? newProjectTemplate : undefined
      );
      router.push(`/project/${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const handleSelectTemplate = (templateId: string) => {
    setNewProjectTemplate(templateId);
    if (templateId !== "blank") {
      setNewProjectFramework("react-vite");
    }
    setStep("details");
  };

  const openNewProjectModal = () => {
    setShowNewProject(true);
    setStep("template");
    setNewProjectName("");
    setNewProjectTemplate("blank");
    setNewProjectFramework("react-vite");
  };

  // Filtered and sorted projects
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => {
        const s = p.status.toLowerCase();
        if (statusFilter === "active") return s === "active" || s === "building" || s === "deploying";
        if (statusFilter === "deployed") return s === "deployed";
        if (statusFilter === "draft") return s === "draft" || s === "created";
        return true;
      });
    }

    // Sort
    if (sortMode === "recent") {
      result.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [projects, searchQuery, statusFilter, sortMode]);

  // Stats
  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(
      (p) =>
        p.status.toLowerCase() === "active" ||
        p.status.toLowerCase() === "building"
    ).length;
    const deployed = projects.filter(
      (p) => p.status.toLowerCase() === "deployed"
    ).length;
    return { total, active, deployed };
  }, [projects]);

  const creditPercent = user?.creditsLimit
    ? Math.min(100, Math.round((user.creditsUsed / user.creditsLimit) * 100))
    : 0;

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6d5cff]" />
      </div>
    );
  }

  const handleNavClick = (item: (typeof NAV_ITEMS)[number]) => {
    setActiveNav(item.id);
    if (item.id !== "projects") {
      router.push(item.href);
    }
  };

  const handleForkProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const forked = await api.forkProject(projectId);
      router.push(`/project/${forked.id}`);
    } catch (err) {
      console.error("Fork failed:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[#27274a] bg-[#131320] transition-all duration-300",
          sidebarCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-[#27274a] px-4">
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
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-[#6d5cff]/10 text-[#6d5cff]"
                    : "text-gray-400 hover:bg-[#1e1e3a] hover:text-white"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}

          {/* Separator */}
          <div className="my-3 h-px bg-[#27274a]" />

          {/* Logout */}
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-400 hover:bg-[#1e1e3a] hover:text-white transition-colors"
            title={sidebarCollapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed((c) => !c)}
          className="mx-3 mb-3 flex items-center justify-center rounded-lg border border-[#27274a] py-2 text-gray-400 hover:bg-[#1e1e3a] hover:text-white transition-colors"
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
            "border-t border-[#27274a] p-4",
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
        <div className="mx-auto max-w-7xl px-6 py-8">
          {/* Page header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white">Projects</h1>
              <p className="text-sm text-gray-400 mt-1">
                Build and manage your AI-generated applications
              </p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <button
                onClick={openNewProjectModal}
                className="flex items-center gap-2 rounded-lg bg-[#6d5cff] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#6d5cff]/90 transition-colors shadow-lg shadow-[#6d5cff]/20"
              >
                <Plus className="h-4 w-4" />
                New Project
              </button>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {/* Total projects */}
            <div className="rounded-xl border border-[#27274a] bg-[#131320] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Total Projects</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6d5cff]/10">
                  <Layers className="h-4 w-4 text-[#6d5cff]" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>

            {/* Active sandboxes */}
            <div className="rounded-xl border border-[#27274a] bg-[#131320] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Active Sandboxes</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#22c55e]/10">
                  <Activity className="h-4 w-4 text-[#22c55e]" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
            </div>

            {/* Credits used */}
            <div className="rounded-xl border border-[#27274a] bg-[#131320] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Credits Used</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f59e0b]/10">
                  <CreditCard className="h-4 w-4 text-[#f59e0b]" />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-bold text-white">
                  {user?.creditsUsed ?? 0}
                </p>
                <span className="text-sm text-gray-400 mb-0.5">
                  / {user?.creditsLimit ?? 50}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[#1e1e3a] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    creditPercent > 80
                      ? "bg-[#ef4444]"
                      : creditPercent > 50
                        ? "bg-[#f59e0b]"
                        : "bg-[#6d5cff]"
                  )}
                  style={{ width: `${creditPercent}%` }}
                />
              </div>
            </div>

            {/* Deployments */}
            <div className="rounded-xl border border-[#27274a] bg-[#131320] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400">Deployments</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#6d5cff]/10">
                  <Cloud className="h-4 w-4 text-[#6d5cff]" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stats.deployed}</p>
            </div>
          </div>

          {/* Search / filter bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            {/* Left: search + status filters */}
            <div className="flex flex-1 items-center gap-3">
              {/* Search input */}
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full rounded-lg border border-[#27274a] bg-[#131320] py-2 pl-9 pr-4 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#6d5cff] focus:ring-1 focus:ring-[#6d5cff] transition-colors"
                />
              </div>

              {/* Status filter buttons */}
              <div className="flex items-center rounded-lg border border-[#27274a] bg-[#131320] p-1">
                {(
                  [
                    { value: "all", label: "All" },
                    { value: "active", label: "Active" },
                    { value: "deployed", label: "Deployed" },
                    { value: "draft", label: "Draft" },
                  ] as const
                ).map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setStatusFilter(filter.value)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      statusFilter === filter.value
                        ? "bg-[#6d5cff]/10 text-[#6d5cff]"
                        : "text-gray-400 hover:text-white"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: sort + view toggle */}
            <div className="flex items-center gap-3">
              {/* Sort toggle */}
              <button
                onClick={() =>
                  setSortMode((m) =>
                    m === "recent" ? "alphabetical" : "recent"
                  )
                }
                className="flex items-center gap-2 rounded-lg border border-[#27274a] bg-[#131320] px-3 py-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                title={
                  sortMode === "recent"
                    ? "Sorted by recent"
                    : "Sorted alphabetically"
                }
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {sortMode === "recent" ? "Recent" : "A-Z"}
              </button>

              {/* View mode toggle */}
              <div className="flex items-center rounded-lg border border-[#27274a] bg-[#131320] p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "grid"
                      ? "bg-[#6d5cff]/10 text-[#6d5cff]"
                      : "text-gray-400 hover:text-white"
                  )}
                  title="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "rounded-md p-1.5 transition-colors",
                    viewMode === "list"
                      ? "bg-[#6d5cff]/10 text-[#6d5cff]"
                      : "text-gray-400 hover:text-white"
                  )}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* New Project Modal */}
          {showNewProject && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-2xl rounded-xl border border-[#27274a] bg-[#131320] p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
                {step === "template" ? (
                  <>
                    <h2 className="text-lg font-semibold text-white mb-1">
                      Choose a Template
                    </h2>
                    <p className="text-sm text-gray-400 mb-4">
                      Start with a pre-built template or a blank project
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                        <button
                          key={key}
                          onClick={() => handleSelectTemplate(key)}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all hover:border-[#6d5cff]/50 hover:bg-[#6d5cff]/5",
                            newProjectTemplate === key
                              ? "border-[#6d5cff] bg-[#6d5cff]/10"
                              : "border-[#27274a]"
                          )}
                        >
                          <div className="text-[#6d5cff]">
                            {templateIcons[key] || (
                              <FileText className="h-5 w-5" />
                            )}
                          </div>
                          <div className="text-sm font-medium text-white">
                            {tmpl.name}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {tmpl.description}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setShowNewProject(false)}
                        className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setStep("template")}
                        className="text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Templates
                      </button>
                      <span className="text-gray-500">/</span>
                      <span className="text-sm font-medium text-white">
                        {TEMPLATES[
                          newProjectTemplate as keyof typeof TEMPLATES
                        ]?.name || "New Project"}
                      </span>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-1.5">
                          Project Name
                        </label>
                        <input
                          type="text"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          className="w-full rounded-lg border border-[#27274a] bg-[#0a0a0f] px-4 py-2.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#6d5cff] focus:ring-1 focus:ring-[#6d5cff]"
                          placeholder="My Awesome App"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateProject();
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Framework
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(FRAMEWORKS).map(([key, fw]) => (
                            <button
                              key={key}
                              onClick={() => setNewProjectFramework(key)}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                                newProjectFramework === key
                                  ? "border-[#6d5cff] bg-[#6d5cff]/10"
                                  : "border-[#27274a] hover:border-[#6d5cff]/50 hover:bg-[#1e1e3a]/30"
                              )}
                            >
                              <div className="text-[#6d5cff]">
                                {frameworkIcons[key] || (
                                  <Code2 className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">
                                  {fw.label}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {fw.description}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-3">
                      <button
                        onClick={() => setShowNewProject(false)}
                        className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateProject}
                        disabled={!newProjectName.trim() || isCreating}
                        className="flex items-center gap-2 rounded-lg bg-[#6d5cff] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d5cff]/90 transition-colors disabled:opacity-50"
                      >
                        {isCreating && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Create Project
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Projects content */}
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#27274a] py-16">
              <FolderOpen className="h-12 w-12 text-gray-600 mb-4" />
              <h3 className="text-sm font-medium text-white mb-1">
                {projects.length === 0
                  ? "No projects yet"
                  : "No matching projects"}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                {projects.length === 0
                  ? "Create your first project to get started"
                  : "Try adjusting your search or filters"}
              </p>
              {projects.length === 0 && (
                <button
                  onClick={openNewProjectModal}
                  className="flex items-center gap-2 rounded-lg bg-[#6d5cff] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d5cff]/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  New Project
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
                  className="group relative cursor-pointer rounded-xl border border-[#27274a] bg-[#131320] overflow-hidden hover:border-[#6d5cff]/50 hover:bg-[#131320]/80 transition-all"
                >
                  {/* Thumbnail */}
                  {project.thumbnail ? (
                    <div className="h-32 w-full bg-[#0a0a0f] overflow-hidden">
                      <img src={project.thumbnail} alt={project.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-32 w-full bg-gradient-to-br from-[#1e1e3a] to-[#0a0a0f] flex items-center justify-center">
                      <div className="text-[#6d5cff]/30">
                        {frameworkIcons[project.framework] || <Code2 className="h-8 w-8" />}
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="rounded-lg bg-[#6d5cff]/10 p-1.5 text-[#6d5cff] shrink-0">
                          {frameworkIcons[project.framework] || (
                            <Code2 className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {project.name}
                          </h3>
                          <span className="text-xs text-gray-400">
                            {FRAMEWORKS[
                              project.framework as keyof typeof FRAMEWORKS
                            ]?.label || project.framework}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                          onClick={(e) => handleForkProject(project.id, e)}
                          className="rounded p-1 text-gray-400 hover:text-[#6d5cff] hover:bg-[#6d5cff]/10 transition-all"
                          title="Fork project"
                        >
                          <GitFork className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteProject(project.id, e)}
                          className="rounded p-1 text-gray-400 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
                          title="Delete project"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-xs text-gray-400 mb-2 line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {formatDate(project.updatedAt)}
                        </span>
                        {/* Shared badge */}
                        {project.members && project.members.length > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-[#6d5cff]/10 px-1.5 py-0.5 text-[10px] text-[#6d5cff]">
                            <Users className="h-2.5 w-2.5" />
                            Shared
                          </span>
                        )}
                        {/* Forked badge */}
                        {project.forkedFrom && (
                          <span className="flex items-center gap-1 rounded-full bg-[#f59e0b]/10 px-1.5 py-0.5 text-[10px] text-[#f59e0b]">
                            <GitFork className="h-2.5 w-2.5" />
                            Fork
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {project.deployUrl && (
                          <a
                            href={project.deployUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs text-[#6d5cff] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Live
                          </a>
                        )}
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            project.status === "DEPLOYED"
                              ? "bg-[#22c55e]/10 text-[#22c55e]"
                              : project.status === "DEPLOYING"
                                ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                                : "bg-[#1e1e3a] text-gray-400"
                          )}
                        >
                          {project.status.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List view */
            <div className="rounded-xl border border-[#27274a] bg-[#131320] overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_140px_110px_140px_60px] items-center gap-4 border-b border-[#27274a] px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span>Name</span>
                <span>Framework</span>
                <span>Status</span>
                <span>Last Updated</span>
                <span className="text-right">Actions</span>
              </div>

              {/* Table rows */}
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="group grid grid-cols-[1fr_140px_110px_140px_60px] items-center gap-4 border-b border-[#27274a] last:border-b-0 px-5 py-3.5 cursor-pointer hover:bg-[#1e1e3a]/30 transition-colors"
                >
                  {/* Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-lg bg-[#6d5cff]/10 p-1.5 text-[#6d5cff] shrink-0">
                      {frameworkIcons[project.framework] || (
                        <Code2 className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {project.name}
                      </p>
                      {project.description && (
                        <p className="text-xs text-gray-500 truncate">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Framework */}
                  <span className="text-xs text-gray-400">
                    {FRAMEWORKS[
                      project.framework as keyof typeof FRAMEWORKS
                    ]?.label || project.framework}
                  </span>

                  {/* Status */}
                  <span
                    className={cn(
                      "inline-flex w-fit rounded-full px-2 py-0.5 text-xs",
                      project.status === "DEPLOYED"
                        ? "bg-[#22c55e]/10 text-[#22c55e]"
                        : project.status === "DEPLOYING"
                          ? "bg-[#f59e0b]/10 text-[#f59e0b]"
                          : "bg-[#1e1e3a] text-gray-400"
                    )}
                  >
                    {project.status.toLowerCase()}
                  </span>

                  {/* Last updated */}
                  <span className="text-xs text-gray-500">
                    {formatDate(project.updatedAt)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    {project.deployUrl && (
                      <a
                        href={project.deployUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="rounded p-1 text-gray-400 hover:text-[#6d5cff] transition-colors"
                        title="View deployment"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="rounded p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
