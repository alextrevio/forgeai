import { callLLMForJSON } from "./llm";
import { AGENT_PROMPTS } from "./prompts";
import { validateDebuggerResponse } from "./json-utils";

interface FileOperation {
  action: "create" | "edit" | "delete";
  path: string;
  content?: string;
}

export interface DebugResult {
  fixed: boolean;
  operations: FileOperation[];
  commands: string[];
  explanation: string;
}

export class DebuggerAgent {
  private maxAttempts = 3;

  async diagnoseAndFix(
    error: string,
    relevantFiles: Record<string, string>,
    projectContext: string,
    attempt: number,
    signal?: AbortSignal
  ): Promise<DebugResult> {
    if (attempt > this.maxAttempts) {
      return {
        fixed: false,
        operations: [],
        commands: [],
        explanation: `Failed to fix after ${this.maxAttempts} attempts. Error: ${error}`,
      };
    }

    const systemPrompt = AGENT_PROMPTS.debugger;

    const filesContext = Object.entries(relevantFiles)
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join("\n\n");

    // Classify the error for better diagnosis
    const errorCategory = this.classifyError(error);

    const userPrompt = `## Error (attempt ${attempt}/${this.maxAttempts}):
${error}

## Error Category: ${errorCategory}

## Project Context:
${projectContext}

## Relevant Files:
${filesContext}

## Fix Strategy for "${errorCategory}" errors:
${this.getFixStrategy(errorCategory)}

Diagnose the error and provide a MINIMAL fix. Do not refactor unrelated code.

Respond with JSON:
{
  "diagnosis": "What caused the error",
  "fix_description": "What the fix does",
  "operations": [{ "action": "edit", "path": "...", "content": "full file content" }],
  "commands": []
}`;

    const { parsed, parseError } = await callLLMForJSON("debugger", systemPrompt, [
      { role: "user", content: userPrompt },
    ], signal);

    if (!parsed) {
      console.error(`Debugger: JSON extraction failed: ${parseError}`);
      return {
        fixed: false,
        operations: [],
        commands: [],
        explanation: "Failed to parse debugger response",
      };
    }

    const validation = validateDebuggerResponse(parsed);
    if (!validation.data) {
      return {
        fixed: false,
        operations: [],
        commands: [],
        explanation: `Debugger response validation failed: ${validation.errors.join(", ")}`,
      };
    }

    return {
      fixed: true,
      operations: validation.data.operations as FileOperation[],
      commands: validation.data.commands,
      explanation: `${validation.data.diagnosis}\nFix: ${validation.data.fix_description}`,
    };
  }

  classifyError(error: string): string {
    const lower = error.toLowerCase();

    if (lower.includes("cannot find module") || lower.includes("module not found") || lower.includes("failed to resolve import")) {
      return "MISSING_MODULE";
    }
    if (lower.includes("has no exported member") || lower.includes("is not exported")) {
      return "MISSING_EXPORT";
    }
    if (lower.includes("is not assignable to") || lower.includes("type error")) {
      return "TYPE_MISMATCH";
    }
    if (lower.includes("property") && lower.includes("does not exist on type")) {
      return "MISSING_PROPERTY";
    }
    if (lower.includes("cannot find name")) {
      return "MISSING_IMPORT";
    }
    if (lower.includes("syntaxerror") || lower.includes("unexpected token") || lower.includes("parsing error")) {
      return "SYNTAX_ERROR";
    }
    if (lower.includes("jsx") || lower.includes("closing tag")) {
      return "JSX_ERROR";
    }
    if (lower.includes("[plugin:vite") || lower.includes("pre-transform error")) {
      return "VITE_BUILD_ERROR";
    }
    if (lower.includes("error ts")) {
      return "TYPESCRIPT_ERROR";
    }

    return "UNKNOWN";
  }

