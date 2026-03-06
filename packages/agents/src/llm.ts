import Anthropic from "@anthropic-ai/sdk";
import { extractJSON, type ExtractionResult } from "./json-utils";

// ─── Configuration ──────────────────────────────────────────────────

const apiKey = process.env.ANTHROPIC_API_KEY;
const isDemo = !apiKey || apiKey === "your-anthropic-key-here";

let anthropic: Anthropic | null = null;
if (!isDemo) {
  anthropic = new Anthropic({ apiKey });
}

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export const LLM_CONFIGS: Record<string, LLMConfig> = {
  planner: {
    model: "claude-sonnet-4-20250514",
    temperature: 0.3,
    maxTokens: 4096,
  },
  coder: {
    model: "claude-sonnet-4-20250514",
    temperature: 0.2,
    maxTokens: 8192,
  },
  designer: {
    model: "claude-sonnet-4-20250514",
    temperature: 0.4,
    maxTokens: 8192,
  },
  debugger: {
    model: "claude-haiku-4-5-20251001",
    temperature: 0.2,
    maxTokens: 4096,
  },
  reviewer: {
    model: "claude-haiku-4-5-20251001",
    temperature: 0.3,
    maxTokens: 4096,
  },
  research: {
    model: "claude-sonnet-4-20250514",
    temperature: 0.4,
    maxTokens: 8192,
  },
  analyst: {
    model: "claude-sonnet-4-20250514",
    temperature: 0.3,
    maxTokens: 8192,
  },
  writer: {
    model: "claude-sonnet-4-20250514",
    temperature: 0.5,
    maxTokens: 8192,
  },
  qa: {
    model: "claude-haiku-4-5-20251001",
    temperature: 0.2,
    maxTokens: 4096,
  },
  deploy: {
    model: "claude-haiku-4-5-20251001",
    temperature: 0.2,
    maxTokens: 4096,
  },
};

export function isDemoMode(): boolean {
  return isDemo;
}

// ─── Retry & Backoff ────────────────────────────────────────────────

const MAX_API_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: any): { retryable: boolean; backoff: boolean } {
  const status = err?.status ?? err?.statusCode;
  // 429: Rate limited → retry with exponential backoff
  if (status === 429) return { retryable: true, backoff: true };
  // 500: Server error → retry up to 2 times
  if (status === 500) return { retryable: true, backoff: true };
  // 529: API overloaded → retry with backoff
  if (status === 529) return { retryable: true, backoff: true };
  // 408/timeout → retry
  if (status === 408) return { retryable: true, backoff: true };
  // Network errors
  if (err?.code === "ECONNRESET" || err?.code === "ETIMEDOUT" || err?.code === "ENOTFOUND") {
    return { retryable: true, backoff: true };
  }
  return { retryable: false, backoff: false };
}

// ─── Core LLM Call ──────────────────────────────────────────────────

interface CallLLMOptions {
  /** Start the assistant response with "{" to force JSON output */
  prefillJSON?: boolean;
}

/**
 * Call the Anthropic API with automatic retry and exponential backoff.
 *
 * Handles:
 *  - 429 rate limits → exponential backoff + retry
 *  - 500 server errors → retry up to 2x
 *  - 529 overloaded → backoff + retry
 *  - Truncated responses (max_tokens) → continuation call
 *  - Demo mode → mock responses
 */
