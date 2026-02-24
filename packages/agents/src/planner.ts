import { AgentPlan, AgentStep } from "@forgeai/shared";
import { callLLMForJSON } from "./llm";
import { AGENT_PROMPTS } from "./prompts";
import { validatePlannerResponse } from "./json-utils";

export interface PlanAnalysis {
  appType: string;
  complexity: "simple" | "medium" | "complex";
  dataModels: Array<{ name: string; fields: string[] }>;
  pages: string[];
  fileManifest: string[];
}

export class PlannerAgent {
  async createPlan(
    userMessage: string,
    projectContext: string,
    signal?: AbortSignal
  ): Promise<AgentPlan & { analysis?: PlanAnalysis }> {
    const systemPrompt = AGENT_PROMPTS.planner;

    const enrichedPrompt = this.buildEnrichedPrompt(userMessage, projectContext);

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      { role: "user", content: enrichedPrompt },
    ];

    const { parsed, parseError } = await callLLMForJSON("planner", systemPrompt, messages, signal);

    if (!parsed) {
      console.error(`Planner: JSON extraction failed: ${parseError}`);
      return this.createFallbackPlan(userMessage);
    }

    // Validate and normalize the response
    const validation = validatePlannerResponse(parsed);
    if (!validation.valid) {
      console.warn(`Planner: validation issues: ${validation.errors.join(", ")}`);
    }

    const data = validation.data;

    const plan: AgentPlan & { analysis?: PlanAnalysis } = {
      understanding: data.understanding || userMessage,
      steps: (data.steps || []).map((step: any, index: number) => ({
        id: step.id || index + 1,
        type: step.type || "code",
        agent: step.agent || "coder",
        description: step.description || `Step ${index + 1}`,
        filesAffected: step.filesAffected || [],
        dependencies: step.dependencies || [],
        status: "pending" as const,
      })),
    };

    if (data.appType || data.complexity) {
      plan.analysis = {
        appType: data.appType || "other",
        complexity: data.complexity || "medium",
        dataModels: data.dataModels || [],
        pages: data.pages || [],
        fileManifest: data.fileManifest || [],
      };
    }

    if (plan.steps.length === 0) {
      plan.steps = this.generateFallbackSteps(userMessage);
    }

    // Consolidate plans with too many steps (max 6) for speed
    if (plan.steps.length > 6) {
      const first = plan.steps[0]; // Setup/install
      const second = plan.steps[1]; // Types/data
      const middle = plan.steps.slice(2, -2);
      const secondToLast = plan.steps[plan.steps.length - 2]; // Integration
      const last = plan.steps[plan.steps.length - 1]; // Polish

      const combined: AgentStep[] = [
        { ...first, id: 1, dependencies: [] },
        { ...second, id: 2, dependencies: [1] },
        {
          ...middle[0],
          id: 3,
          description: middle.map((s) => s.description).join(", "),
          filesAffected: middle.flatMap((s) => s.filesAffected),
          dependencies: [2],
          status: "pending" as const,
        },
        { ...secondToLast, id: 4, dependencies: [3], status: "pending" as const },
        { ...last, id: 5, dependencies: [4], status: "pending" as const },
      ];
      plan.steps = combined;
    }

    this.ensureDepsFirst(plan);

