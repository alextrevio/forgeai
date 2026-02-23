"use client";

import { useState, useEffect, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { WorkspaceHeader } from "./workspace-header";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel } from "./preview-panel";
import { CodePanel } from "./code-panel";
import {
  Keyboard,
  X,
  MessageSquare,
  FolderTree,
  Search,
  Settings,
  History,
  Zap,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

type DevicePreviewMode = "desktop" | "tablet" | "mobile";
const DEVICE_CYCLE: DevicePreviewMode[] = ["desktop", "tablet", "mobile"];

type SidebarTab = "chat" | "files" | "search" | "settings" | "history";

const SIDEBAR_ITEMS: { id: SidebarTab; icon: React.ReactNode; label: string }[] = [
  { id: "chat", icon: <MessageSquare className="h-[18px] w-[18px]" />, label: "Chat" },
  { id: "files", icon: <FolderTree className="h-[18px] w-[18px]" />, label: "Files" },
  { id: "search", icon: <Search className="h-[18px] w-[18px]" />, label: "Search" },
  { id: "history", icon: <History className="h-[18px] w-[18px]" />, label: "History" },
  { id: "settings", icon: <Settings className="h-[18px] w-[18px]" />, label: "Settings" },
];

const SHORTCUTS = [
  { keys: ["Ctrl", "B"], description: "Toggle chat panel" },
  { keys: ["Ctrl", "J"], description: "Toggle code panel" },
  { keys: ["Ctrl", "Shift", "D"], description: "Cycle preview device mode" },
];

export function WorkspaceLayout() {
  const [showChat, setShowChat] = useState(true);
  const [showCode, setShowCode] = useState(true);
  const [previewDevice, setPreviewDevice] = useState<DevicePreviewMode>("desktop");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isVertical, setIsVertical] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("chat");
  const { user, logout } = useAuthStore();

  useEffect(() => {
    const checkWidth = () => setIsVertical(window.innerWidth < 1024);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      setShowChat((prev) => !prev);
      return;
    }
    if (mod && !e.shiftKey && e.key.toLowerCase() === "j") {
      e.preventDefault();
      setShowCode((prev) => !prev);
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === "d") {
      e.preventDefault();
      setPreviewDevice((prev) => {
        const idx = DEVICE_CYCLE.indexOf(prev);
        return DEVICE_CYCLE[(idx + 1) % DEVICE_CYCLE.length];
      });
      return;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSidebarClick = (tab: SidebarTab) => {
    if (tab === "chat") {
      if (activeTab === "chat" && showChat) {
        setShowChat(false);
      } else {
        setShowChat(true);
        setActiveTab("chat");
      }
    } else {
      setActiveTab(tab);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0f]">
      {/* Narrow Icon Sidebar */}
      <div className="flex w-12 flex-col items-center justify-between border-r border-border bg-[#0e0e14] py-3">
        {/* Top: Logo */}
        <div className="flex flex-col items-center gap-1">
          <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6]">
            <Zap className="h-4 w-4 text-white" />
          </div>

          {/* Nav Icons */}
          <div className="flex flex-col items-center gap-0.5">
            {SIDEBAR_ITEMS.map((item) => (
              <div key={item.id} className="group relative">
                <button
                  onClick={() => handleSidebarClick(item.id)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-150",
                    activeTab === item.id && (item.id !== "chat" || showChat)
                      ? "bg-[#7c3aed]/15 text-[#a78bfa]"
                      : "text-[#8888a0] hover:bg-[#1a1a24] hover:text-[#e2e2e8]"
                  )}
                >
                  {item.icon}
                  {activeTab === item.id && (item.id !== "chat" || showChat) && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-[#7c3aed]" />
                  )}
                </button>
                {/* Tooltip */}
                <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  <div className="tooltip-glass rounded-md px-2 py-1 text-xs text-[#e2e2e8] shadow-lg">
                    {item.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: User Avatar + Shortcuts */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8888a0] hover:bg-[#1a1a24] hover:text-[#e2e2e8] transition-all duration-150"
            title="Keyboard shortcuts"
          >
            <Keyboard className="h-4 w-4" />
          </button>
          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8888a0] hover:bg-[#1a1a24] hover:text-[#e2e2e8] transition-all duration-150"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <div
            className="h-7 w-7 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center text-[10px] font-semibold text-white cursor-default"
            title={user?.name || user?.email || "User"}
          >
            {user?.name?.[0] || user?.email?.[0] || "U"}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <WorkspaceHeader />
        <div className="flex-1 overflow-hidden">
          <PanelGroup
            direction={isVertical ? "vertical" : "horizontal"}
            className="h-full"
          >
            {/* Chat Panel */}
            {showChat && (
              <>
                <Panel
                  defaultSize={isVertical ? 30 : 25}
                  minSize={isVertical ? 15 : 20}
                  maxSize={isVertical ? 50 : 40}
                >
                  <ChatPanel />
                </Panel>
                <PanelResizeHandle
                  className={cn(
                    "group relative transition-colors",
                    isVertical ? "h-[3px]" : "w-[3px]"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 bg-border group-hover:bg-[#7c3aed]/50 transition-colors",
                    isVertical ? "h-[1px] top-1/2 -translate-y-1/2" : "w-[1px] left-1/2 -translate-x-1/2"
                  )} />
                </PanelResizeHandle>
              </>
            )}

            {/* Preview Panel */}
            <Panel defaultSize={isVertical ? 40 : 40} minSize={isVertical ? 20 : 25}>
              <PreviewPanel />
            </Panel>

            {/* Code Panel */}
            {showCode && (
              <>
                <PanelResizeHandle
                  className={cn(
                    "group relative transition-colors",
                    isVertical ? "h-[3px]" : "w-[3px]"
                  )}
                >
                  <div className={cn(
                    "absolute inset-0 bg-border group-hover:bg-[#7c3aed]/50 transition-colors",
                    isVertical ? "h-[1px] top-1/2 -translate-y-1/2" : "w-[1px] left-1/2 -translate-x-1/2"
                  )} />
                </PanelResizeHandle>
                <Panel
                  defaultSize={isVertical ? 30 : 35}
                  minSize={isVertical ? 15 : 20}
                >
                  <CodePanel />
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      </div>

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-[#13131a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-[#e2e2e8]">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="rounded p-1 text-[#8888a0] hover:text-[#e2e2e8] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {SHORTCUTS.map((shortcut) => (
                <div key={shortcut.description} className="flex items-center justify-between">
                  <span className="text-xs text-[#8888a0]">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={i}>
                        <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-[#1a1a24] px-1.5 text-[10px] font-medium text-[#8888a0]">
                          {key}
                        </kbd>
                        {i < shortcut.keys.length - 1 && (
                          <span className="text-[10px] text-[#8888a0]/50 mx-0.5">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-[10px] text-[#8888a0] text-center">
                Use Cmd on macOS, Ctrl on Windows/Linux
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
