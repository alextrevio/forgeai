import { create } from "zustand";
import { api } from "@/lib/api";

interface Team {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  _count?: { members: number; projects: number };
  createdAt: string;
}

interface TeamState {
  teams: Team[];
  activeTeamId: string | null;
  isLoading: boolean;

  fetchTeams: () => Promise<void>;
  setActiveTeam: (id: string | null) => void;
  createTeam: (name: string, slug: string) => Promise<Team>;
  inviteMember: (teamId: string, email: string, role?: string) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  updateMemberRole: (teamId: string, userId: string, role: string) => Promise<void>;
}

const ACTIVE_TEAM_KEY = "arya-active-team";

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  activeTeamId:
    typeof window !== "undefined"
      ? localStorage.getItem(ACTIVE_TEAM_KEY)
      : null,
  isLoading: false,

  fetchTeams: async () => {
    set({ isLoading: true });
    try {
      const teams = await api.listTeams();
      set({ teams: Array.isArray(teams) ? teams : [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveTeam: (id) => {
    set({ activeTeamId: id });
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(ACTIVE_TEAM_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_TEAM_KEY);
      }
    }
  },

  createTeam: async (name, slug) => {
    const team = await api.createTeam(name, slug);
    set((state) => ({ teams: [team, ...state.teams] }));
    return team;
  },

  inviteMember: async (teamId, email, role = "member") => {
    await api.inviteTeamMember(teamId, email, role);
  },

  removeMember: async (teamId, userId) => {
    await api.removeTeamMember(teamId, userId);
  },

  updateMemberRole: async (teamId, userId, role) => {
    await api.updateTeamMemberRole(teamId, userId, role);
  },
}));
