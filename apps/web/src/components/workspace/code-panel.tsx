"use client";

import { useState, useCallback, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  X,
  Code2,
  FileJson,
  FileType,
  FileCog,
  Circle,
  FileCode2,
  Hash,
  Image,
  FileText,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useProjectStore } from "@/stores/project-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FileNode } from "@forgeai/shared";

function safeArray<T>(data: T[]): T[];
function safeArray<T>(data: T[] | null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#0A0A0A]">
      <span className="text-xs text-[#8888a0]">Cargando editor...</span>
    </div>
  ),
});

function getFileIcon(name: string) {
  if (name.endsWith(".tsx")) return <FileCode2 className="h-3.5 w-3.5 text-[#60a5fa]" />;
  if (name.endsWith(".ts")) return <FileType className="h-3.5 w-3.5 text-[#3b82f6]" />;
  if (name.endsWith(".json")) return <FileJson className="h-3.5 w-3.5 text-[#4ade80]" />;
  if (name.endsWith(".css") || name.endsWith(".scss")) return <Hash className="h-3.5 w-3.5 text-[#a78bfa]" />;
  if (name.endsWith(".js") || name.endsWith(".jsx")) return <FileType className="h-3.5 w-3.5 text-[#fbbf24]" />;
  if (name.endsWith(".md")) return <FileText className="h-3.5 w-3.5 text-[#8888a0]" />;
  if (name.endsWith(".svg") || name.endsWith(".png") || name.endsWith(".jpg")) return <Image className="h-3.5 w-3.5 text-[#f472b6]" />;
  if (name.endsWith(".html")) return <FileCog className="h-3.5 w-3.5 text-[#fb923c]" />;
  return <File className="h-3.5 w-3.5 text-[#8888a0]/60" />;
}

function getLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".py")) return "python";
  return "plaintext";
}

