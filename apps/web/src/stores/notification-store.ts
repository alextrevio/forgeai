import { create } from "zustand";
import { api } from "@/lib/api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of ["data", "notifications", "items"]) {
      if (Array.isArray((data as Record<string, unknown>)[key])) return (data as Record<string, unknown>)[key] as T[];
    }
  }
  return [];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  projectId: string | null;
  createdAt: string;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;

  fetchNotifications: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: NotificationItem) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const data = await api.getNotifications();
      const notifications = ensureArray<NotificationItem>(
        data?.notifications ?? data
      );
      set({
        notifications,
        unreadCount: typeof data?.unreadCount === "number" ? data.unreadCount : notifications.filter((n) => !n.read).length,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  markRead: async (id: string) => {
    try {
      await api.markNotificationRead(id);
      set((state) => ({
        notifications: ensureArray<NotificationItem>(state.notifications).map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {}
  },

  markAllRead: async () => {
    try {
      await api.markAllNotificationsRead();
      set((state) => ({
        notifications: ensureArray<NotificationItem>(state.notifications).map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {}
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...ensureArray<NotificationItem>(state.notifications)],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));
