/**
 * Robust JSON extraction and validation utilities for LLM responses.
 *
 * LLMs often wrap JSON in markdown code blocks, add explanatory text,
 * or produce slightly malformed JSON. These utilities handle all those cases.
 */

// ─── JSON Extraction ────────────────────────────────────────────────

export interface ExtractionResult<T = unknown> {
  success: boolean;
  data: T | null;
  error?: string;
}

/**
 * Extract JSON from an LLM response using multiple fallback strategies:
 *   1. Direct JSON.parse
 *   2. Extract from ```json ... ``` code blocks
 *   3. Brace-matching to find the outermost { } or [ ]
 *   4. Attempt to repair common LLM JSON mistakes
 */
export function extractJSON<T = unknown>(response: string): ExtractionResult<T> {
  const trimmed = response.trim();
  if (!trimmed) {
    return { success: false, data: null, error: "Empty response" };
  }

  // Strategy 1: Direct parse
  try {
    return { success: true, data: JSON.parse(trimmed) as T };
  } catch {
    // continue to next strategy
  }

  // Strategy 2: Code-block extraction (```json ... ``` or ``` ... ```)
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const codeBlockMatch = trimmed.match(codeBlockRegex);
  if (codeBlockMatch?.[1]) {
    const inner = codeBlockMatch[1].trim();
    try {
      return { success: true, data: JSON.parse(inner) as T };
    } catch {
      // The code block content might still need brace matching
      const braceResult = extractByBraceMatching<T>(inner);
      if (braceResult.success) return braceResult;
    }
  }

  // Strategy 3: Brace matching — find the outermost { ... } or [ ... ]
  const braceResult = extractByBraceMatching<T>(trimmed);
  if (braceResult.success) return braceResult;

  // Strategy 4: Attempt to repair common issues
  const repairResult = attemptJSONRepair<T>(trimmed);
  if (repairResult.success) return repairResult;

  return {
    success: false,
    data: null,
    error: `Could not extract JSON from response (length: ${trimmed.length}). First 200 chars: ${trimmed.slice(0, 200)}`,
  };
}

/**
 * Find the outermost balanced { } or [ ] in a string and parse it.
 */
function extractByBraceMatching<T>(text: string): ExtractionResult<T> {
  // Try object first, then array
  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const startIdx = text.indexOf(open);
    if (startIdx === -1) continue;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIdx; i < text.length; i++) {
      const ch = text[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(startIdx, i + 1);
          try {
            return { success: true, data: JSON.parse(candidate) as T };
          } catch {
            // Brace-matched substring isn't valid JSON; try repairing it
            const repaired = attemptJSONRepair<T>(candidate);
            if (repaired.success) return repaired;
            break; // don't try further for this bracket type
          }
        }
      }
    }
  }

  return { success: false, data: null, error: "No balanced JSON structure found" };
}

/**
 * Attempt to fix common LLM JSON mistakes:
 *   - Trailing commas before } or ]
 *   - Single quotes instead of double quotes (outside of values)
 *   - Missing closing brackets (try to close them)
 *   - Unescaped newlines in string values
 */
function attemptJSONRepair<T>(text: string): ExtractionResult<T> {
  let repaired = text;

  // Fix 1: Remove trailing commas  →  ,} → }  and  ,] → ]
  repaired = repaired.replace(/,\s*([}\]])/g, "$1");

  // Fix 2: Try parsing after trailing-comma fix
  try {
    return { success: true, data: JSON.parse(repaired) as T };
  } catch {
    // continue
  }

  // Fix 3: Try to close unclosed brackets
  const closed = tryCloseBrackets(repaired);
  if (closed !== repaired) {
    try {
      return { success: true, data: JSON.parse(closed) as T };
    } catch {
      // continue
    }
  }

  return { success: false, data: null, error: "JSON repair failed" };
}

/**
 * Count open/close braces and brackets, append missing closing characters.
 * This handles the common case of truncated LLM responses.
 */
function tryCloseBrackets(text: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];

  for (const ch of text) {
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") {
      if (stack.length > 0 && stack[stack.length - 1] === ch) {
        stack.pop();
      }
    }
  }

  // If we're still inside a string, close it first
  if (inString) {
    text += '"';
  }

  // Close any remaining open brackets in reverse order
  while (stack.length > 0) {
    text += stack.pop();
  }

  return text;
}

// ─── Schema Validation ──────────────────────────────────────────────

/**
 * Validate a planner response has the expected shape.
 * Returns the data with defaults applied for missing optional fields.
 */
