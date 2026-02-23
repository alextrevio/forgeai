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
        description: "Create TypeScript types, store, and mock data",
        filesAffected: ["src/types/index.ts", "src/store/app-store.ts", "src/data/mock-data.ts"],
        dependencies: [1],
        status: "pending",
      },
      {
        id: 3,
        type: "code",
        agent: "coder",
        description: "Create layout components (Sidebar, Header, Layout wrapper)",
        filesAffected: ["src/components/layout/Sidebar.tsx", "src/components/layout/Header.tsx", "src/components/layout/Layout.tsx"],
        dependencies: [2],
        status: "pending",
      },
      {
        id: 4,
        type: "code",
        agent: "coder",
        description: "Create shared UI components (Button, Card, Input, Badge, Modal)",
        filesAffected: ["src/components/ui/Button.tsx", "src/components/ui/Card.tsx", "src/components/ui/Input.tsx", "src/components/ui/Badge.tsx", "src/components/ui/Modal.tsx"],
        dependencies: [2],
        status: "pending",
      },
      {
        id: 5,
        type: "code",
        agent: "coder",
        description: `Create feature components: ${userMessage.slice(0, 60)}`,
        filesAffected: [],
        dependencies: [3, 4],
        status: "pending",
      },
      {
        id: 6,
        type: "code",
        agent: "coder",
        description: "Create page components and connect with Router in App.tsx",
        filesAffected: ["src/pages/Dashboard.tsx", "src/App.tsx"],
        dependencies: [5],
        status: "pending",
      },
      {
        id: 7,
        type: "design",
        agent: "coder",
        description: "Add loading states, empty states, error states, and polish",
        filesAffected: [],
        dependencies: [6],
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