function FileTreeItem({ node, depth, onSelect, activeFilePath, changedFiles }: {
  node: FileNode; depth: number; onSelect: (path: string) => void; activeFilePath: string | null; changedFiles: Set<string>;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === "directory";
  const isChanged = !isDir && changedFiles.has(node.path);
  const isActive = !isDir && node.path === activeFilePath;

  return (
    <div>
      <button
        onClick={() => { if (isDir) setExpanded(!expanded); else onSelect(node.path); }}
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-[4px] text-[11px] transition-all duration-100 group",
          !isDir && "cursor-pointer",
          isActive ? "bg-[#7c3aed]/10 text-[#EDEDED]" : "hover:bg-[#161619] text-[#EDEDED]/80",
          isChanged && !isActive && "bg-[#7c3aed]/5"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            <ChevronRight className={cn(
              "h-3 w-3 text-[#8888a0]/60 shrink-0 transition-transform duration-200",
              expanded && "rotate-90"
            )} />
            {expanded
              ? <FolderOpen className="h-3.5 w-3.5 text-[#a78bfa]/70 shrink-0" />
              : <Folder className="h-3.5 w-3.5 text-[#a78bfa]/70 shrink-0" />}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            {getFileIcon(node.name)}
          </>
        )}
        <span className="truncate">{node.name}</span>
        {isDir && node.name === "uploads" && (
          <span className="ml-auto shrink-0 rounded px-1 py-0 text-[9px] font-medium bg-[#7c3aed]/15 text-[#a78bfa]">uploaded</span>
        )}
        {isChanged && (
          <Circle className="h-1.5 w-1.5 fill-[#7c3aed] text-[#7c3aed] shrink-0 ml-auto" />
        )}
      </button>
      {isDir && expanded && safeArray(node.children).length > 0 && (
        <div>
          {safeArray(node.children).map((child) => (
            <FileTreeItem key={child.path} node={child} depth={depth + 1} onSelect={onSelect} activeFilePath={activeFilePath} changedFiles={changedFiles} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CodePanel() {
  const {
    currentProjectId, fileTree, openFiles, activeFilePath, changedFiles,
    openFile, closeFile, setActiveFile, updateFileContent,
  } = useProjectStore();

  const handleFileSelect = useCallback(async (path: string) => {
    if (!currentProjectId) return;
    const existing = safeArray(openFiles).find((f) => f.path === path);
    if (existing) { setActiveFile(path); return; }
    try { const data = await api.readFile(currentProjectId, path); openFile(path, data.content); } catch (err) { console.error("Failed to read file:", err); }
  }, [currentProjectId, openFiles, openFile, setActiveFile]);

  const activeFileContent = safeArray(openFiles).find((f) => f.path === activeFilePath)?.content || "";

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (activeFilePath && value !== undefined) updateFileContent(activeFilePath, value);
  }, [activeFilePath, updateFileContent]);

  useEffect(() => {
    const handleSave = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (currentProjectId && activeFilePath) {
          const file = safeArray(openFiles).find((f) => f.path === activeFilePath);
          if (file) { try { await api.writeFile(currentProjectId, activeFilePath, file.content); } catch (err) { console.error("Failed to save:", err); } }
        }
      }
    };
    window.addEventListener("keydown", handleSave);
    return () => window.removeEventListener("keydown", handleSave);
  }, [currentProjectId, activeFilePath, openFiles]);

  // Breadcrumb segments
  const breadcrumb = activeFilePath ? activeFilePath.split("/").filter(Boolean) : [];

  return (
    <div className="flex h-full flex-col bg-[#0A0A0A]">
      {/* Breadcrumb */}
      {activeFilePath && (
        <div className="flex items-center gap-1 border-b border-[#2A2A2A] px-3 py-1.5 bg-[#0A0A0A]">
          {breadcrumb.map((part, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-[#8888a0]/30" />}
              <span className={cn(
                "text-[11px]",
                i === breadcrumb.length - 1 ? "text-[#EDEDED] font-medium" : "text-[#8888a0]"
              )}>{part}</span>
            </span>
          ))}
        </div>
      )}

      <PanelGroup direction="horizontal" className="flex-1">
        {/* File Tree */}
        <Panel defaultSize={28} minSize={15} maxSize={45}>
          <div className="h-full overflow-y-auto border-r border-[#2A2A2A] bg-[#0A0A0A]">
            <div className="px-3 py-2 text-[10px] font-semibold text-[#8888a0]/60 uppercase tracking-widest">Explorer</div>
            {safeArray(fileTree).length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-[#8888a0]/40 text-center">No hay archivos</div>
            ) : (
              safeArray(fileTree).map((node) => (
                <FileTreeItem key={node.path} node={node} depth={0} onSelect={handleFileSelect} activeFilePath={activeFilePath} changedFiles={changedFiles} />
              ))
            )}
          </div>
        </Panel>

        <PanelResizeHandle className="w-[1px] bg-[#2A2A2A] hover:bg-[#7c3aed]/50 transition-colors" />

        {/* Editor */}
        <Panel defaultSize={72}>
          <div className="flex h-full flex-col">
            {/* Open file tabs */}
            {safeArray(openFiles).length > 0 && (
              <div className="flex items-center overflow-x-auto border-b border-[#2A2A2A] bg-[#0A0A0A]">
                {safeArray(openFiles).map((file) => {
                  const fileName = file.path.split("/").pop() || file.path;
                  const isActive = file.path === activeFilePath;
                  return (
                    <div
                      key={file.path}
                      className={cn(
                        "group flex items-center gap-1.5 border-r border-[#2A2A2A] px-3 py-1.5 text-[11px] cursor-pointer transition-all duration-100",
                        isActive
                          ? "bg-[#111114] text-[#EDEDED]"
                          : "text-[#8888a0] hover:text-[#EDEDED] hover:bg-[#111114]/50"
                      )}
                      onClick={() => setActiveFile(file.path)}
                    >
                      {getFileIcon(fileName)}
                      <span className="max-w-[120px] truncate">{fileName}</span>
                      {changedFiles.has(file.path) && (
                        <Circle className="h-1.5 w-1.5 fill-[#7c3aed] text-[#7c3aed] shrink-0" />
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); closeFile(file.path); }}
                        className="ml-1 rounded p-0.5 hover:bg-[#161619] transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex-1">
              {activeFilePath ? (
                <MonacoEditor
                  height="100%"
                  language={getLanguage(activeFilePath)}
                  value={activeFileContent}
                  onChange={handleEditorChange}
                  theme="vs-dark"
                  options={{
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                    fontLigatures: true,
                    minimap: { enabled: true },
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: "on",
                    padding: { top: 8, bottom: 8 },
                    renderLineHighlight: "all",
                    cursorBlinking: "smooth",
                    smoothScrolling: true,
                    lineHeight: 1.6,
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-[#0A0A0A]">
                  <div className="text-center">
                    <Code2 className="h-8 w-8 text-[#8888a0]/20 mx-auto mb-3" />
                    <p className="text-[11px] text-[#8888a0]/40">Selecciona un archivo para editar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
