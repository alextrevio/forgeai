import { agentRegistry } from "../agent-registry";
import { BaseAgent, type AgentResult, type AgentAction, type ResultSummary } from "./base-agent";

// ══════════════════════════════════════════════════════════════════
// DESIGNER AGENT — UI/UX design, CSS/Tailwind code generation
// ══════════════════════════════════════════════════════════════════

interface DesignerResponse {
  thinking?: string;
  designDecisions?: Array<{ aspect: string; decision: string; reasoning: string }>;
  actions?: Array<{ type: string; path?: string; content?: string; component?: string; spec?: Record<string, unknown> }>;
  status?: string;
}

export class DesignerAgentRunner extends BaseAgent {
  getSystemPrompt(): string {
    return agentRegistry.getAgent("designer").systemPrompt;
  }

  async prepareContext(): Promise<Record<string, unknown>> {
    const sandboxId = await this.getSandboxId();
    let projectInfo = "";

    if (sandboxId) {
      const fileTree = await this.getProjectFileTree(sandboxId);
      projectInfo += `Project files:\n${JSON.stringify(fileTree, null, 2)}`;

      // Read key style files for context
      for (const file of ["src/App.tsx", "src/index.css", "tailwind.config.ts", "tailwind.config.js"]) {
        const content = await this.readProjectFile(sandboxId, file);
        if (content) {
          projectInfo += `\n\n--- ${file} ---\n${content}`;
        }
      }
    }

    return {
      userMessage: this.buildUserMessage(),
      projectInfo,
    };
  }

  buildMessages(context: Record<string, unknown>): Array<{ role: "user" | "assistant"; content: string }> {
    let msg = context.userMessage as string;
    if (context.projectInfo) {
      msg += `\n\nProyecto:\n${context.projectInfo}`;
    }
    return [{ role: "user", content: msg }];
  }

  async processResponse(parsed: Record<string, unknown> | null, rawText: string): Promise<AgentResult> {
    const data = parsed as DesignerResponse | null;

    if (data) {
      const thinking = data.thinking || "Design completed";
      this.emitMessage(thinking);

      // Emit design decisions
      for (const decision of data.designDecisions || []) {
        this.emitMessage(`[${decision.aspect.toUpperCase()}] ${decision.decision} — ${decision.reasoning}`);
      }

      // Convert response actions to AgentActions
      const actions: AgentAction[] = (data.actions || [])
        .filter((a) => a.type === "create_file" && a.path && a.content)
        .map((a) => ({
          type: "create_file" as const,
          path: a.path,
          content: a.content,
        }));

      const decisionsCount = (data.designDecisions || []).length;
      const filesCount = actions.length;
      const resultSummary: ResultSummary = {
        oneLiner: thinking,
        metrics: [
          ...(decisionsCount > 0 ? [{ label: "decisiones de diseño", value: decisionsCount }] : []),
          ...(filesCount > 0 ? [{ label: "archivos creados", value: filesCount }] : []),
        ],
        type: "design",
      };

      return {
        thinking,
        actions,
        status: data.status || "completed",
        outputData: data as unknown as Record<string, unknown>,
        resultSummary,
      };
    }

    this.emitMessage(rawText?.slice(0, 500) || "Design completed");
    return {
      thinking: "Design completed (raw)",
      status: "completed",
      outputData: { summary: rawText || "Design completed", raw: true },
    };
  }
}
