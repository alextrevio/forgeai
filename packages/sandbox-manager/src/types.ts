export interface SandboxConfig {
  workspacesDir: string;
  ttlMinutes: number;
}

export interface SandboxInfo {
  containerId: string; // kept for API compatibility — equals projectId
  projectId: string;
  status: "creating" | "running" | "stopped" | "destroyed";
  previewPort: number;
  workspaceDir: string;
  devServerPid: number | null;
  createdAt: Date;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}
