import { callLLMForJSON } from "./llm";
import { AGENT_PROMPTS } from "./prompts";
import { validateReviewerResponse } from "./json-utils";

interface FileOperation {
  action: "create" | "edit" | "delete";
  path: string;
  content?: string;
}

export interface ReviewIssue {
  severity: "error" | "warning" | "info" | "auto_fixable";
  file: string;
  line?: number;
  message: string;
  suggestion: string;
}

export interface ReviewReport {
  issues: ReviewIssue[];
  summary: string;
  score: number; // 0-100
  autoFixes: FileOperation[];
}

export class ReviewerAgent {
  async review(
    allFiles: Record<string, string>,
    projectContext: string,
    signal?: AbortSignal
  ): Promise<ReviewReport> {
    const systemPrompt = AGENT_PROMPTS.reviewer;

    const filesContext = Object.entries(allFiles)
      .filter(([path]) => !path.includes("node_modules") && !path.includes("package-lock"))
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join("\n\n");

    const userPrompt = `## Project Context:\n${projectContext}\n\n## All Project Files:\n${filesContext}\n\nReview ALL files for:
1. Unused imports
2. Missing TypeScript types (any types)
3. Components that aren't exported properly
4. Orphaned files (created but never imported)
5. Accessibility issues (missing alt tags, aria-labels, semantic HTML)
6. Error handling gaps
7. Security issues

For issues marked "auto_fixable", also provide the fixed file content.

Respond with JSON:
{
  "issues": [
    {
      "severity": "error|warning|info|auto_fixable",
      "file": "src/App.tsx",
      "line": 42,
      "message": "Description",
      "suggestion": "How to fix"
    }
  ],
  "summary": "Overall review summary",
  "score": 85,
  "autoFixes": [
    { "action": "edit", "path": "src/App.tsx", "content": "full fixed content" }
  ]
}`;

    const { parsed, parseError } = await callLLMForJSON("reviewer", systemPrompt, [
      { role: "user", content: userPrompt },
    ], signal);

    if (!parsed) {
      console.error(`Reviewer: JSON extraction failed: ${parseError}`);
      return {
        issues: [],
        summary: "Review completed but response parsing failed",
        score: 50,
        autoFixes: [],
      };
    }

    const validation = validateReviewerResponse(parsed);
    if (validation.errors.length > 0) {
      console.warn(`Reviewer: validation issues: ${validation.errors.join(", ")}`);
    }

    return {
      issues: validation.data.issues as ReviewIssue[],
      summary: validation.data.summary,
      score: validation.data.score,
      autoFixes: validation.data.autoFixes as FileOperation[],
    };
  }
}
