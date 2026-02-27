import { sandboxManager } from "../../sandbox/manager";
import { logger } from "../../lib/logger";
import { agentRegistry } from "../agent-registry";
import { BaseAgent, type AgentResult } from "./base-agent";

// ══════════════════════════════════════════════════════════════════
// DEPLOY AGENT — Deployment configuration and execution
// ══════════════════════════════════════════════════════════════════

interface DeployResponse {
  thinking?: string;
  summary?: string;
  platform?: string;
  steps?: Array<{
    description: string;
    commands?: string[];
    configFiles?: Array<{ path: string; content: string }>;
  }>;
  actions?: Array<{ type: string; command?: string; path?: string; content?: string }>;
  deployInfo?: { url?: string; status?: string; logs?: string };
  envVars?: Array<{ name: string; description: string; required: boolean }>;
  checks?: string[];
  status?: string;
}

export class DeployAgentRunner extends BaseAgent {
  getSystemPrompt(): string {
    return agentRegistry.getAgent("deploy").systemPrompt;
  }

  async prepareContext(): Promise<Record<string, unknown>> {
    const project = await this.getProject();
    const sandboxId = project?.sandboxId;
    let projectInfo = `Framework: ${project?.framework || "unknown"}`;

    if (sandboxId) {
      try {
        const fileTree = await this.getProjectFileTree(sandboxId);
        projectInfo += `\nProject files: ${JSON.stringify(fileTree, null, 2)}`;
        const pkg = await this.readProjectFile(sandboxId, "package.json");
        if (pkg) {
          projectInfo += `\n\n--- package.json ---\n${pkg}`;
        }
      } catch { /* skip */ }
    }

    return {
      userMessage: `Tarea: ${this.ctx.step.description}\n\nSolicitud original: ${this.ctx.originalPrompt}\n\nProyecto:\n${projectInfo}${this.ctx.dependencyContext}`,
      sandboxId,
    };
  }

  buildMessages(context: Record<string, unknown>): Array<{ role: "user" | "assistant"; content: string }> {
    return [{ role: "user", content: context.userMessage as string }];
  }

  async processResponse(parsed: Record<string, unknown> | null, rawText: string): Promise<AgentResult> {
    const data = parsed as DeployResponse | null;
    const sandboxId = await this.getSandboxId();

    if (data && sandboxId) {
      const summary = data.summary || data.thinking || "Deploy configured";
      this.emitMessage(summary);

      // Write config files and run commands from structured steps
      for (const deployStep of data.steps || []) {
        // Write config files
        for (const configFile of deployStep.configFiles || []) {
          try {
            await sandboxManager.writeFile(sandboxId, configFile.path, configFile.content);
            this.emitFileChange("create", configFile.path);
          } catch (err) {
            logger.warn({ err, file: configFile.path }, "Deploy: failed to write config file");
          }
        }

        // Execute deploy commands
        for (const cmd of deployStep.commands || []) {
          try {
            this.emitTerminal(cmd, `$ ${cmd}`);
            const result = await sandboxManager.executeCommand(sandboxId, cmd);
            const output = result.stdout || result.stderr || "";
            this.emitTerminal(cmd, output.slice(0, 1000));
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            this.emitError(`Deploy command failed: ${cmd} — ${errMsg}`);
          }
        }
      }

      return {
        thinking: data.thinking || summary,
        status: data.status || "completed",
        outputData: data as unknown as Record<string, unknown>,
      };
    }

    // Fallback
    this.emitMessage(rawText?.slice(0, 500) || "Deploy analysis completed");
    return {
      thinking: "Deploy analysis completed (raw)",
      status: "completed",
      outputData: { summary: rawText || "Deploy analysis completed", raw: true },
    };
  }
}
