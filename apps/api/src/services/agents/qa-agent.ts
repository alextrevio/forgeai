import { agentRegistry } from "../agent-registry";
import { BaseAgent, type AgentResult, type AgentAction } from "./base-agent";

// ══════════════════════════════════════════════════════════════════
// QA AGENT — Testing, code review, security audit
// ══════════════════════════════════════════════════════════════════

interface QAResponse {
  thinking?: string;
  review?: {
    issues?: Array<{ severity: string; file?: string; line?: number; description: string; fix?: string }>;
    score?: number;
    summary?: string;
  };
  actions?: Array<{ type: string; command?: string; path?: string; search?: string; replace?: string }>;
  status?: string;
}

export class QAAgentRunner extends BaseAgent {
  getSystemPrompt(): string {
    return agentRegistry.getAgent("qa").systemPrompt;
  }

  async prepareContext(): Promise<Record<string, unknown>> {
    const sandboxId = await this.getSandboxId();
    let projectInfo = "";

    if (sandboxId) {
      const fileTree = await this.getProjectFileTree(sandboxId);
      projectInfo += `Project files:\n${JSON.stringify(fileTree, null, 2)}`;

      // Read source files for review context
      for (const file of ["package.json", "src/App.tsx", "src/main.tsx", "tsconfig.json"]) {
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
    const data = parsed as QAResponse | null;

    if (data) {
      const thinking = data.thinking || "QA review completed";

      // Emit review summary
      if (data.review?.summary) {
        this.emitMessage(data.review.summary);
      }
      if (data.review?.score !== undefined) {
        this.emitMessage(`Quality Score: ${data.review.score}/100`);
      }

      // Emit issues
      for (const issue of data.review?.issues || []) {
        const location = issue.file ? ` (${issue.file}${issue.line ? `:${issue.line}` : ""})` : "";
        this.emitMessage(`[${issue.severity.toUpperCase()}]${location} ${issue.description}`);
      }

      // Convert actions
      const actions: AgentAction[] = (data.actions || []).map((a) => {
        if (a.type === "terminal" && a.command) {
          return { type: "terminal" as const, command: a.command };
        }
        if (a.type === "modify_file" && a.path) {
          return { type: "modify_file" as const, path: a.path, search: a.search, replace: a.replace };
        }
        return { type: "message" as const, text: JSON.stringify(a) };
      });

      return {
        thinking,
        actions,
        status: data.status || "completed",
        outputData: data as unknown as Record<string, unknown>,
      };
    }

    this.emitMessage(rawText?.slice(0, 500) || "QA review completed");
    return {
      thinking: "QA review completed (raw)",
      status: "completed",
      outputData: { summary: rawText || "QA review completed", raw: true },
    };
  }
}
