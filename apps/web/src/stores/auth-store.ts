import { create } from "zustand";
import { posthog } from "@/lib/posthog";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  creditsUsed: number;
  creditsLimit: number;
  settings: Record<string, any> | null;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const data = await api.login(email, password);
    posthog.identify(data.user.id, {
      email: data.user.email,
      name: data.user.name,
      plan: data.user.plan,
    });
    posthog.capture('user_logged_in', { method: 'email' });
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  register: async (email, password, name) => {
    const data = await api.register(email, password, name);
    posthog.identify(data.user.id, {
      email: data.user.email,
      name: data.user.name,
      plan: data.user.plan,
    });
    posthog.capture('user_registered', { method: 'email' });
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    posthog.capture('user_logged_out');
    posthog.reset();
    api.logout();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const user = await api.getMe();
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        plan: user.plan,
        created_at: user.createdAt,
      });
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
