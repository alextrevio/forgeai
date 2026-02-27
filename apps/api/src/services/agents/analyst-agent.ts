import { agentRegistry } from "../agent-registry";
import { BaseAgent, type AgentResult, type ResultSummary } from "./base-agent";

// ══════════════════════════════════════════════════════════════════
// ANALYST AGENT — Data analysis and insights
// ══════════════════════════════════════════════════════════════════

interface AnalystResponse {
  thinking?: string;
  summary?: string;
  analysis?: { summary: string; metrics?: unknown[]; insights?: unknown[] };
  dataModel?: { entities: Array<{ name: string; fields: string[]; relationships: string[] }> };
  insights?: Array<{ insight: string; impact?: string; actionable?: boolean }>;
  metrics?: Array<{ name: string; description: string }>;
  visualizations?: Array<{ type: string; data: unknown; config: unknown }>;
  recommendations?: string[];
  status?: string;
}

export class AnalystAgentRunner extends BaseAgent {
  getSystemPrompt(): string {
    return agentRegistry.getAgent("analyst").systemPrompt;
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
    const data = parsed as AnalystResponse | null;

    if (data) {
      const summary = data.summary || data.analysis?.summary || "Analysis completed";
      this.emitMessage(summary);

      // Emit individual insights
      for (const insight of data.insights || []) {
        const impact = (insight.impact || "medium").toUpperCase();
        this.emitMessage(`[${impact}] ${insight.insight}`);
      }

      const insightsCount = (data.insights || []).length;
      const metricsCount = (data.metrics || []).length;
      const resultSummary: ResultSummary = {
        oneLiner: summary,
        metrics: [
          ...(insightsCount > 0 ? [{ label: "insights", value: insightsCount }] : []),
          ...(metricsCount > 0 ? [{ label: "métricas", value: metricsCount }] : []),
          ...(data.visualizations?.length ? [{ label: "visualizaciones", value: data.visualizations.length }] : []),
        ],
        type: "analysis",
      };

      return {
        thinking: data.thinking || summary,
        status: data.status || "completed",
        outputData: data as unknown as Record<string, unknown>,
        resultSummary,
      };
    }

    this.emitMessage(rawText?.slice(0, 500) || "Analysis completed");
    return {
      thinking: "Analysis completed (raw)",
      status: "completed",
      outputData: { summary: rawText || "Analysis completed", raw: true },
    };
  }
}
