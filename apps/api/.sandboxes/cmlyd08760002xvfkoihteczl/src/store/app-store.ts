import { create } from "zustand";
import type { Item, Status } from "../types";
import { generateId } from "../lib/utils";

interface AppState {
  items: Item[];
  searchQuery: string;
  filterStatus: Status | "all";
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: Status | "all") => void;
  addItem: (title: string, description: string, priority: Item["priority"]) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  toggleStatus: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  items: [],
  searchQuery: "",
  filterStatus: "all",
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterStatus: (status) => set({ filterStatus: status }),
  addItem: (title, description, priority) =>
    set((state) => ({
      items: [
        ...state.items,
        {
          id: generateId(),
          title,
          description,
          status: "active" as const,
          priority,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })),
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates, updatedAt: new Date() } : item
      ),
    })),
  deleteItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  toggleStatus: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "active" ? "completed" as const : "active" as const, updatedAt: new Date() }
          : item
      ),
    })),
}));
