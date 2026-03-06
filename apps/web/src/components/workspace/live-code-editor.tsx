"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LiveCodeEditorProps {
  filePath: string;
  content: string;
  isLiveTyping: boolean;
  agentType?: string;
}

/** Maximum animation duration in ms */
const MAX_ANIMATION_MS = 8000;
/** Minimum animation duration in ms */
const MIN_ANIMATION_MS = 1500;
/** Ms between animation ticks */
const TICK_INTERVAL = 12;

function getFileExtLabel(path: string): string {
  const ext = path.split(".").pop() || "";
  return ext.toUpperCase();
}

export function LiveCodeEditor({
  filePath,
  content,
  isLiveTyping,
  agentType,
}: LiveCodeEditorProps) {
  const [displayedContent, setDisplayedContent] = useState("");
  const [cursorLine, setCursorLine] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevContentRef = useRef("");
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLPreElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const animateTypewriter = useCallback((text: string) => {
    // Cancel any running animation
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    setIsAnimating(true);
    setDisplayedContent("");
    setCursorLine(0);

    const totalChars = text.length;
    if (totalChars === 0) {
      setIsAnimating(false);
      return;
    }

    // Adaptive speed: ensure animation finishes within MAX_ANIMATION_MS
    const targetDuration = Math.max(
      MIN_ANIMATION_MS,
      Math.min(MAX_ANIMATION_MS, totalChars * 5)
    );
    const totalTicks = Math.ceil(targetDuration / TICK_INTERVAL);
    const charsPerTick = Math.max(1, Math.ceil(totalChars / totalTicks));

    let charIndex = 0;

    const tick = () => {
      charIndex = Math.min(charIndex + charsPerTick, totalChars);
      const slice = text.slice(0, charIndex);
      setDisplayedContent(slice);

      // Calculate current line for cursor
      const lineCount = slice.split("\n").length - 1;
      setCursorLine(lineCount);

      // Auto-scroll
      if (editorRef.current) {
        editorRef.current.scrollTop = editorRef.current.scrollHeight;
      }

      if (charIndex >= totalChars) {
        setIsAnimating(false);
        setDisplayedContent(text);
        return;
      }

      timerRef.current = setTimeout(() => {
        animFrameRef.current = requestAnimationFrame(() => tick());
      }, TICK_INTERVAL);
    };

    animFrameRef.current = requestAnimationFrame(() => tick());
  }, []);

  // Handle content changes
  useEffect(() => {
    if (!content) {
      setDisplayedContent("");
      prevContentRef.current = "";
      return;
    }

    if (isLiveTyping && content !== prevContentRef.current) {
      const oldLen = prevContentRef.current.length;
      prevContentRef.current = content;

      if (oldLen === 0) {
        // New file — full typewriter animation
        animateTypewriter(content);
      } else {
        // Modification — flash the new content in
        setDisplayedContent(content);
        setIsAnimating(true);
        setCursorLine(content.split("\n").length - 1);
        // Brief "animating" state for the cursor effect
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setIsAnimating(false), 1500);
      }
    } else if (!isLiveTyping) {
      // Static mode — show content immediately
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      setDisplayedContent(content);
      setIsAnimating(false);
      prevContentRef.current = content;
    }
  }, [content, isLiveTyping, animateTypewriter]);

  const lines = displayedContent.split("\n");
  const totalLines = content.split("\n").length;

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A] font-mono text-sm">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1E1E1E] bg-[#0E0E0E] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#888] text-xs truncate">{filePath}</span>
          {isAnimating && agentType && (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#7c3aed] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed] animate-pulse" />
              {agentType === "coder"
                ? "Coder"
                : agentType === "designer"
                  ? "Designer"
                  : agentType}{" "}
              escribiendo...
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAnimating && (
            <span className="text-[10px] text-[#555]">
              {lines.length}/{totalLines} lines
            </span>
          )}
          <span className="text-[10px] text-[#555]">
            {getFileExtLabel(filePath)}
          </span>
        </div>
      </div>

      {/* Code area */}
      <pre
        ref={editorRef}
        className="flex-1 overflow-auto p-0 m-0 leading-6"
        style={{
          fontFamily:
            "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        <code className="block min-h-full">
          {lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex hover:bg-[#111114]/50",
                isAnimating && i === cursorLine && "bg-[#7c3aed]/5"
              )}
            >
              {/* Line number */}
              <span className="inline-block w-12 text-right pr-4 pl-2 text-[#444] select-none shrink-0 text-xs leading-6">
                {i + 1}
              </span>
              {/* Code */}
              <span className="flex-1 text-[#E0E0E0] whitespace-pre pr-4 text-xs leading-6">
                {line}
                {/* Blinking cursor at the end of the current line */}
                {isAnimating && i === cursorLine && (
                  <span className="inline-block w-[2px] h-[14px] bg-[#7c3aed] animate-blink ml-px align-middle" />
                )}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
