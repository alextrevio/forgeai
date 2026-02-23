"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  ExternalLink,
  Loader2,
  Globe,
  Copy,
  Check,
  AlertCircle,
  Terminal,
} from "lucide-react";
import { useProjectStore } from "@/stores/project-store";
import { ConsolePanel, useConsoleCapture } from "./console-panel";
import { cn } from "@/lib/utils";

type PreviewTab = "preview" | "console";

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_SIZES: Record<DeviceMode, { width: string; label: string }> = {
  desktop: { width: "100%", label: "Desktop" },
  tablet: { width: "768px", label: "Tablet" },
  mobile: { width: "375px", label: "Mobile" },
};

const IFRAME_LOAD_TIMEOUT = 15000; // 15 seconds

export function PreviewPanel() {
  const { previewUrl, sandboxStatus, consoleEntries, addConsoleEntry, clearConsoleEntries } = useProjectStore();
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewTab>("preview");
  const [urlInput, setUrlInput] = useState(previewUrl || "");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Console capture from iframe postMessage
  useConsoleCapture(addConsoleEntry);

  // Sync URL input with previewUrl
  useEffect(() => {
    if (previewUrl) setUrlInput(previewUrl);
  }, [previewUrl]);

  // Reset loading/error state when previewUrl changes
  useEffect(() => {
    if (previewUrl) {
      setIframeLoading(true);
      setIframeError(false);

      // Set a timeout - if iframe doesn't load in time, show error
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        // Only trigger error if still loading
        setIframeLoading((loading) => {
          if (loading) {
            setIframeError(true);
            return false;
          }
          return loading;
        });
      }, IFRAME_LOAD_TIMEOUT);
    } else {
      setIframeLoading(false);
      setIframeError(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [previewUrl]);

  const handleIframeLoad = useCallback(() => {
    setIframeLoading(false);
    setIframeError(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleIframeError = useCallback(() => {
    setIframeLoading(false);
    setIframeError(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleRefresh = useCallback(() => {
    if (iframeRef.current) {
      setIsRefreshing(true);
      setIframeLoading(true);
      setIframeError(false);
      iframeRef.current.src = iframeRef.current.src;
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      setIframeLoading(true);
      setIframeError(false);
      iframeRef.current.src = previewUrl;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setIframeLoading((loading) => {
          if (loading) {
            setIframeError(true);
            return false;
          }
          return loading;
        });
      }, IFRAME_LOAD_TIMEOUT);
    }
  }, [previewUrl]);

  const handleOpenExternal = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, "_blank");
    }
  }, [previewUrl]);

  const handleCopyUrl = useCallback(async () => {
    if (previewUrl) {
      try {
        await navigator.clipboard.writeText(previewUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Fallback for older browsers
        const textarea = document.createElement("textarea");
        textarea.value = previewUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [previewUrl]);

  const deviceConfig = DEVICE_SIZES[deviceMode];

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("preview")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeTab === "preview"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            onClick={() => setActiveTab("console")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors relative",
              activeTab === "console"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Terminal className="h-3.5 w-3.5" />
            Console
            {consoleEntries.length > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 min-w-[14px] rounded-full bg-primary text-[8px] text-primary-foreground flex items-center justify-center px-0.5">
                {consoleEntries.length > 99 ? "99+" : consoleEntries.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Device Mode Selector */}
          <div className="flex items-center rounded-md bg-secondary p-0.5">
            <button
              onClick={() => setDeviceMode("desktop")}
              className={cn(
                "rounded p-1.5 transition-colors",
                deviceMode === "desktop"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Desktop"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode("tablet")}
              className={cn(
                "rounded p-1.5 transition-colors",
                deviceMode === "tablet"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Tablet"
            >
              <Tablet className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDeviceMode("mobile")}
              className={cn(
                "rounded p-1.5 transition-colors",
                deviceMode === "mobile"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Mobile"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mx-1 h-4 w-px bg-border" />

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh preview"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            />
          </button>

          {/* Open External */}
          <button
            onClick={handleOpenExternal}
            disabled={!previewUrl}
            className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* URL Bar */}
      {activeTab === "preview" && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && iframeRef.current && urlInput.trim()) {
                iframeRef.current.src = urlInput.trim();
                setIframeLoading(true);
                setIframeError(false);
              }
            }}
            className="flex-1 rounded-md bg-muted px-3 py-1 text-xs text-foreground font-mono outline-none placeholder:text-muted-foreground min-w-0"
            placeholder="No preview available"
          />
          {previewUrl && (
            <button
              onClick={handleCopyUrl}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Copy URL"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Console Panel */}
      {activeTab === "console" && (
        <div className="flex-1 overflow-hidden">
          <ConsolePanel entries={consoleEntries} onClear={clearConsoleEntries} />
        </div>
      )}

      {/* Preview Area */}
      {activeTab === "preview" && (
      <div className="flex-1 flex items-start justify-center overflow-auto bg-muted/30 p-4">
        {!previewUrl ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            {sandboxStatus === "creating" ? (
              <>
                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Setting up sandbox...
                </h3>
                <p className="text-xs text-muted-foreground">
                  Creating your development environment
                </p>
              </>
            ) : (
              <>
                <Monitor className="h-10 w-10 text-muted-foreground/30 mb-4" />
                <h3 className="text-sm font-medium text-foreground mb-1">
                  No preview yet
                </h3>
                <p className="text-xs text-muted-foreground max-w-[250px]">
                  Send a message in the chat to start building. The preview will
                  appear here automatically.
                </p>
              </>
            )}
          </div>
        ) : (
          <div
            className={cn(
              "h-full bg-white rounded-lg overflow-hidden shadow-lg transition-all duration-300 relative",
              deviceMode !== "desktop" && "border border-border"
            )}
            style={{
              width: deviceConfig.width,
              maxWidth: "100%",
            }}
          >
            {/* Loading Skeleton */}
            {iframeLoading && !iframeError && (
              <div className="absolute inset-0 z-10 bg-[#131320] p-6 space-y-4 animate-pulse">
                {/* Fake nav bar */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-8 rounded-md bg-[#1e1e3a]" />
                  <div className="h-4 w-32 rounded bg-[#1e1e3a]" />
                  <div className="flex-1" />
                  <div className="h-4 w-16 rounded bg-[#1e1e3a]" />
                  <div className="h-4 w-16 rounded bg-[#1e1e3a]" />
                </div>
                {/* Fake hero */}
                <div className="h-6 w-3/4 rounded bg-[#1e1e3a]" />
                <div className="h-4 w-1/2 rounded bg-[#1e1e3a]" />
                <div className="h-40 w-full rounded-lg bg-[#1e1e3a] mt-4" />
                {/* Fake content rows */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="h-24 rounded-lg bg-[#1e1e3a]" />
                  <div className="h-24 rounded-lg bg-[#1e1e3a]" />
                  <div className="h-24 rounded-lg bg-[#1e1e3a]" />
                </div>
                <div className="h-4 w-2/3 rounded bg-[#1e1e3a] mt-4" />
                <div className="h-4 w-1/3 rounded bg-[#1e1e3a]" />
              </div>
            )}

            {/* Error Overlay */}
            {iframeError && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#131320]/95 backdrop-blur-sm">
                <AlertCircle className="h-10 w-10 text-destructive mb-3" />
                <h3 className="text-sm font-medium text-foreground mb-1">
                  Preview failed to load
                </h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-[220px] text-center">
                  The preview could not be loaded. The server may still be starting up.
                </p>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            )}

            <iframe
              ref={iframeRef}
              src={previewUrl}
              className="h-full w-full border-0"
              title="App Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          </div>
        )}
      </div>
      )}
    </div>
  );
}