export function validatePlannerResponse(data: any): {
  valid: boolean;
  data: any;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, data: null, errors: ["Response is not an object"] };
  }

  // Required fields
  if (!data.understanding && !data.steps) {
    errors.push("Missing both 'understanding' and 'steps' fields");
  }

  // Ensure steps is an array
  if (data.steps && !Array.isArray(data.steps)) {
    errors.push("'steps' must be an array");
    data.steps = [];
  }

  // Validate each step has minimum required fields
  if (Array.isArray(data.steps)) {
    data.steps = data.steps.map((step: any, i: number) => ({
      id: step.id ?? i + 1,
      type: step.type || "code",
      agent: step.agent || "coder",
      description: step.description || `Step ${i + 1}`,
      filesAffected: Array.isArray(step.filesAffected) ? step.filesAffected : [],
      dependencies: Array.isArray(step.dependencies) ? step.dependencies : [],
      status: "pending",
      ...(step.layer ? { layer: step.layer } : {}),
    }));
  }

  // Apply defaults for optional fields
  data.understanding = data.understanding || "";
  data.appType = data.appType || "other";
  data.complexity = data.complexity || "medium";
  data.dataModels = Array.isArray(data.dataModels) ? data.dataModels : [];
  data.pages = Array.isArray(data.pages) ? data.pages : [];
  data.fileManifest = Array.isArray(data.fileManifest) ? data.fileManifest : [];

  return { valid: errors.length === 0, data, errors };
}

/**
 * Validate a coder response has operations and commands.
 */
export function validateCoderResponse(data: any): {
  valid: boolean;
  operations: Array<{ action: string; path: string; content?: string }>;
  commands: string[];
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, operations: [], commands: [], errors: ["Response is not an object"] };
  }

  let operations: any[] = [];
  let commands: string[] = [];

  // Handle array format (legacy)
  if (Array.isArray(data)) {
    const commandsEntry = data.find((item: any) => item._commands);
    operations = data.filter((item: any) => !item._commands);
    commands = commandsEntry?._commands || [];
  } else {
    operations = Array.isArray(data.operations) ? data.operations : [];
    commands = Array.isArray(data.commands) ? data.commands : [];
  }

  // Validate operations
  operations = operations.filter((op: any) => {
    if (!op.path || typeof op.path !== "string") {
      errors.push(`Operation missing 'path' field`);
      return false;
    }
    if (!op.action || !["create", "edit", "delete"].includes(op.action)) {
      // Default to "create" if action is missing but path and content exist
      op.action = op.content ? "create" : "delete";
    }
    if ((op.action === "create" || op.action === "edit") && !op.content) {
      errors.push(`Operation for ${op.path} missing 'content' field`);
      return false;
    }
    // Normalize path (remove leading ./)
    op.path = op.path.replace(/^\.\//, "");
    return true;
  });

  // Validate commands are strings
  commands = commands.filter((cmd: any) => typeof cmd === "string" && cmd.trim().length > 0);

  return { valid: true, operations, commands, errors };
}

/**
 * Validate a designer response (same shape as coder).
 */
export function validateDesignerResponse(data: any) {
  return validateCoderResponse(data);
}

/**
 * Validate a debugger response has diagnosis and fix info.
 */
export function validateDebuggerResponse(data: any): {
  valid: boolean;
  data: {
    diagnosis: string;
    fix_description: string;
    operations: Array<{ action: string; path: string; content?: string }>;
    commands: string[];
  } | null;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, data: null, errors: ["Response is not an object"] };
  }

  const result = {
    diagnosis: data.diagnosis || data.error || "Unknown error",
    fix_description: data.fix_description || data.fix || "Applied fix",
    operations: Array.isArray(data.operations) ? data.operations : [],
    commands: Array.isArray(data.commands) ? data.commands : [],
  };

  // Validate operations
  result.operations = result.operations.filter((op: any) => {
    if (!op.path) return false;
    if ((op.action === "create" || op.action === "edit") && !op.content) return false;
    op.path = op.path.replace(/^\.\//, "");
    return true;
  });

  return { valid: true, data: result, errors };
}

/**
 * Validate a reviewer response has issues, summary, score, and autoFixes.
 */
export function validateReviewerResponse(data: any): {
  valid: boolean;
  data: {
    issues: Array<{
      severity: string;
      file: string;
      line?: number;
      message: string;
      suggestion: string;
    }>;
    summary: string;
    score: number;
    autoFixes: Array<{ action: string; path: string; content?: string }>;
  };
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return {
      valid: false,
      data: { issues: [], summary: "Review parsing failed", score: 50, autoFixes: [] },
      errors: ["Response is not an object"],
    };
  }

  const result = {
    issues: Array.isArray(data.issues) ? data.issues : [],
    summary: data.summary || "Review complete",
    score: typeof data.score === "number" ? Math.min(100, Math.max(0, data.score)) : 70,
    autoFixes: Array.isArray(data.autoFixes) ? data.autoFixes : [],
  };

  // Validate autoFixes
  result.autoFixes = result.autoFixes.filter((op: any) => {
    if (!op.path) return false;
    if (!op.content) return false;
    op.path = op.path.replace(/^\.\//, "");
    op.action = op.action || "edit";
    return true;
  });

  return { valid: true, data: result, errors };
}
