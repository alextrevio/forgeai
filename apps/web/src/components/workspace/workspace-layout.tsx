"use client";

import { useState, useEffect, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { WorkspaceHeader } from "./workspace-header";
import { ChatPanel } from "./chat-panel";
import { PreviewPanel } from "./preview-panel";
import { CodePanel } from "./code-panel";
import { Keyboard, X } from "lucide-react";
import { cn } from "@/lib/utils";

type DevicePreviewMode = "desktop" | "tablet" | "mobile";
const DEVICE_CYCLE: DevicePreviewMode[] = ["desktop", "tablet", "mobile"];

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

  // Responsive breakpoint listener
  useEffect(() => {
    const checkWidth = () => {
      setIsVertical(window.innerWidth < 1024);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+B: Toggle chat panel
      if (mod && !e.shiftKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setShowChat((prev) => !prev);
        return;
      }

      // Cmd/Ctrl+J: Toggle code panel
      if (mod && !e.shiftKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setShowCode((prev) => !prev);
        return;
      }

      // Cmd/Ctrl+Shift+D: Cycle preview device mode
      if (mod && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setPreviewDevice((prev) => {
          const idx = DEVICE_CYCLE.indexOf(prev);
          return DEVICE_CYCLE[(idx + 1) % DEVICE_CYCLE.length];
        });
        return;
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen flex-col bg-background">
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
                  "bg-border hover:bg-primary/50 transition-colors",
                  isVertical ? "h-1" : "w-1"
                )}
              />
            </>
          )}

          {/* Preview Panel */}
          <Panel defaultSize={isVertical ? 40 : 40} minSize={isVertical ? 20 : 25}>
            <PreviewPanel />
          </Panel>

          {/* Code + Terminal Panel */}
          {showCode && (
            <>
              <PanelResizeHandle
                className={cn(
                  "bg-border hover:bg-primary/50 transition-colors",
                  isVertical ? "h-1" : "w-1"
                )}
              />

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

      {/* Keyboard Shortcuts Hint Button */}
      <button
        onClick={() => setShowShortcuts(true)}
        className="fixed bottom-4 right-4 z-40 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg hover:text-foreground hover:border-primary/50 transition-all duration-200"
        title="Keyboard shortcuts"
      >
        <Keyboard className="h-3.5 w-3.5" />
      </button>

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-foreground">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.description}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-muted-foreground">
                    {shortcut.description}
                  </span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={i}>
                        <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-secondary px-1.5 text-[10px] font-medium text-muted-foreground">
                          {key}
                        </kbd>
                        {i < shortcut.keys.length - 1 && (
                          <span className="text-[10px] text-muted-foreground/50 mx-0.5">
                            +
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-[10px] text-muted-foreground text-center">
                Use Cmd on macOS, Ctrl on Windows/Linux
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
