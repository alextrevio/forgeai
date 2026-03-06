"use client";

import { cn } from "@/lib/utils";

export function VoiceWaveform({
  isActive,
  color = "#7c3aed",
}: {
  isActive: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "w-0.5 rounded-full transition-all duration-150",
            isActive ? "animate-waveform" : "h-1"
          )}
          style={{
            backgroundColor: color,
            animationDelay: isActive ? `${i * 0.1}s` : undefined,
            height: isActive ? undefined : "4px",
          }}
        />
      ))}
    </div>
  );
}
