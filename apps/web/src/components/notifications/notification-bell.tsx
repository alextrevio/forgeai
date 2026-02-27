"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Rocket, AlertCircle, Users, CreditCard, CheckCircle2, XCircle, Zap } from "lucide-react";
import { useNotificationStore } from "@/stores/notification-store";
import { cn, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

function safeArray<T>(data: T[]): T[];
function safeArray<T>(data: T[] | null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

const typeIcons: Record<string, React.ReactNode> = {
  deploy_complete: <Rocket className="h-4 w-4 text-[#22c55e]" />,
  deploy_failed: <AlertCircle className="h-4 w-4 text-[#ef4444]" />,
  project_shared: <Users className="h-4 w-4 text-[#3b82f6]" />,
  credits_low: <CreditCard className="h-4 w-4 text-[#f59e0b]" />,
  engine_complete: <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />,
  engine_failed: <XCircle className="h-4 w-4 text-[#ef4444]" />,
  task_complete: <Zap className="h-4 w-4 text-[#22c55e]" />,
  task_failed: <AlertCircle className="h-4 w-4 text-[#ef4444]" />,
};

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, fetchNotifications, markRead, markAllRead } =
    useNotificationStore();

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) await markRead(notification.id);
    if (notification.projectId) { router.push(`/project/${notification.projectId}`); setIsOpen(false); }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center rounded-lg p-2 text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED] transition-all duration-200"
        title="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#7c3aed] text-[9px] font-bold text-white animate-badge-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#2A2A2A] bg-[#111111] shadow-2xl z-50 overflow-hidden animate-dropdown">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A]">
            <span className="text-sm font-semibold text-[#EDEDED]">Notificaciones</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors duration-150">
                <CheckCheck className="h-3 w-3" /> Marcar todo leído
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {safeArray(notifications).length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="h-8 w-8 text-[#8888a0]/15 mx-auto mb-3" />
                <p className="text-xs text-[#8888a0]/40">Sin notificaciones</p>
              </div>
            ) : (
              safeArray(notifications).slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-[#1A1A1A]/50 transition-colors duration-150 border-b border-[#2A2A2A]/50 last:border-b-0",
                    !n.read && "bg-[#7c3aed]/5"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {typeIcons[n.type] || <Bell className="h-4 w-4 text-[#8888a0]" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs", n.read ? "text-[#8888a0]" : "text-[#EDEDED] font-medium")}>{n.title}</p>
                    <p className="text-[11px] text-[#8888a0]/60 mt-0.5 truncate">{n.message}</p>
                    <p className="text-[10px] text-[#8888a0]/40 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  {!n.read && <div className="h-2 w-2 rounded-full bg-[#7c3aed] shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