export async function callLLM(
  agentType: string,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  signal?: AbortSignal,
  options?: CallLLMOptions
): Promise<string> {
  const effectiveDemo = isDemo || !anthropic;

  if (effectiveDemo || !anthropic) {
    console.log(`[LLM:demo] callLLM(${agentType}) — demo mode, returning mock`);
    return getDemoResponse(agentType, messages);
  }

  const config = LLM_CONFIGS[agentType] || LLM_CONFIGS.coder;

  // Build messages, optionally with assistant prefill
  const finalMessages = [...messages];
  if (options?.prefillJSON) {
    finalMessages.push({ role: "assistant", content: "{" });
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_API_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("Aborted");

    try {
      console.log(
        `[LLM:${agentType}] API call (attempt ${attempt + 1}/${MAX_API_RETRIES}, model=${config.model}, maxTokens=${config.maxTokens})`
      );

      const response = await anthropic.messages.create(
        {
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          system: systemPrompt,
          messages: finalMessages,
        },
        { signal }
      );

      let text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      // Prepend the prefill character
      if (options?.prefillJSON) {
        text = "{" + text;
      }

      console.log(
        `[LLM:${agentType}] Response received (${text.length} chars, stop_reason=${response.stop_reason})`
      );

      // Handle truncated responses
      if (response.stop_reason === "max_tokens") {
        console.warn(`[LLM:${agentType}] Response truncated at max_tokens. Attempting continuation...`);
        text = await continueResponse(agentType, config, systemPrompt, finalMessages, text, signal);
      }

      return text;
    } catch (err: any) {
      lastError = err;
      const { retryable, backoff } = isRetryableError(err);

      if (retryable && attempt < MAX_API_RETRIES - 1) {
        const delayMs = backoff
          ? INITIAL_BACKOFF_MS * Math.pow(2, attempt)
          : INITIAL_BACKOFF_MS;
        console.warn(
          `[LLM:${agentType}] Error (status=${err?.status || "unknown"}): ${err?.message || err}. ` +
          `Retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_API_RETRIES})...`
        );
        await sleep(delayMs);
        continue;
      }

      // Non-retryable or out of retries
      console.error(`[LLM:${agentType}] API call failed permanently: ${err?.message || err}`);
      throw err;
    }
  }

  throw lastError || new Error(`LLM call failed after ${MAX_API_RETRIES} attempts`);
}

/**
 * Continue a truncated response by sending the partial output back and
 * asking the model to complete it. Stitches the two parts together.
 */
async function continueResponse(
  agentType: string,
  config: LLMConfig,
  systemPrompt: string,
  originalMessages: Array<{ role: "user" | "assistant"; content: string }>,
  partialResponse: string,
  signal?: AbortSignal
): Promise<string> {
  if (!anthropic) return partialResponse;

  const continuationMessages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...originalMessages.filter((m) => m.role === "user"), // Keep original user messages
    { role: "assistant", content: partialResponse },
    {
      role: "user",
      content:
        "Your previous response was cut off. Continue EXACTLY from where you stopped. " +
        "Do NOT repeat any content. Do NOT add any explanation. " +
        "Continue the JSON output from the exact point of truncation.",
    },
  ];

  try {
    const response = await anthropic.messages.create(
      {
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemPrompt,
        messages: continuationMessages,
      },
      { signal }
    );

    const continuationText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    console.log(`[LLM:${agentType}] Continuation received (${continuationText.length} chars)`);

    return partialResponse + continuationText;
  } catch (err) {
    console.warn(`[LLM:${agentType}] Continuation failed, returning partial response: ${err}`);
    return partialResponse;
  }
}

// ─── JSON-Aware LLM Call ────────────────────────────────────────────

/**
 * Call the LLM and extract JSON from the response, with automatic
 * re-prompting if JSON parsing fails.
 *
 * Flow:
 *   1. Call LLM with assistant prefill ("{") to encourage JSON
 *   2. Extract JSON using multi-strategy parser
 *   3. If extraction fails, re-prompt with explicit JSON instruction (up to maxRetries)
 *   4. Return parsed data + raw text
 */
export async function callLLMForJSON<T = unknown>(
  agentType: string,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  signal?: AbortSignal,
  maxRetries: number = 2
): Promise<{ text: string; parsed: T | null; parseError?: string }> {
  // First call with assistant prefill
  let responseText = await callLLM(agentType, systemPrompt, messages, signal, {
    prefillJSON: true,
  });

  let result: ExtractionResult<T> = extractJSON<T>(responseText);
  if (result.success && result.data !== null) {
    return { text: responseText, parsed: result.data };
  }

  // Re-prompt: ask the LLM to fix its JSON
  for (let retry = 0; retry < maxRetries; retry++) {
    if (signal?.aborted) break;

    console.warn(
      `[LLM:${agentType}] JSON extraction failed (${result.error}). Re-prompting (retry ${retry + 1}/${maxRetries})...`
    );

    const retryMessages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...messages,
      { role: "assistant", content: responseText },
      {
        role: "user",
        content:
          "Your response was not valid JSON. Please respond with ONLY a valid JSON object. " +
          "No explanation, no markdown code blocks, no text before or after. Just the raw JSON object.",
      },
    ];

    responseText = await callLLM(agentType, systemPrompt, retryMessages, signal, {
      prefillJSON: true,
    });

    result = extractJSON<T>(responseText);
    if (result.success && result.data !== null) {
      console.log(`[LLM:${agentType}] JSON extraction succeeded on retry ${retry + 1}`);
      return { text: responseText, parsed: result.data };
    }
  }

  console.error(`[LLM:${agentType}] JSON extraction failed after all retries`);
  return { text: responseText, parsed: null, parseError: result.error };
}