  private getFixStrategy(category: string): string {
    const strategies: Record<string, string> = {
      MISSING_MODULE: "Check if the import path is correct. If the module is a file in the project, verify the path matches the actual file location. If it's an npm package, add an 'npm install' command.",
      MISSING_EXPORT: "Check the source file and add the missing named export. Or fix the import to use the correct export name.",
      TYPE_MISMATCH: "Compare the expected type with the actual type. Add proper type annotations or fix the value to match the expected type. Avoid using 'any'.",
      MISSING_PROPERTY: "Add the missing property to the TypeScript interface/type, or fix the property name if it's a typo.",
      MISSING_IMPORT: "Add the missing import statement at the top of the file. Check which module exports this symbol.",
      SYNTAX_ERROR: "Fix the syntax — usually a missing bracket, parenthesis, comma, or semicolon.",
      JSX_ERROR: "Fix JSX syntax — ensure all tags are properly opened and closed, and expressions are wrapped in {}.",
      VITE_BUILD_ERROR: "This is a Vite build/transform error. Check for CSS syntax issues, invalid imports, or missing file references.",
      TYPESCRIPT_ERROR: "General TypeScript error — read the error code (TSxxxx) for specific guidance.",
      UNKNOWN: "Read the error carefully, identify the root cause, and apply a minimal fix.",
    };
    return strategies[category] || strategies.UNKNOWN;
  }

  parseCompilationErrors(output: string): string[] {
    const errors: string[] = [];
    const lines = output.split("\n");
    let currentError = "";

    for (const line of lines) {
      // Match TypeScript errors, Vite errors, and common error patterns
      if (
        line.includes("error TS") ||
        line.includes("ERROR") ||
        line.includes("SyntaxError") ||
        line.includes("Cannot find") ||
        line.includes("Module not found") ||
        line.includes("is not assignable") ||
        line.includes("has no exported member") ||
        line.includes("Property") && line.includes("does not exist") ||
        line.includes("[plugin:vite") ||
        line.includes("Pre-transform error") ||
        line.includes("Failed to resolve import") ||
        line.includes("Unexpected token")
      ) {
        if (currentError) errors.push(currentError.trim());
        currentError = line;
      } else if (currentError && line.trim()) {
        currentError += "\n" + line;
      }
    }
    if (currentError) errors.push(currentError.trim());

    return errors;
  }

  parseViteErrors(stderr: string): string[] {
    const errors: string[] = [];

    // Vite-specific error patterns
    const viteErrorRegex = /\[vite\].*?(?:error|Error)[\s\S]*?(?=\n\n|\n\[vite\]|$)/g;
    const matches = stderr.match(viteErrorRegex);
    if (matches) {
      errors.push(...matches);
    }

    // HMR errors
    const hmrErrorRegex = /\[hmr\].*?error[\s\S]*?(?=\n\n|$)/gi;
    const hmrMatches = stderr.match(hmrErrorRegex);
    if (hmrMatches) {
      errors.push(...hmrMatches);
    }

    // Plugin errors (e.g., [plugin:vite:css])
    const pluginErrorRegex = /\[plugin:[\w:-]+\][\s\S]*?(?=\n\n|$)/g;
    const pluginMatches = stderr.match(pluginErrorRegex);
    if (pluginMatches) {
      errors.push(...pluginMatches);
    }

    // Generic transform/compile errors
    if (errors.length === 0) {
      const genericErrors = this.parseCompilationErrors(stderr);
      errors.push(...genericErrors);
    }

    return errors;
  }

  extractAffectedFiles(errorOutput: string): string[] {
    const filePatterns = [
      /src\/[\w/.-]+\.\w+/g,           // src/path/file.ext
      /\.\/[\w/.-]+\.\w+/g,             // ./path/file.ext
      /(?:at |in |file: )([^\s:]+)/g,   // at file:line or in file
    ];

    const files = new Set<string>();
    for (const pattern of filePatterns) {
      const matches = errorOutput.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleaned = match
            .replace(/^(at |in |file: )/, "")
            .replace(/^\.\//, "")
            .replace(/:.*$/, "");
          if (cleaned.includes(".") && !cleaned.includes("node_modules")) {
            files.add(cleaned);
          }
        }
      }
    }

    return [...files];
  }
}
