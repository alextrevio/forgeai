"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  delay?: number;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ content, children, delay = 500, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">(side === "bottom" ? "bottom" : "top");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      // Smart positioning: check if there's space above
      if (triggerRef.current && side === "top") {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition(rect.top < 48 ? "bottom" : "top");
      }
      setVisible(true);
    }, delay);
  }, [delay, side]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div ref={triggerRef} className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <div className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap",
          "rounded-md bg-[#1A1A1A] border border-[#2A2A2A] px-2 py-1 text-[10px] text-[#EDEDED] shadow-lg",
          "animate-fade-in",
          position === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
          className
        )}>
          {content}
        </div>
      )}
    </div>
  );
}
