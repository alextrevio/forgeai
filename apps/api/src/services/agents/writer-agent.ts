import { sandboxManager } from "../../sandbox/manager";
import { logger } from "../../lib/logger";
import { agentRegistry } from "../agent-registry";
import { BaseAgent, type AgentResult, type ResultSummary } from "./base-agent";

// ══════════════════════════════════════════════════════════════════
// WRITER AGENT — Content creation with file writing
// ══════════════════════════════════════════════════════════════════

interface WriterResponse {
  thinking?: string;
  summary?: string;
  content?: string | Array<{ title: string; type: string; body: string; targetFile?: string }>;
  metadata?: { wordCount?: number; readingTime?: string; tone?: string; language?: string };
  actions?: Array<{ type: string; path?: string; content?: string }>;
  status?: string;
}

export class WriterAgentRunner extends BaseAgent {
  getSystemPrompt(): string {
    return agentRegistry.getAgent("writer").systemPrompt;
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
    const data = parsed as WriterResponse | null;

    if (data) {
      const summary = data.summary || data.thinking || "Content created";
      this.emitMessage(summary);

      // Write content files to sandbox if applicable
      const sandboxId = await this.getSandboxId();
      const contentItems = Array.isArray(data.content) ? data.content : [];

      for (const item of contentItems) {
        if (item.targetFile && sandboxId) {
          try {
            await sandboxManager.writeFile(sandboxId, item.targetFile, item.body);
            this.emitFileChange("create", item.targetFile);
          } catch (err) {
            logger.warn({ err, file: item.targetFile }, "Writer: failed to write file to sandbox");
          }
        }

        this.emitMessage(`${item.title} (${item.type}): ${item.body.slice(0, 200)}...`);
      }

      const filesWritten = contentItems.filter((i) => i.targetFile).length;
      const wordCount = data.metadata?.wordCount || 0;
      const resultSummary: ResultSummary = {
        oneLiner: summary,
        metrics: [
          ...(filesWritten > 0 ? [{ label: "archivos escritos", value: filesWritten }] : []),
          ...(wordCount > 0 ? [{ label: "palabras", value: wordCount }] : []),
          ...(data.metadata?.tone ? [{ label: "tono", value: data.metadata.tone }] : []),
        ],
        type: "content",
      };

      return {
        thinking: data.thinking || summary,
        status: data.status || "completed",
        outputData: data as unknown as Record<string, unknown>,
        resultSummary,
      };
    }

    this.emitMessage(rawText?.slice(0, 500) || "Content created");
    return {
      thinking: "Content created (raw)",
      status: "completed",
      outputData: { summary: rawText || "Content created", raw: true },
    };
  }
}