// ─── Streaming LLM Call ─────────────────────────────────────────────

export async function streamLLM(
  agentType: string,
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  if (isDemo || !anthropic) {
    const result = getDemoResponse(agentType, messages);
    onChunk(result);
    return result;
  }

  const config = LLM_CONFIGS[agentType] || LLM_CONFIGS.coder;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_API_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("Aborted");

    try {
      const stream = anthropic.messages.stream(
        {
          model: config.model,
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          system: systemPrompt,
          messages,
        },
        { signal }
      );

      let fullText = "";

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullText += event.delta.text;
          onChunk(event.delta.text);
        }
      }

      return fullText;
    } catch (err: any) {
      lastError = err;
      const { retryable } = isRetryableError(err);

      if (retryable && attempt < MAX_API_RETRIES - 1) {
        const delayMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        console.warn(
          `[LLM:${agentType}:stream] Error (${err?.status || "unknown"}). Retrying in ${delayMs}ms...`
        );
        await sleep(delayMs);
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error(`Stream LLM call failed after ${MAX_API_RETRIES} attempts`);
}

// ─── Demo mode responses ───────────────────────────────────────────

function getDemoResponse(
  agentType: string,
  messages: Array<{ role: string; content: string }>
): string {
  const userMessage =
    messages.find((m) => m.role === "user")?.content || "build an app";

  if (agentType === "planner") {
    return JSON.stringify({
      understanding: `I will build a professional, multi-file application based on your request: "${userMessage.slice(0, 80)}"`,
      appType: "dashboard",
      complexity: "medium",
      dataModels: [
        { name: "Item", fields: ["id: string", "title: string", "description: string", "status: Status", "createdAt: Date"] },
      ],
      pages: ["Dashboard", "Items", "Settings"],
      fileManifest: [
        "src/types/index.ts",
        "src/lib/utils.ts",
        "src/store/app-store.ts",
        "src/data/mock-data.ts",
        "src/components/ui/Button.tsx",
        "src/components/ui/Card.tsx",
        "src/components/ui/Input.tsx",
        "src/components/ui/Badge.tsx",
        "src/components/ui/Modal.tsx",
        "src/components/layout/Sidebar.tsx",
        "src/components/layout/Layout.tsx",
        "src/pages/Dashboard.tsx",
        "src/pages/Items.tsx",
        "src/App.tsx",
      ],
      steps: [
        {
          id: 1,
          type: "config",
          agent: "coder",
          description: "Install dependencies: react-router-dom, zustand, lucide-react",
          filesAffected: ["package.json"],
          dependencies: [],
          layer: "A",
        },
        {
          id: 2,
          type: "code",
          agent: "coder",
          description: "Create TypeScript types, utility functions, and Zustand store",
          filesAffected: ["src/types/index.ts", "src/lib/utils.ts", "src/store/app-store.ts"],
          dependencies: [1],
          layer: "B",
        },
        {
          id: 3,
          type: "code",
          agent: "coder",
          description: "Create mock data and seed the store",
          filesAffected: ["src/data/mock-data.ts"],
          dependencies: [2],
          layer: "B",
        },
        {
          id: 4,
          type: "code",
          agent: "coder",
          description: "Create layout components: Sidebar with navigation and Layout wrapper",
          filesAffected: ["src/components/layout/Sidebar.tsx", "src/components/layout/Layout.tsx"],
          dependencies: [2],
          layer: "C",
        },
        {
          id: 5,
          type: "code",
          agent: "coder",
          description: "Create shared UI components: Button, Card, Input, Badge, Modal",
          filesAffected: [
            "src/components/ui/Button.tsx",
            "src/components/ui/Card.tsx",
            "src/components/ui/Input.tsx",
            "src/components/ui/Badge.tsx",
            "src/components/ui/Modal.tsx",
          ],
          dependencies: [2],
          layer: "D",
        },
        {
          id: 6,
          type: "code",
          agent: "coder",
          description: "Create page components: Dashboard with stats and Items list page",
          filesAffected: ["src/pages/Dashboard.tsx", "src/pages/Items.tsx"],
          dependencies: [4, 5],
          layer: "F",
        },
        {
          id: 7,
          type: "code",
          agent: "coder",
          description: "Wire up App.tsx with React Router, connecting all pages through Layout",
          filesAffected: ["src/App.tsx"],
          dependencies: [6],
          layer: "G",
        },
        {
          id: 8,
          type: "design",
          agent: "coder",
          description: "Add loading states, empty states, error states, and polish transitions",
          filesAffected: [],
          dependencies: [7],
          layer: "H",
        },
      ],
    });
  }

  // Coder demo: generate multi-file professional architecture
  return getDemoCoderResponse(userMessage);
}

function getDemoCoderResponse(userMessage: string): string {
  // Extract just the task description (after "## Task:") to avoid matching on project context
  const taskMatch = userMessage.match(/## Task:\n(.*?)(?:\n\n|$)/s);
  const taskDescription = taskMatch ? taskMatch[1].trim() : userMessage;
  const msg = taskDescription.toLowerCase();

  // Config step — just install deps
  if (msg.includes("install") || msg.includes("dependencies") || msg.includes("configuration")) {
    return JSON.stringify({
      operations: [],
      commands: ["npm install react-router-dom zustand lucide-react recharts date-fns"],
    });
  }

  // Types + utils + store step
  if (msg.includes("type") || msg.includes("interface") || msg.includes("store") || msg.includes("utility")) {
    return JSON.stringify({
      operations: [
        {
          action: "create",
          path: "src/types/index.ts",
          content: `export type Status = "active" | "completed" | "archived";
export type Priority = "low" | "medium" | "high";

export interface Item {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stats {
  total: number;
  active: number;
  completed: number;
  archived: number;
}
`,
        },
        {
          action: "create",
          path: "src/lib/utils.ts",
          content: `import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
`,
        },
        {
          action: "create",
          path: "src/store/app-store.ts",
          content: `import { create } from "zustand";
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
`,
        },
      ],
      commands: [],
    });
  }

  // Mock data step
  if (msg.includes("mock") || msg.includes("seed") || msg.includes("data")) {
    return JSON.stringify({
      operations: [
        {
          action: "create",
          path: "src/data/mock-data.ts",
          content: `import type { Item } from "../types";

export const MOCK_ITEMS: Item[] = [
  {
    id: "1",
    title: "Design System Setup",
    description: "Create consistent UI components with Tailwind",
    status: "completed",
    priority: "high",
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-01-20"),
  },
  {
    id: "2",
    title: "User Authentication",
    description: "Implement login and registration flow",
    status: "active",
    priority: "high",
    createdAt: new Date("2025-01-18"),
    updatedAt: new Date("2025-01-18"),
  },
  {
    id: "3",
    title: "Dashboard Analytics",
    description: "Add charts and statistics to the dashboard",
    status: "active",
    priority: "medium",
    createdAt: new Date("2025-01-20"),
    updatedAt: new Date("2025-01-22"),
  },
  {
    id: "4",
    title: "API Documentation",
    description: "Write comprehensive API docs with examples",
    status: "archived",
    priority: "low",
    createdAt: new Date("2025-01-10"),
    updatedAt: new Date("2025-01-12"),
  },
  {
    id: "5",
    title: "Performance Optimization",
    description: "Optimize bundle size and loading performance",
    status: "active",
    priority: "medium",
    createdAt: new Date("2025-01-22"),
    updatedAt: new Date("2025-01-22"),
  },
];
`,
        },
      ],
      commands: [],
    });
  }

  // Layout step
  if (msg.includes("layout") || msg.includes("sidebar") || msg.includes("header")) {
    return JSON.stringify({
      operations: [
        {
          action: "create",
          path: "src/components/layout/Sidebar.tsx",
          content: `import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListTodo,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/items", icon: ListTodo, label: "Items" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={\`\${
        collapsed ? "w-16" : "w-64"
      } h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300\`}
    >
      <div className="p-4 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800">
        <Zap className="w-8 h-8 text-blue-600 flex-shrink-0" />
        {!collapsed && (
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            MyApp
          </span>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              \`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors \${
                isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              }\`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="p-3 border-t border-gray-200 dark:border-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-5 h-5 mx-auto" />
        ) : (
          <ChevronLeft className="w-5 h-5 mx-auto" />
        )}
      </button>
    </aside>
  );
}
`,
        },
        {
          action: "create",
          path: "src/components/layout/Layout.tsx",
          content: `import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
`,
        },
      ],
      commands: [],
    });
  }

  // UI components step
  if (msg.includes("ui component") || msg.includes("button") || msg.includes("card") || msg.includes("input") || msg.includes("badge") || msg.includes("modal")) {
    return JSON.stringify({
      operations: [
        {
          action: "create",
          path: "src/components/ui/Button.tsx",
          content: `import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500/50",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 focus:ring-gray-500/50",
  outline: "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 focus:ring-gray-500/50",
  ghost: "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus:ring-gray-500/50",
  destructive: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500/50",
};

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";
`,
        },
        {
          action: "create",
          path: "src/components/ui/Card.tsx",
          content: `import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700",
        "shadow-sm hover:shadow-md transition-shadow duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div className={cn("px-6 py-4 border-b border-gray-200 dark:border-gray-700", className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className, children, ...props }: CardProps) {
  return (
    <div className={cn("px-6 py-4", className)} {...props}>
      {children}
    </div>
  );
}
`,
        },
        {
          action: "create",
          path: "src/components/ui/Input.tsx",
          content: `import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, iconLeft, iconRight, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\\s/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          {iconLeft && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{iconLeft}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full rounded-md border border-gray-300 dark:border-gray-600",
              "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100",
              "px-3 py-2 text-sm placeholder:text-gray-400 dark:placeholder:text-gray-500",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-200",
              iconLeft && "pl-10",
              iconRight && "pr-10",
              error && "border-red-500 focus:ring-red-500/50 focus:border-red-500",
              className
            )}
            {...props}
          />
          {iconRight && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{iconRight}</div>
          )}
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
`,
        },
        {
          action: "create",
          path: "src/components/ui/Badge.tsx",
          content: `import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
`,
        },
        {
          action: "create",
          path: "src/components/ui/Modal.tsx",
          content: `import { useEffect, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div
        className={cn(
          "relative bg-white dark:bg-gray-800 rounded-xl shadow-xl",
          "w-full max-w-lg mx-4 animate-slide-up",
          className
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
`,
        },
      ],
      commands: [],
    });
  }

  // Pages step
  if (msg.includes("page") || msg.includes("dashboard") || msg.includes("items")) {
    return JSON.stringify({
      operations: [
        {
          action: "create",
          path: "src/pages/Dashboard.tsx",
          content: `import { useMemo } from "react";
import { BarChart3, ListTodo, CheckCircle, Archive } from "lucide-react";
import { Card, CardContent } from "../components/ui/Card";
import { useAppStore } from "../store/app-store";
import type { Stats } from "../types";

export function Dashboard() {
  const items = useAppStore((s) => s.items);

  const stats: Stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((i) => i.status === "active").length,
      completed: items.filter((i) => i.status === "completed").length,
      archived: items.filter((i) => i.status === "archived").length,
    }),
    [items]
  );

  const statCards = [
    { label: "Total Items", value: stats.total, icon: ListTodo, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "Active", value: stats.active, icon: BarChart3, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "Completed", value: stats.completed, icon: CheckCircle, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
    { label: "Archived", value: stats.archived, icon: Archive, color: "text-gray-600", bg: "bg-gray-50 dark:bg-gray-800" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Overview of your items and activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4">
              <div className={\`p-3 rounded-lg \${stat.bg}\`}>
                <stat.icon className={\`w-5 h-5 \${stat.color}\`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
          {items.length === 0 ? (
            <div className="text-center py-8">
              <ListTodo className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No items yet. Create your first item to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                  </div>
                  <span className={\`text-xs px-2 py-1 rounded-full \${
                    item.status === "active"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : item.status === "completed"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  }\`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
`,
        },
        {
          action: "create",
          path: "src/pages/Items.tsx",
          content: `import { useState, useMemo, useCallback } from "react";
import { Plus, Search, Trash2, CheckCircle, Inbox } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { useAppStore } from "../store/app-store";
import type { Status } from "../types";

const STATUS_FILTERS: Array<{ value: Status | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function Items() {
  const { items, searchQuery, filterStatus, setSearchQuery, setFilterStatus, addItem, deleteItem, toggleStatus } = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === "all" || item.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [items, searchQuery, filterStatus]);

  const handleCreate = useCallback(() => {
    if (!newTitle.trim()) return;
    addItem(newTitle.trim(), newDescription.trim(), "medium");
    setNewTitle("");
    setNewDescription("");
    setShowCreateModal(false);
  }, [newTitle, newDescription, addItem]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Items</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your items</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> Add Item
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          iconLeft={<Search className="w-4 h-4" />}
          className="sm:w-72"
        />
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={\`px-3 py-1.5 text-xs font-medium rounded-md transition-colors \${
                filterStatus === filter.value
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }\`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Inbox className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No items found</h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {searchQuery ? "Try adjusting your search." : "Create your first item to get started."}
          </p>
          {!searchQuery && (
            <Button onClick={() => setShowCreateModal(true)} className="mt-4" variant="outline">
              <Plus className="w-4 h-4" /> Create Item
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleStatus(item.id)}
                    className={\`p-1 rounded-full transition-colors \${
                      item.status === "completed"
                        ? "text-green-600"
                        : "text-gray-300 hover:text-green-500"
                    }\`}
                    aria-label={\`Toggle \${item.title}\`}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <div>
                    <p className={\`text-sm font-medium \${
                      item.status === "completed"
                        ? "line-through text-gray-400 dark:text-gray-500"
                        : "text-gray-900 dark:text-white"
                    }\`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === "active" ? "success" : item.status === "completed" ? "info" : "default"}>
                    {item.status}
                  </Badge>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    aria-label={\`Delete \${item.title}\`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Item" description="Add a new item to your list.">
        <div className="space-y-4">
          <Input label="Title" placeholder="Enter item title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          <Input label="Description" placeholder="Enter description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim()}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
`,
        },
      ],
      commands: [],
    });
  }

  // App.tsx / Router step
  if (msg.includes("router") || msg.includes("app.tsx") || msg.includes("wire") || msg.includes("connect")) {
    return JSON.stringify({
      operations: [
        {
          action: "edit",
          path: "src/App.tsx",
          content: `import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Items } from "./pages/Items";
import { useEffect } from "react";
import { useAppStore } from "./store/app-store";
import { MOCK_ITEMS } from "./data/mock-data";

export default function App() {
  const items = useAppStore((s) => s.items);

  // Seed with mock data on first load
  useEffect(() => {
    if (items.length === 0) {
      const store = useAppStore.getState();
      for (const item of MOCK_ITEMS) {
        store.addItem(item.title, item.description, item.priority);
      }
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
`,
        },
        {
          action: "edit",
          path: "src/index.css",
          content: `@import "tailwindcss";
`,
        },
      ],
      commands: [],
    });
  }

  // Default: polish step or generic coder response
  return JSON.stringify({
    operations: [
      {
        action: "edit",
        path: "src/App.tsx",
        content: `import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Items } from "./pages/Items";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<Items />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
`,
      },
      {
        action: "edit",
        path: "src/index.css",
        content: `@import "tailwindcss";
`,
      },
    ],
    commands: [],
  });
}
