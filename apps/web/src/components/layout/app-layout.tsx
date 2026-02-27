"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Users } from "lucide-react";
import { Sidebar, SIDEBAR_STORAGE_KEY } from "@/components/sidebar/sidebar";
import { useNotificationStore } from "@/stores/notification-store";
import { useTeamStore } from "@/stores/team-store";
import { getSocket } from "@/lib/socket";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  onNewProject?: () => void;
}

export function AppLayout({ children, onNewProject }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const { teams, activeTeamId, setActiveTeam, fetchTeams } = useTeamStore();

  // Fetch teams on mount
  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

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

  const activeTeam = teams.find((t) => t.id === activeTeamId);

  return (
    <div className="flex h-screen bg-[#0A0A0A]">
      <Sidebar onNewProject={onNewProject} />
      <main
        className={cn(
          "flex-1 overflow-auto transition-all duration-200",
          isMobile ? "pt-12" : collapsed ? "ml-16" : "ml-60"
        )}
      >
        {/* Team switcher header */}
        {teams.length > 0 && !isMobile && (
          <div className="sticky top-0 z-30 flex items-center h-10 border-b border-[#1E1E1E] bg-[#0A0A0A]/80 backdrop-blur-sm px-4">
            <div className="relative">
              <button
                onClick={() => setTeamDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#8888a0] hover:text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
              >
                <Users className="h-3.5 w-3.5" />
                <span>{activeTeam ? activeTeam.name : "Personal"}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {teamDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setTeamDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 z-50 w-48 rounded-lg border border-[#2A2A2A] bg-[#111111] py-1 shadow-xl">
                    <button
                      onClick={() => {
                        setActiveTeam(null);
                        setTeamDropdownOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                        !activeTeamId
                          ? "bg-[#1A1A1A] text-[#EDEDED]"
                          : "text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED]"
                      )}
                    >
                      Personal
                    </button>
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        onClick={() => {
                          setActiveTeam(team.id);
                          setTeamDropdownOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                          activeTeamId === team.id
                            ? "bg-[#1A1A1A] text-[#EDEDED]"
                            : "text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED]"
                        )}
                      >
                        <Users className="h-3 w-3" />
                        {team.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
