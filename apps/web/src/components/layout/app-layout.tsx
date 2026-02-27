"use client";

import { useState, useEffect } from "react";
import { Sidebar, SIDEBAR_STORAGE_KEY } from "@/components/sidebar/sidebar";
import { useNotificationStore } from "@/stores/notification-store";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  onNewProject?: () => void;
}

export function AppLayout({ children, onNewProject }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);

  // Listen for real-time notifications via WebSocket
  useEffect(() => {
    const socket = getSocket();
    const handler = (notification: any) => {
      if (notification?.id && notification?.title) {
        addNotification(notification);
      }
    };
    socket.on("notification", handler);
    return () => { socket.off("notification", handler); };
  }, [addNotification]);

  // Sync collapsed state from localStorage (sidebar writes it)
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true") setCollapsed(true);

    const handleStorage = () => {
      setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    };

    // Poll for changes since storage events don't fire in same tab
    const interval = setInterval(() => {
      const current = localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
      setCollapsed((prev) => (prev !== current ? current : prev));
    }, 200);

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="flex h-screen bg-[#0A0A0A]">
      <Sidebar onNewProject={onNewProject} />
      <main
        className={cn(
          "flex-1 overflow-auto transition-all duration-200",
          isMobile ? "pt-12" : collapsed ? "ml-16" : "ml-60"
        )}
      >
        {children}
      </main>
    </div>
  );
}
