import { AgentStep } from "@forgeai/shared";
import { callLLMForJSON } from "./llm";
import { AGENT_PROMPTS } from "./prompts";
import { validateCoderResponse } from "./json-utils";

interface FileOperation {
  action: "create" | "edit" | "delete";
  path: string;
  content?: string;
}

export class CoderAgent {
  async execute(
    step: AgentStep,
    projectContext: string,
    signal?: AbortSignal
  ): Promise<{ operations: FileOperation[]; commands: string[] }> {
    const systemPrompt = AGENT_PROMPTS.coder;
    const userPrompt = this.buildUserPrompt(step, projectContext);

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      { role: "user", content: userPrompt },
    ];

    const { parsed, parseError } = await callLLMForJSON("coder", systemPrompt, messages, signal);

    if (!parsed) {
      console.error(`Coder: JSON extraction failed: ${parseError}`);
      return { operations: [], commands: [] };
    }

    const validation = validateCoderResponse(parsed);
    if (validation.errors.length > 0) {
      console.warn(`Coder: validation issues: ${validation.errors.join(", ")}`);
    }

    return {
      operations: validation.operations as FileOperation[],
      commands: validation.commands,
    };
  }

  private buildUserPrompt(step: AgentStep, projectContext: string): string {
    let prompt = `## Current Project Files:\n${projectContext}\n\n`;
    prompt += `## Task:\n${step.description}\n\n`;

    if (step.filesAffected.length > 0) {
      prompt += `## Files to create/modify:\n${step.filesAffected.join("\n")}\n\n`;
    }

    // Architecture hints based on step type
    if (step.type === "config") {
      prompt += `## Instructions:\nThis is a configuration/setup step. Only run shell commands (npm install) and create/modify config files. Do NOT create React components.\n\n`;
    } else if (step.description.toLowerCase().includes("type") || step.description.toLowerCase().includes("interface")) {
      prompt += `## Instructions:\nCreate TypeScript types and interfaces. Export all types as named exports from src/types/index.ts.\n\n`;
    } else if (step.description.toLowerCase().includes("layout")) {
      prompt += `## Instructions:\nCreate layout components. The Layout component should use React Router's <Outlet /> for nested page content. Include responsive sidebar/header.\n\n`;
    } else if (step.description.toLowerCase().includes("ui component")) {
      prompt += `## Instructions:\nCreate reusable UI components. Each must have a TypeScript props interface, support variants via props, include hover/focus/disabled states, and use only Tailwind classes.\n\n`;
    }

    prompt += `## Output Rules:
- Respond ONLY with JSON: { "operations": [...], "commands": [...] }
- Each operation: { "action": "create"|"edit"|"delete", "path": "...", "content": "full file content" }
- Every file must be COMPLETE and syntactically valid — never partial
- Maximum ~150 lines per file — split large components
- Use named exports, not default exports
- Import from relative paths matching the file structure`;

    return prompt;
  }
}
