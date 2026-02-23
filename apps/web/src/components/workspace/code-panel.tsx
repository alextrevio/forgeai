"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  X,
  Terminal as TerminalIcon,
  Code2,
  FileJson,
  FileType,
  FileCog,
  Circle,
  FileCode2,
  History,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useProjectStore } from "@/stores/project-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { FileNode } from "@forgeai/shared";

// Dynamically import Monaco editor (no SSR)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-background">
      <span className="text-sm text-muted-foreground">Loading editor...</span>
    </div>
  ),
});

function getFileIcon(name: string) {
  if (name.endsWith(".tsx") || name.endsWith(".ts"))
    return <FileType className="h-3.5 w-3.5 text-blue-400" />;
  if (name.endsWith(".json"))
    return <FileJson className="h-3.5 w-3.5 text-yellow-400" />;
  if (name.endsWith(".css") || name.endsWith(".scss"))
    return <FileCog className="h-3.5 w-3.5 text-pink-400" />;
  if (name.endsWith(".js") || name.endsWith(".jsx"))
    return <FileType className="h-3.5 w-3.5 text-yellow-300" />;
  return <File className="h-3.5 w-3.5 text-muted-foreground" />;
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

// ─── File Tree Item ────────────────────────────────────────────
function FileTreeItem({
  node,
  depth,
  onSelect,
  changedFiles,
}: {
  node: FileNode;
  depth: number;
  onSelect: (path: string) => void;
  changedFiles: Set<string>;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === "directory";
  const isChanged = !isDir && changedFiles.has(node.path);

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) {
            setExpanded(!expanded);
          } else {
            onSelect(node.path);
          }
        }}
        className={cn(
          "flex w-full items-center gap-1.5 px-2 py-1 text-xs hover:bg-secondary/50 transition-colors",
          !isDir && "cursor-pointer",
          isChanged && "bg-primary/5"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-primary/70 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-primary/70 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            {getFileIcon(node.name)}
          </>
        )}
        <span className="truncate text-foreground">{node.name}</span>
        {isChanged && (
          <Circle className="h-2 w-2 fill-primary text-primary shrink-0 ml-auto" />
        )}
      </button>

      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              changedFiles={changedFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Code Panel Main Component ─────────────────────────────────
export function CodePanel() {
  const [activeTab, setActiveTab] = useState<"code" | "terminal">("code");
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const {
    currentProjectId,
    fileTree,
    openFiles,
    activeFilePath,
    terminalOutput,
    changedFiles,
    openFile,
    closeFile,
    setActiveFile,
    updateFileContent,
  } = useProjectStore();

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === "terminal") {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalOutput, activeTab]);

  const handleFileSelect = useCallback(
    async (path: string) => {
      if (!currentProjectId) return;

      // Check if already open
      const existing = openFiles.find((f) => f.path === path);
      if (existing) {
        setActiveFile(path);
        return;
      }

      try {
        const data = await api.readFile(currentProjectId, path);
        openFile(path, data.content);
      } catch (err) {
        console.error("Failed to read file:", err);
      }
    },
    [currentProjectId, openFiles, openFile, setActiveFile]
  );

  const activeFileContent =
    openFiles.find((f) => f.path === activeFilePath)?.content || "";

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeFilePath && value !== undefined) {
        updateFileContent(activeFilePath, value);
      }
    },
    [activeFilePath, updateFileContent]
  );

  // Save on Ctrl+S
  useEffect(() => {
    const handleSave = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (currentProjectId && activeFilePath) {
          const file = openFiles.find((f) => f.path === activeFilePath);
          if (file) {
            try {
              await api.writeFile(currentProjectId, activeFilePath, file.content);
            } catch (err) {
              console.error("Failed to save file:", err);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleSave);
    return () => window.removeEventListener("keydown", handleSave);
  }, [currentProjectId, activeFilePath, openFiles]);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Tab Bar: Code / Terminal */}
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setActiveTab("code")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2",
            activeTab === "code"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Code2 className="h-3.5 w-3.5" />
          Code
        </button>
        <button
          onClick={() => setActiveTab("terminal")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2",
            activeTab === "terminal"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <TerminalIcon className="h-3.5 w-3.5" />
          Terminal
          {terminalOutput.length > 0 && (
            <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">
              {terminalOutput.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === "code" ? (
        <PanelGroup direction="horizontal" className="flex-1">
          {/* File Tree */}
          <Panel defaultSize={30} minSize={15} maxSize={50}>
            <div className="h-full overflow-y-auto border-r border-border">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Files
              </div>
              {fileTree.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No files yet
                </div>
              ) : (
                fileTree.map((node) => (
                  <FileTreeItem
                    key={node.path}
                    node={node}
                    depth={0}
                    onSelect={handleFileSelect}
                    changedFiles={changedFiles}
                  />
                ))
              )}
            </div>
          </Panel>

          <PanelResizeHandle className="w-px bg-border hover:bg-primary/50 transition-colors" />

          {/* Editor */}
          <Panel defaultSize={70}>
            <div className="flex h-full flex-col">
              {/* Open File Tabs */}
              {openFiles.length > 0 && (
                <div className="flex items-center overflow-x-auto border-b border-border bg-muted/30">
                  {openFiles.map((file) => {
                    const fileName = file.path.split("/").pop() || file.path;
                    return (
                      <div
                        key={file.path}
                        className={cn(
                          "flex items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs cursor-pointer",
                          file.path === activeFilePath
                            ? "bg-card text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                        )}
                        onClick={() => setActiveFile(file.path)}
                      >
                        {getFileIcon(fileName)}
                        <span className="max-w-[120px] truncate">{fileName}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeFile(file.path);
                          }}
                          className="ml-1 rounded p-0.5 hover:bg-secondary transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Monaco Editor */}
              <div className="flex-1">
                {activeFilePath ? (
                  <MonacoEditor
                    height="100%"
                    language={getLanguage(activeFilePath)}
                    value={activeFileContent}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                      minimap: { enabled: false },
                      lineNumbers: "on",
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                      wordWrap: "on",
                      padding: { top: 8, bottom: 8 },
                      renderLineHighlight: "all",
                      cursorBlinking: "smooth",
                      smoothScrolling: true,
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <Code2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-xs text-muted-foreground">
                        Select a file to edit
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      ) : (
        /* Terminal Output */
        <div className="flex-1 overflow-y-auto bg-[#1a1b26] p-3 font-mono text-xs">
          {terminalOutput.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-gray-500">No terminal output yet</p>
            </div>
          ) : (
            <>
              {terminalOutput.map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    "py-0.5 whitespace-pre-wrap break-all leading-relaxed",
                    line.startsWith("$")
                      ? "text-green-400 font-medium"
                      : line.toLowerCase().includes("error") || line.toLowerCase().includes("fail")
                        ? "text-red-400"
                        : line.toLowerCase().includes("warn")
                          ? "text-yellow-400"
                          : line.toLowerCase().includes("success") || line.toLowerCase().includes("done") || line.toLowerCase().includes("ready")
                            ? "text-green-300"
                            : line.includes("http://") || line.includes("https://")
                              ? "text-blue-400"
                              : "text-gray-300"
                  )}
                >
                  {line}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
