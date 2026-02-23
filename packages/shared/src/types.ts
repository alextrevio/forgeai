// ─── User & Auth ───────────────────────────────────────────────
export type Plan = "FREE" | "PRO" | "BUSINESS" | "ENTERPRISE";

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  creditsUsed: number;
  creditsLimit: number;
  githubUsername: string | null;
  supabaseUrl: string | null;
  settings: UserSettings | null;
  createdAt: string;
}

export interface UserSettings {
  theme?: "light" | "dark" | "system";
  editorFontSize?: number;
  defaultFramework?: string;
  autoSave?: boolean;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  supabaseDefaultUrl?: string;
  supabaseDefaultKey?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

// ─── Project ───────────────────────────────────────────────────
export type ProjectStatus = "ACTIVE" | "ARCHIVED" | "DEPLOYING" | "DEPLOYED";
export type Framework =
  | "react-vite"
  | "nextjs"
  | "vue"
  | "landing"
  | "dashboard"
  | "saas"
  | "api-only";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  sandboxId: string | null;
  deployUrl: string | null;
  subdomain: string | null;
  githubRepo: string | null;
  supabaseProjectId: string | null;
  status: ProjectStatus;
  framework: Framework;
  settings: ProjectSettings | null;
  customInstructions: string | null;
  template: string | null;
  forkedFrom: string | null;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MemberRole = "viewer" | "editor";

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: MemberRole;
  user?: { id: string; email: string; name: string | null };
  invitedAt: string;
}

export interface ProjectSettings {
  knowledgeBase?: string[];
  theme?: "light" | "dark";
  customInstructions?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  framework?: Framework;
  template?: string;
  customInstructions?: string;
}

// ─── Messages ──────────────────────────────────────────────────
export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export type MessageType = "plan" | "code" | "file_change" | "error" | "review" | "deploy" | "system";

export interface Message {
  id: string;
  projectId: string;
  role: MessageRole;
  content: string;
  messageType: MessageType | null;
  plan: AgentPlan | null;
  codeChanges: CodeChange[] | null;
  tokensUsed: number | null;
  creditsConsumed: number;
  model: string | null;
  createdAt: string;
}

export interface SendMessageRequest {
  content: string;
  attachments?: Attachment[];
}

export interface Attachment {
  type: "file" | "image";
  name: string;
  content: string; // base64 for images, text for files
}

// ─── Agent System ──────────────────────────────────────────────
export type AgentType =
  | "planner"
  | "coder"
  | "designer"
  | "debugger"
  | "deployer"
  | "reviewer";

export type StepType = "code" | "design" | "config" | "deploy" | "test";
export type StepStatus = "pending" | "in_progress" | "completed" | "failed";

export interface AgentPlan {
  understanding: string;
  steps: AgentStep[];
}

export interface AgentStep {
  id: number;
  type: StepType;
  agent: AgentType;
  description: string;
  filesAffected: string[];
  dependencies: number[];
  status: StepStatus;
}

export interface CodeChange {
  file: string;
  action: "create" | "edit" | "delete";
  diff?: string;
  content?: string;
}

// ─── Sandbox ───────────────────────────────────────────────────
export interface SandboxInfo {
  id: string;
  containerId: string;
  status: "creating" | "running" | "stopped" | "destroyed";
  previewUrl: string | null;
  ports: Record<string, number>;
}

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// ─── Snapshots & Version Control ─────────────────────────────
export interface Snapshot {
  id: string;
  projectId: string;
  label: string;
  files: string; // JSON string of file tree
  messageId?: string;
  createdAt: string;
}

// ─── Review Report ──────────────────────────────────────────
export interface ReviewIssue {
  severity: "error" | "warning" | "info" | "auto_fixable";
  file: string;
  line?: number;
  message: string;
  suggestion: string;
}

export interface ReviewReport {
  issues: ReviewIssue[];
  summary: string;
  score: number;
}

// ─── Deploy ────────────────────────────────────────────────────
export interface DeployResult {
  url: string;
  status: "success" | "failed";
  logs: string[];
}

// ─── Templates ─────────────────────────────────────────────────
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
  initialPrompt: string;
  thumbnail: string;
}

// ─── Billing ───────────────────────────────────────────────────
export interface PlanInfo {
  id: string;
  name: string;
  price: number;
  credits: number;
  maxProjects: number;
  features: string[];
}

export interface UsageStats {
  plan: string;
  creditsUsed: number;
  creditsLimit: number;
  maxProjects: number;
  projectCount: number;
  dailyUsage: Record<string, number>;
  memberSince: string;
}

// ─── GitHub ────────────────────────────────────────────────────
export interface GitHubStatus {
  connected: boolean;
  username: string | null;
}

export interface GitHubExportResult {
  success: boolean;
  repoUrl: string;
  repoFullName: string;
}

// ─── Supabase ──────────────────────────────────────────────────
export interface SupabaseStatus {
  connected: boolean;
  url: string | null;
}

// ─── Notifications ───────────────────────────────────────────────
export type NotificationType = "deploy_complete" | "deploy_failed" | "project_shared" | "credits_low";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  projectId: string | null;
  createdAt: string;
}

// ─── Console ─────────────────────────────────────────────────────
export type ConsoleLogLevel = "log" | "warn" | "error" | "info";

export interface ConsoleEntry {
  level: ConsoleLogLevel;
  message: string;
  timestamp: number;
}
