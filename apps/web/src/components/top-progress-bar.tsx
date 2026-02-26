"use client";

import { useProjectStore } from "@/stores/project-store";

export function TopProgressBar() {
  const isAgentRunning = useProjectStore((s) => s.isAgentRunning);

  if (!isAgentRunning) return null;

  return <div className="top-progress-bar" />;
}