    return plan;
  }

  private buildEnrichedPrompt(userMessage: string, projectContext: string): string {
    const isNewProject = !projectContext.includes("src/App.tsx") ||
      projectContext.includes('"children": []') ||
      projectContext.split("\n").length < 20;

    let prompt = `## Current Project Context:\n${projectContext}\n\n`;
    prompt += `## Project State: ${isNewProject ? "NEW PROJECT (no existing code)" : "EXISTING PROJECT (has files)"}\n\n`;
    prompt += `## User Request:\n${userMessage}\n\n`;

    const keywords = this.detectKeywords(userMessage.toLowerCase());
    if (keywords.length > 0) {
      prompt += `## Detected Features:\n${keywords.join(", ")}\n\n`;
    }

    prompt += `Analyze this request thoroughly, then generate a comprehensive layered plan with file manifest.\n\n`;
    prompt += `Respond with ONLY a JSON object matching this schema:\n`;
    prompt += `{ "understanding": string, "appType": string, "complexity": "simple"|"medium"|"complex", "dataModels": [...], "pages": [...], "fileManifest": [...], "steps": [{ "id": number, "type": string, "agent": string, "description": string, "filesAffected": string[], "dependencies": number[], "layer": string }] }`;

    return prompt;
  }

  private detectKeywords(msg: string): string[] {
    const featureMap: Record<string, string[]> = {
      "authentication": ["login", "register", "signup", "sign in", "auth", "password"],
      "dashboard": ["dashboard", "admin", "analytics", "stats", "overview"],
      "CRUD": ["create", "add", "edit", "update", "delete", "remove", "manage", "list"],
      "search": ["search", "filter", "find", "query"],
      "charts": ["chart", "graph", "analytics", "visualization", "stats"],
      "table/grid": ["table", "grid", "list", "data table", "spreadsheet"],
      "forms": ["form", "input", "submit", "validation"],
      "navigation": ["sidebar", "navbar", "menu", "navigation", "tabs", "routing"],
      "modals": ["modal", "dialog", "popup", "overlay"],
      "file upload": ["upload", "file", "image upload", "attachment"],
      "dark mode": ["dark mode", "theme", "light mode"],
      "responsive": ["responsive", "mobile", "tablet"],
      "pagination": ["pagination", "page", "next page", "previous"],
      "notifications": ["notification", "toast", "alert", "message"],
      "drag & drop": ["drag", "drop", "reorder", "sortable"],
      "calendar": ["calendar", "date", "schedule", "event"],
      "e-commerce": ["cart", "checkout", "product", "shop", "store", "price", "payment"],
      "blog": ["blog", "article", "post", "content", "cms"],
      "social": ["profile", "feed", "follow", "like", "comment", "share"],
    };

    const detected: string[] = [];
    for (const [feature, keywords] of Object.entries(featureMap)) {
      if (keywords.some((kw) => msg.includes(kw))) {
        detected.push(feature);
      }
    }
    return detected;
  }

  private generateFallbackSteps(userMessage: string): AgentStep[] {
    return [
      {
        id: 1,
        type: "config",
        agent: "coder",
        description: "Install dependencies (react-router-dom, zustand, lucide-react)",
        filesAffected: ["package.json"],
        dependencies: [],
        status: "pending",
      },
      {
        id: 2,
        type: "code",
        agent: "coder",
        description: "Create TypeScript types, store, mock data, and utility functions",
        filesAffected: ["src/types/index.ts", "src/store/app-store.ts", "src/data/mock-data.ts", "src/lib/utils.ts"],
        dependencies: [1],
        status: "pending",
      },
      {
        id: 3,
        type: "code",
        agent: "coder",
        description: "Create layout components and shared UI components (Sidebar, Header, Layout, Button, Card, Input, Badge, Modal)",
        filesAffected: ["src/components/layout/Sidebar.tsx", "src/components/layout/Header.tsx", "src/components/layout/Layout.tsx", "src/components/ui/Button.tsx", "src/components/ui/Card.tsx", "src/components/ui/Input.tsx", "src/components/ui/Badge.tsx", "src/components/ui/Modal.tsx"],
        dependencies: [2],
        status: "pending",
      },
      {
        id: 4,
        type: "code",
        agent: "coder",
        description: `Create all feature components, pages, and wire up App.tsx with Router: ${userMessage.slice(0, 60)}`,
        filesAffected: ["src/pages/Dashboard.tsx", "src/App.tsx"],
        dependencies: [3],
        status: "pending",
      },
      {
        id: 5,
        type: "design",
        agent: "coder",
        description: "Add loading states, empty states, error states, responsive adjustments, and polish",
        filesAffected: [],
        dependencies: [4],
        status: "pending",
      },
    ];
  }

  private ensureDepsFirst(plan: AgentPlan): void {
    const hasInstallStep = plan.steps.some(
      (s) => s.description.toLowerCase().includes("install") ||
             s.description.toLowerCase().includes("dependencies") ||
             s.type === "config"
    );

    if (!hasInstallStep && plan.steps.length > 0) {
      for (const step of plan.steps) {
        step.id += 1;
        step.dependencies = step.dependencies.map((d) => d + 1);
      }
      plan.steps.unshift({
        id: 1,
        type: "config",
        agent: "coder",
        description: "Install required dependencies (react-router-dom, zustand, lucide-react)",
        filesAffected: ["package.json"],
        dependencies: [],
        status: "pending",
      });
    }
  }

  private createFallbackPlan(userMessage: string): AgentPlan {
    return {
      understanding: `Building: ${userMessage}`,
      steps: this.generateFallbackSteps(userMessage),
    };
  }
}
