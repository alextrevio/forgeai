import { AgentStep } from "@forgeai/shared";
import { callLLMForJSON } from "./llm";
import { AGENT_PROMPTS } from "./prompts";
import { validateDesignerResponse } from "./json-utils";

interface FileOperation {
  action: "create" | "edit" | "delete";
  path: string;
  content?: string;
}

export class DesignerAgent {
  async review(
    step: AgentStep,
    currentFiles: Record<string, string>,
    projectContext: string,
    isNewProject: boolean,
    signal?: AbortSignal
  ): Promise<{ operations: FileOperation[]; commands: string[] }> {
    const systemPrompt = AGENT_PROMPTS.designer;

    const filesContext = Object.entries(currentFiles)
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join("\n\n");

    let userPrompt = `## Project Context:\n${projectContext}\n\n`;
    userPrompt += `## Current Files After Coder:\n${filesContext}\n\n`;
    userPrompt += `## Step Completed:\n${step.description}\n\n`;

    if (isNewProject) {
      userPrompt += `This is a NEW project. You MUST:
1. Create tailwind.config.ts with custom theme (colors matching the app type, fonts, animations)
2. Create src/lib/utils.ts with the cn() class merging utility using clsx + tailwind-merge
3. Review and enhance the visual design of ALL components the coder created

Choose a color palette that matches the app's purpose:
- Dashboard/Analytics → Blue primary, slate neutrals
- E-commerce → Amber/orange primary, warm neutrals
- Healthcare → Teal/green primary
- Finance → Deep indigo primary
- Social/Creative → Purple/pink primary
- Developer Tools → Green primary

`;
    } else {
      userPrompt += `This is an EXISTING project. Review only the modified files and ensure:
- Visual consistency with existing design system
- All interactive elements have hover/focus states
- Transitions on state changes
- Responsive at all breakpoints

`;
    }

    userPrompt += `## Design Review Checklist:
- [ ] Interactive elements have hover/focus/active states
- [ ] Transitions (transition-colors/all duration-200)
- [ ] Consistent border-radius and shadows
- [ ] Mobile-first responsive design
- [ ] Dark mode variants (dark:)
- [ ] Loading/empty/error states where appropriate
- [ ] Icons from lucide-react (not emoji)
- [ ] Professional spacing and whitespace

Respond with JSON: { "operations": [...], "commands": [] }
Each operation: { "action": "create"|"edit", "path": "...", "content": "full file content" }`;

    const { parsed, parseError } = await callLLMForJSON(
      "designer", systemPrompt, [{ role: "user", content: userPrompt }], signal
    );

    if (!parsed) {
      console.error(`Designer: JSON extraction failed: ${parseError}`);
      return { operations: [], commands: [] };
    }

    const validation = validateDesignerResponse(parsed);
    if (validation.errors.length > 0) {
      console.warn(`Designer: validation issues: ${validation.errors.join(", ")}`);
    }

    return {
      operations: validation.operations as FileOperation[],
      commands: validation.commands,
    };
  }
}
