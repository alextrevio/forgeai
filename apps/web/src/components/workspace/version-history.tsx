"use client";

import { useState, useEffect, useCallback } from "react";
import {
  History,
  RotateCcw,
  Camera,
  Loader2,
  FileCode2,
  Package,
  ChevronDown,
  ChevronRight,
  Bot,
  Save,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface VersionItem {
  id: string;
  version: number;
  label: string | null;
  description: string | null;
  fileCount: number;
  totalSize: number;
  trigger: string;
  createdAt: string;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Justo ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TRIGGER_CONFIG: Record<string, { icon: React.ReactNode; label: string; colorClass: string }> = {
  engine_complete: {
    icon: <Bot className="h-3 w-3" />,
    label: "Engine",
    colorClass: "bg-[#7c3aed]/10 text-[#a78bfa]",
  },
  manual: {
    icon: <Camera className="h-3 w-3" />,
    label: "Manual",
    colorClass: "bg-[#3b82f6]/10 text-[#60a5fa]",
  },
  auto_save: {
    icon: <Save className="h-3 w-3" />,
    label: "Auto-save",
    colorClass: "bg-[#f59e0b]/10 text-[#fbbf24]",
  },
};

export function VersionHistory({ projectId }: { projectId: string | null }) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<string[] | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await api.getVersions(projectId);
      setVersions(data.versions || []);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleCreateSnapshot = async () => {
    if (!projectId || creating) return;
    setCreating(true);
    try {
      await api.createManualVersion(projectId);
      await fetchVersions();
    } catch {
      /* ignore */
    }
    setCreating(false);
  };

  const handleRestore = async (versionId: string) => {
    if (!projectId || restoringId) return;
    setRestoringId(versionId);
    setConfirmRestoreId(null);
    try {
      await api.restoreVersion(projectId, versionId);
      await fetchVersions();
    } catch {
      /* ignore */
    }
    setRestoringId(null);
  };

  const handleExpand = async (versionId: string) => {
    if (expandedId === versionId) {
      setExpandedId(null);
      setExpandedFiles(null);
      return;
    }
    setExpandedId(versionId);
    setExpandedFiles(null);
    setLoadingFiles(true);
    try {
      const data = await api.getVersion(projectId!, versionId);
      const files = data.version?.files;
      if (files && typeof files === "object") {
        setExpandedFiles(Object.keys(files).sort());
      }
    } catch {
      /* ignore */
    }
    setLoadingFiles(false);
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#555555]">
        No hay proyecto seleccionado
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#7c3aed]" />
          <span className="text-sm font-medium text-[#EDEDED]">
            Historial de versiones
          </span>
          {versions.length > 0 && (
            <span className="rounded-full bg-[#7c3aed]/10 px-2 py-0.5 text-[10px] text-[#a78bfa]">
              {versions.length}
            </span>
          )}
        </div>
        <button
          onClick={handleCreateSnapshot}
          disabled={creating}
          className="flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#8888a0] hover:border-[#7c3aed]/50 hover:text-[#EDEDED] transition-colors disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Camera className="h-3 w-3" />
          )}
          Snapshot
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#7c3aed]" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <History className="h-8 w-8 text-[#555555] mb-3" />
            <p className="text-sm text-[#8888a0] mb-1">
              No hay versiones aún
            </p>
            <p className="text-xs text-[#555555]">
              Las versiones se crean automáticamente cuando el engine completa,
              o puedes crear snapshots manuales.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {versions.map((v, idx) => {
              const triggerCfg =
                TRIGGER_CONFIG[v.trigger] || TRIGGER_CONFIG.manual;
              const isExpanded = expandedId === v.id;
              const isLatest = idx === 0;

              return (
                <div
                  key={v.id}
                  className={cn(
                    "rounded-xl border bg-[#111111] overflow-hidden transition-colors",
                    isLatest
                      ? "border-[#7c3aed]/30"
                      : "border-[#1E1E1E]"
                  )}
                >
                  {/* Version header */}
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-[#EDEDED]">
                          v{v.version}
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                            triggerCfg.colorClass
                          )}
                        >
                          {triggerCfg.icon}
                          {triggerCfg.label}
                        </span>
                        {isLatest && (
                          <span className="rounded-full bg-[#22c55e]/10 px-2 py-0.5 text-[10px] text-[#4ade80]">
                            Actual
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#555555]">
                        {formatTimeAgo(v.createdAt)}
                      </span>
                    </div>

                    {v.label && (
                      <p className="text-sm text-[#EDEDED] mb-1">
                        {v.label}
                      </p>
                    )}
                    {v.description && (
                      <p className="text-xs text-[#8888a0] mb-2">
                        {v.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[11px] text-[#555555]">
                        <span className="flex items-center gap-1">
                          <FileCode2 className="h-3 w-3" />
                          {v.fileCount} archivos
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {formatSize(v.totalSize)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Expand files */}
                        <button
                          onClick={() => handleExpand(v.id)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED] transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          Archivos
                        </button>

                        {/* Restore button */}
                        {!isLatest && (
                          <>
                            {confirmRestoreId === v.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleRestore(v.id)}
                                  disabled={!!restoringId}
                                  className="rounded-md bg-[#7c3aed] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#6d28d9] transition-colors disabled:opacity-50"
                                >
                                  {restoringId === v.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Confirmar"
                                  )}
                                </button>
                                <button
                                  onClick={() => setConfirmRestoreId(null)}
                                  className="rounded-md px-2 py-1 text-[11px] text-[#8888a0] hover:text-[#EDEDED] transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmRestoreId(v.id)}
                                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED] transition-colors"
                                title="Restaurar esta versión"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Restaurar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded file list */}
                  {isExpanded && (
                    <div className="border-t border-[#1E1E1E] bg-[#0A0A0A] px-4 py-2 max-h-[200px] overflow-y-auto">
                      {loadingFiles ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-[#555555]" />
                        </div>
                      ) : expandedFiles ? (
                        <div className="space-y-0.5">
                          {expandedFiles.map((f) => (
                            <div
                              key={f}
                              className="flex items-center gap-2 py-1 text-[11px] text-[#8888a0]"
                            >
                              <FileCode2 className="h-3 w-3 text-[#555555] shrink-0" />
                              <span className="truncate">{f}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#555555] py-2">
                          No se pudieron cargar los archivos
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
