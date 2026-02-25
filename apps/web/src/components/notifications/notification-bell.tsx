"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, Rocket, AlertCircle, Users, CreditCard } from "lucide-react";
import { useNotificationStore } from "@/stores/notification-store";
import { cn, formatDate } from "@/lib/utils";
import { useRouter } from "next/navigation";

// Defense-in-depth: guarantee notifications is always an array at render level
function safeArray<T>(data: T[]): T[];
function safeArray<T>(data: T[] | null | undefined): T[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

const typeIcons: Record<string, React.ReactNode> = {
  deploy_complete: <Rocket className="h-4 w-4 text-green-500" />,
  deploy_failed: <AlertCircle className="h-4 w-4 text-red-500" />,
  project_shared: <Users className="h-4 w-4 text-blue-500" />,
  credits_low: <CreditCard className="h-4 w-4 text-amber-500" />,
};

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, fetchNotifications, markRead, markAllRead } =
    useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification: any) => {
    if (!notification.read) {
      await markRead(notification.id);
    }
    if (notification.projectId) {
      router.push(`/project/${notification.projectId}`);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-[#1A1A1A] hover:text-white transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#6d5cff] text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[#2A2A2A] bg-[#111111] shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A]">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-[#6d5cff] hover:text-[#6d5cff]/80 transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {safeArray(notifications).length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No notifications yet</p>
              </div>
            ) : (
              safeArray(notifications).slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-[#1A1A1A]/50 transition-colors border-b border-[#2A2A2A]/50 last:border-b-0",
                    !n.read && "bg-[#6d5cff]/5"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {typeIcons[n.type] || <Bell className="h-4 w-4 text-gray-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs", n.read ? "text-gray-400" : "text-white font-medium")}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">{n.message}</p>
                    <p className="text-[10px] text-gray-600 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <div className="h-2 w-2 rounded-full bg-[#6d5cff] shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
