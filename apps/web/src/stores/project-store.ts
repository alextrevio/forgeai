import { create } from "zustand";
import type {
  AgentPlan,
  AgentStep,
  CodeChange,
  ConsoleEntry,
  FileNode,
  Message,
  ReviewReport,
} from "@forgeai/shared";

/** Runtime guard — guarantees the return value is always an array */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ensureArray<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of ["data", "messages", "items", "projects", "files", "snapshots", "plans", "templates", "operations", "steps"]) {
      if (Array.isArray((data as Record<string, unknown>)[key])) return (data as Record<string, unknown>)[key] as T[];
    }
  }
  return [];
}

export type ActiveAgent = "planner" | "coder" | "designer" | "debugger" | "reviewer" | "deployer" | null;

export interface SnapshotInfo {
  id: string;
  label: string;
  createdAt: string;
}

interface ProjectState {
  // Current project
  currentProjectId: string | null;
  projectName: string;
  framework: string;
  sandboxStatus: "creating" | "running" | "stopped" | "destroyed" | null;
  previewUrl: string | null;

  // Messages
  messages: Message[];
  isAgentRunning: boolean;
  agentThinking: string | null;
  activeAgent: ActiveAgent;

  // Plan
  currentPlan: AgentPlan | null;

  // Files
  fileTree: FileNode[];
  openFiles: Array<{ path: string; content: string; isDirty?: boolean }>;
  activeFilePath: string | null;
  changedFiles: Set<string>;

  // Terminal
  terminalOutput: string[];

  // Review
  lastReviewReport: ReviewReport | null;

  // Console
  consoleEntries: ConsoleEntry[];

  // Snapshots
  snapshots: SnapshotInfo[];

  // Actions
  setProject: (id: string, name: string, framework: string) => void;
  clearProject: () => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setAgentRunning: (running: boolean) => void;
  setAgentThinking: (thinking: string | null) => void;
  setActiveAgent: (agent: ActiveAgent) => void;
  setPlan: (plan: AgentPlan | null) => void;
  updateStepStatus: (stepId: number, status: AgentStep["status"]) => void;
  addCodeChange: (change: CodeChange) => void;
  markFileChanged: (path: string) => void;
  setFileTree: (tree: FileNode[]) => void;
  openFile: (path: string, content: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFileContent: (path: string, content: string) => void;
  refreshOpenFile: (path: string, content: string) => void;
  addTerminalOutput: (output: string) => void;
  clearTerminalOutput: () => void;
  setSandboxStatus: (status: ProjectState["sandboxStatus"]) => void;
  setPreviewUrl: (url: string | null) => void;
  setReviewReport: (report: ReviewReport | null) => void;
  addSnapshot: (snapshot: SnapshotInfo) => void;
  setSnapshots: (snapshots: SnapshotInfo[]) => void;
  addConsoleEntry: (entry: ConsoleEntry) => void;
  clearConsoleEntries: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProjectId: null,
  projectName: "",
  framework: "react-vite",
  sandboxStatus: null,
  previewUrl: null,
  messages: [],
  isAgentRunning: false,
  agentThinking: null,
  activeAgent: null,
  currentPlan: null,
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  changedFiles: new Set<string>(),
  terminalOutput: [],
  lastReviewReport: null,
  consoleEntries: [],
  snapshots: [],

  setProject: (id, name, framework) =>
    set({
      currentProjectId: id,
      projectName: name,
      framework,
      messages: [],
      currentPlan: null,
      fileTree: [],
      openFiles: [],
      activeFilePath: null,
      terminalOutput: [],
      changedFiles: new Set(),
      lastReviewReport: null,
      consoleEntries: [],
      snapshots: [],
    }),

  clearProject: () =>
    set({
      currentProjectId: null,
      projectName: "",
      framework: "react-vite",
      sandboxStatus: null,
      previewUrl: null,
      messages: [],
      isAgentRunning: false,
      agentThinking: null,
      activeAgent: null,
      currentPlan: null,
      fileTree: [],
      openFiles: [],
      activeFilePath: null,
      changedFiles: new Set(),
      terminalOutput: [],
      lastReviewReport: null,
      consoleEntries: [],
      snapshots: [],
    }),

  addMessage: (message) =>
    set((state) => ({ messages: [...ensureArray<Message>(state.messages), message] })),

  setMessages: (messages) => set({ messages: ensureArray<Message>(messages) }),

  setAgentRunning: (running) =>
    set({
      isAgentRunning: running,
      agentThinking: running ? "Starting..." : null,
      activeAgent: running ? "planner" : null,
    }),

  setAgentThinking: (thinking) => set({ agentThinking: thinking }),

  setActiveAgent: (agent) => set({ activeAgent: agent }),

  setPlan: (plan) => set({ currentPlan: plan }),

  updateStepStatus: (stepId, status) =>
    set((state) => {
      if (!state.currentPlan) return {};
      const steps = ensureArray<AgentStep>(state.currentPlan.steps);
      return {
        currentPlan: {
          ...state.currentPlan,
          steps: steps.map((s) =>
            s.id === stepId ? { ...s, status } : s
          ),
        },
      };
    }),

  addCodeChange: (_change) => set((state) => state),

  markFileChanged: (path) =>
    set((state) => {
      const newSet = new Set(state.changedFiles);
      newSet.add(path);
      return { changedFiles: newSet };
    }),

  setFileTree: (tree) => set({ fileTree: ensureArray<FileNode>(tree), changedFiles: new Set() }),

  openFile: (path, content) =>
    set((state) => {
      const files = ensureArray<{ path: string; content: string }>(state.openFiles);
      const exists = files.find((f) => f.path === path);
      if (exists) {
        return { activeFilePath: path };
      }
      return {
        openFiles: [...files, { path, content }],
        activeFilePath: path,
      };
    }),

  closeFile: (path) =>
    set((state) => {
      const files = ensureArray<{ path: string; content: string }>(state.openFiles);
      const newOpenFiles = files.filter((f) => f.path !== path);
      const newActive =
        state.activeFilePath === path
          ? newOpenFiles[newOpenFiles.length - 1]?.path || null
          : state.activeFilePath;
      return { openFiles: newOpenFiles, activeFilePath: newActive };
    }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFileContent: (path, content) =>
    set((state) => ({
      openFiles: ensureArray<{ path: string; content: string; isDirty?: boolean }>(state.openFiles).map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f
      ),
    })),

  refreshOpenFile: (path, content) =>
    set((state) => ({
      openFiles: ensureArray<{ path: string; content: string }>(state.openFiles).map((f) =>
        f.path === path ? { ...f, content } : f
      ),
    })),

  addTerminalOutput: (output) =>
    set((state) => ({
      terminalOutput: [...ensureArray<string>(state.terminalOutput), output].slice(-500),
    })),

  clearTerminalOutput: () => set({ terminalOutput: [] }),

  setSandboxStatus: (status) => set({ sandboxStatus: status }),

  setPreviewUrl: (url) => set({ previewUrl: url }),

  setReviewReport: (report) => set({ lastReviewReport: report }),

  addSnapshot: (snapshot) =>
    set((state) => ({ snapshots: [...ensureArray<SnapshotInfo>(state.snapshots), snapshot] })),

  setSnapshots: (snapshots) => set({ snapshots: ensureArray<SnapshotInfo>(snapshots) }),

  addConsoleEntry: (entry) =>
    set((state) => ({
      consoleEntries: [...ensureArray<ConsoleEntry>(state.consoleEntries), entry].slice(-200),
    })),

  clearConsoleEntries: () => set({ consoleEntries: [] }),
}));
