import { agentRegistry } from "../agent-registry";
import { BaseAgent, type AgentResult } from "./base-agent";

// ══════════════════════════════════════════════════════════════════
// RESEARCH AGENT — Investigation and structured reports
// ══════════════════════════════════════════════════════════════════

interface ResearchResponse {
  thinking?: string;
  summary?: string;
  findings?: Array<{ topic: string; summary?: string; description?: string; details?: string; relevance?: string; sources?: string[] }>;
  report?: string;
  recommendations?: string[];
  techStack?: { suggested: string[]; reasoning: string };
  risks?: Array<{ risk: string; mitigation: string }>;
  status?: string;
}

export class ResearchAgentRunner extends BaseAgent {
  getSystemPrompt(): string {
    return agentRegistry.getAgent("research").systemPrompt;
  }

  async prepareContext(): Promise<Record<string, unknown>> {
    return {
      userMessage: this.buildUserMessage(),
    };
  }

  buildMessages(context: Record<string, unknown>): Array<{ role: "user" | "assistant"; content: string }> {
    return [{ role: "user", content: context.userMessage as string }];
  }

  async processResponse(parsed: Record<string, unknown> | null, rawText: string): Promise<AgentResult> {
    const data = parsed as ResearchResponse | null;

    if (data) {
      // Emit summary
      if (data.summary) {
        this.emitMessage(data.summary);
      }

      // Emit individual findings
      for (const finding of data.findings || []) {
        const relevance = (finding.relevance || "medium").toUpperCase();
        const desc = finding.description || finding.summary || finding.details || "";
        this.emitMessage(`[${relevance}] ${finding.topic}: ${desc}`);
      }

      // Emit recommendations
      if (data.recommendations?.length) {
        this.emitMessage(`Recomendaciones: ${data.recommendations.join("; ")}`);
      }

      return {
        thinking: data.thinking || data.summary || "Research completed",
        status: data.status || "completed",
        outputData: data as unknown as Record<string, unknown>,
      };
    }

    // Fallback: raw text
    this.emitMessage(rawText?.slice(0, 500) || "Research completed");
    return {
      thinking: "Research completed (raw)",
      status: "completed",
      outputData: { summary: rawText || "Research completed", raw: true },
    };
  }
}
