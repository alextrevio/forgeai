import { AgentPlan, AgentStep, CodeChange } from "@forgeai/shared";
import { PlannerAgent } from "./planner";
import { CoderAgent } from "./coder";
import { DesignerAgent } from "./designer";
import { DebuggerAgent } from "./debugger";
import { ReviewerAgent, type ReviewReport } from "./reviewer";
import { DeployerAgent, type DeployResult } from "./deployer";

export interface OrchestratorCallbacks {
  onThinking: (content: string) => void;
  onPlan: (plan: AgentPlan) => void;
  onStepStart: (step: AgentStep) => void;
  onStepComplete: (step: AgentStep) => void;
  onStepMessage: (message: string) => void;
  onCodeChange: (change: CodeChange) => void;
  onFileChanged: (path: string) => void;
  onTerminalOutput: (output: string) => void;
  onError: (message: string) => void;
  onComplete: (summary: string) => void;
  onPreviewReload: () => void;
  onDesignerStart: () => void;
  onDesignerComplete: () => void;
  onDebuggerStart: () => void;
  onDebuggerFix: (explanation: string) => void;
  onDebuggerFailed: (error: string) => void;
  onReviewerStart: () => void;
  onReviewerReport: (report: ReviewReport) => void;
  onDeployStart: () => void;
  onDeployComplete: (result: DeployResult) => void;
  onDeployFailed: (error: string) => void;
}

export interface SandboxInterface {
  executeCommand: (command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  deleteFile: (path: string) => Promise<void>;
  getFileTree: () => Promise<any[]>;
  getPreviewUrl?: () => Promise<string>;
}

export class Orchestrator {
  private planner = new PlannerAgent();
  private coder = new CoderAgent();
  private designer = new DesignerAgent();
  private debugger_ = new DebuggerAgent();
  private reviewer = new ReviewerAgent();
  private deployer = new DeployerAgent();
  private isFirstRun = true;
  private hadErrors = false;

  // Track all created files across steps for richer context
  private createdFiles = new Map<string, string>();

  async run(
    userMessage: string,
    projectContext: string,
    sandbox: SandboxInterface,
    callbacks: OrchestratorCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    try {
      // Step 1: Plan with deep analysis
      callbacks.onThinking("Analyzing your request and creating a comprehensive plan...");
      const plan = await this.planner.createPlan(userMessage, projectContext, signal);
      callbacks.onPlan(plan);

      // Step 2: Execute steps — group independent ones for parallel execution
      const stepGroups = this.groupStepsByDependencies(plan.steps);

      for (const group of stepGroups) {
        if (signal?.aborted) {
          callbacks.onError("Agent execution was stopped by user");
          return;
        }

        // Execute independent steps in parallel
        if (group.length > 1) {
          callbacks.onThinking(`Executing ${group.length} steps in parallel...`);
          await Promise.all(group.map((step) =>
            this.executeStep(step, plan, projectContext, sandbox, callbacks, signal)
              .catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                callbacks.onError(`Step "${step.description}" failed: ${msg}`);
              })
          ));
          // Rebuild context once from the sandbox after all parallel steps complete
          // to avoid race where the last step's context overwrites others
          if (!signal?.aborted) {
            projectContext = await this.buildProjectContext(sandbox, projectContext);
          }
        } else {
          const step = group[0];
          const newCtx = await this.executeStep(step, plan, projectContext, sandbox, callbacks, signal);
          if (newCtx) projectContext = newCtx;
        }
      }

      // === REVIEWER PHASE — only if debugger found errors during execution ===
      if (!signal?.aborted && this.hadErrors) {
        callbacks.onReviewerStart();
        callbacks.onThinking("Reviewing code quality and best practices...");
        try {
          const allFiles = await this.readAllProjectFiles(sandbox);
          const report = await this.reviewer.review(allFiles, projectContext, signal);
          callbacks.onReviewerReport(report);

          if (report.autoFixes.length > 0) {
            for (const fix of report.autoFixes) {
              if (fix.content) {
                await sandbox.writeFile(fix.path, fix.content);
                callbacks.onCodeChange({ file: fix.path, action: fix.action, content: fix.content });
                callbacks.onFileChanged(fix.path);
              }
            }
            callbacks.onPreviewReload();
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          callbacks.onError(`Reviewer error (non-fatal): ${msg}`);
        }
      }

      callbacks.onPreviewReload();

      const completedSteps = plan.steps.filter((s) => s.status === "completed").length;
      const totalSteps = plan.steps.length;
      callbacks.onComplete(
        `Completed ${completedSteps}/${totalSteps} steps. ${plan.understanding}`
      );

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      callbacks.onError(`Agent error: ${errorMessage}`);
    }
  }

  async deploy(
    sandbox: SandboxInterface,
    projectId: string,
    callbacks: OrchestratorCallbacks,
    signal?: AbortSignal
  ): Promise<DeployResult> {
    callbacks.onDeployStart();
    try {
      const result = await this.deployer.deploy(
        sandbox, projectId,
        (log) => callbacks.onTerminalOutput(log),
        signal
      );
      if (result.success) {
        callbacks.onDeployComplete(result);
      } else {
        callbacks.onDeployFailed(result.logs.join("\n"));
      }
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      callbacks.onDeployFailed(msg);
      return { success: false, url: null, logs: [msg], buildTime: 0 };
    }
  }

  /**
   * Group steps by their dependencies so independent steps can run in parallel.
   * Returns arrays of step groups — each group contains steps that can execute concurrently.
   */
  private groupStepsByDependencies(steps: AgentStep[]): AgentStep[][] {
    const groups: AgentStep[][] = [];
    const completed = new Set<number>();

    let remaining = [...steps];
    while (remaining.length > 0) {
      // Find steps whose dependencies are all in the completed set
      const ready = remaining.filter((step) =>
        step.dependencies.every((depId) => completed.has(depId))
      );

      if (ready.length === 0) {
        // Avoid infinite loop — just run remaining sequentially
        groups.push(...remaining.map((s) => [s]));
        break;
      }

      groups.push(ready);
      for (const step of ready) {
        completed.add(step.id);
      }
      remaining = remaining.filter((s) => !completed.has(s.id));
    }

    return groups;
  }

  /**
   * Execute a single step: coder → designer → debugger
   * Returns updated project context, or null if aborted.
   */
  private async executeStep(
    step: AgentStep,
    plan: AgentPlan,
    projectContext: string,
    sandbox: SandboxInterface,
    callbacks: OrchestratorCallbacks,
    signal?: AbortSignal
  ): Promise<string | null> {
    if (signal?.aborted) return null;

    step.status = "in_progress";
    callbacks.onStepStart(step);
    callbacks.onThinking(`Working on: ${step.description}`);

    try {
      // Build enriched context for this step
      const stepContext = this.buildStepContext(projectContext, step, plan);

      // === CODER PHASE ===
      const result = await this.coder.execute(step, stepContext, signal);
      const modifiedFiles: Record<string, string> = {};

      for (const op of result.operations) {
        if (signal?.aborted) return null;
        switch (op.action) {
          case "create":
          case "edit":
            if (op.content) {
              await sandbox.writeFile(op.path, op.content);
              modifiedFiles[op.path] = op.content;
              this.createdFiles.set(op.path, op.content);
              callbacks.onCodeChange({ file: op.path, action: op.action, content: op.content });
              callbacks.onFileChanged(op.path);
            }
            break;
          case "delete":
            await sandbox.deleteFile(op.path);
            this.createdFiles.delete(op.path);
            callbacks.onCodeChange({ file: op.path, action: "delete" });
            callbacks.onFileChanged(op.path);
            break;
        }
      }

      for (const cmd of result.commands) {
        if (signal?.aborted) return null;
        callbacks.onTerminalOutput(`$ ${cmd}`);
        const cmdResult = await sandbox.executeCommand(cmd);
        if (cmdResult.stdout) callbacks.onTerminalOutput(cmdResult.stdout);
        if (cmdResult.stderr) callbacks.onTerminalOutput(cmdResult.stderr);
      }

      // === DESIGNER PHASE (after coder on UI steps) ===
      const isUIStep = step.type === "code" || step.type === "design";
      if (isUIStep && Object.keys(modifiedFiles).length > 0) {
        if (signal?.aborted) return null;
        callbacks.onDesignerStart();
        callbacks.onThinking("Designer is enhancing the visual design...");

        try {
          const designResult = await this.designer.review(
            step, modifiedFiles, stepContext, this.isFirstRun, signal
          );
          this.isFirstRun = false;

          for (const op of designResult.operations) {
            if (signal?.aborted) return null;
            if (op.action !== "delete" && op.content) {
              await sandbox.writeFile(op.path, op.content);
              this.createdFiles.set(op.path, op.content);
              callbacks.onCodeChange({ file: op.path, action: op.action, content: op.content });
              callbacks.onFileChanged(op.path);
            }
          }
          for (const cmd of designResult.commands) {
            if (signal?.aborted) return null;
            callbacks.onTerminalOutput(`$ ${cmd}`);
            const cmdResult = await sandbox.executeCommand(cmd);
            if (cmdResult.stdout) callbacks.onTerminalOutput(cmdResult.stdout);
            if (cmdResult.stderr) callbacks.onTerminalOutput(cmdResult.stderr);
          }
          callbacks.onDesignerComplete();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          callbacks.onError(`Designer error (non-fatal): ${msg}`);
          callbacks.onDesignerComplete();
        }
      }

      // === DEBUGGER PHASE (check for compilation errors + Vite errors) ===
      if (!signal?.aborted) {
        await this.checkAndFixErrors(sandbox, stepContext, callbacks, signal);
      }

      step.status = "completed";
      callbacks.onStepComplete(step);
      callbacks.onPreviewReload();

      // Emit a conversational message about what was just done (Manus-style)
      const stepMsg = this.generateStepMessage(step);
      if (stepMsg) callbacks.onStepMessage(stepMsg);

      // Update project context with new file tree and key file contents
      return await this.buildProjectContext(sandbox, projectContext);

    } catch (err) {
      step.status = "failed";
      callbacks.onStepComplete(step);
      const errorMessage = err instanceof Error ? err.message : String(err);
      callbacks.onError(`Step "${step.description}" failed: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Generate a natural-language conversational message after a step completes.
   * Uses keyword matching on the step description — no LLM call needed.
   */
  private generateStepMessage(step: AgentStep): string | null {
    const desc = step.description.toLowerCase();
    const files = step.filesAffected.length;

    if (desc.includes("install") || desc.includes("dependencies") || step.type === "config") {
      return "He instalado las dependencias necesarias para el proyecto. Ahora voy a crear la estructura de datos y los componentes.";
    }
    if (desc.includes("type") || desc.includes("store") || desc.includes("data") || desc.includes("interface")) {
      return "He creado los tipos TypeScript, el store de datos y las utilidades del proyecto. Ahora voy a construir los componentes de la interfaz.";
    }
    if (desc.includes("layout") || desc.includes("sidebar") || desc.includes("header")) {
      return "He creado los componentes de layout (sidebar, header, navegación). Ahora voy a crear los componentes de UI reutilizables.";
    }
    if (desc.includes("ui component") || desc.includes("button") || desc.includes("card") || desc.includes("shared")) {
      return `He creado ${files > 0 ? files + " componentes" : "los componentes"} de UI reutilizables. Ahora voy a crear las páginas y funcionalidades principales.`;
    }
    if (desc.includes("page") || desc.includes("section") || desc.includes("feature") || desc.includes("component")) {
      return `He creado ${files > 0 ? files + " archivos con" : ""} las páginas y componentes principales. Ahora voy a integrar todo y pulir el diseño.`;
    }
    if (desc.includes("router") || desc.includes("wire") || desc.includes("connect") || desc.includes("integration") || desc.includes("app.tsx")) {
      return "He integrado todos los componentes con el router y la navegación. Verificando que todo funcione correctamente.";
    }
    if (desc.includes("polish") || desc.includes("loading") || desc.includes("empty") || desc.includes("error state") || step.type === "design") {
      return "¡Listo! He terminado de pulir el diseño, animaciones y estados de carga. Tu aplicación está lista.";
    }

    // Generic fallback
    return `He completado: ${step.description}`;
  }

  private buildStepContext(baseContext: string, currentStep: AgentStep, plan: AgentPlan): string {
    let context = baseContext;

    // Add plan overview so the coder knows the full picture
    context += `\n\n--- Plan Overview ---\n`;
    context += `Understanding: ${plan.understanding}\n`;
    context += `Total steps: ${plan.steps.length}\n`;
    context += `Current step: #${currentStep.id} - ${currentStep.description}\n`;

    // Show what steps are completed (so coder knows what exists)
    const completedSteps = plan.steps.filter((s) => s.status === "completed");
    if (completedSteps.length > 0) {
      context += `\nCompleted steps:\n`;
      for (const s of completedSteps) {
        context += `  - Step #${s.id}: ${s.description} (files: ${s.filesAffected.join(", ")})\n`;
      }
    }

    // Show upcoming steps (so coder knows what's coming and can prepare imports)
    const upcomingSteps = plan.steps.filter((s) => s.status === "pending" && s.id !== currentStep.id);
    if (upcomingSteps.length > 0) {
      context += `\nUpcoming steps:\n`;
      for (const s of upcomingSteps.slice(0, 3)) {
        context += `  - Step #${s.id}: ${s.description} (files: ${s.filesAffected.join(", ")})\n`;
      }
    }

    // Include contents of files created so far (so coder can import from them)
    if (this.createdFiles.size > 0) {
      context += `\n--- Files Created So Far ---\n`;
      for (const [path, content] of this.createdFiles) {
        // Only include key files (types, stores, utils) — not all to avoid token waste
        if (
          path.includes("/types/") ||
          path.includes("/store/") ||
          path.includes("/lib/") ||
          path.includes("/hooks/") ||
          path.includes("App.tsx") ||
          path.includes("/layout/")
        ) {
          context += `\n--- ${path} ---\n${content}\n`;
        }
      }
    }

    return context;
  }

  private async buildProjectContext(sandbox: SandboxInterface, baseContext: string): Promise<string> {
    const fileTree = await sandbox.getFileTree();

    // Extract framework from base context
    const frameworkMatch = baseContext.match(/Framework: ([\w-]+)/);
    const framework = frameworkMatch?.[1] || "react-vite";

    // Extract custom instructions if present
    const customMatch = baseContext.match(/--- Custom Instructions ---\n([\s\S]*?)--- End Custom Instructions ---/);
    const customInstructions = customMatch?.[1] || "";

    let context = `Framework: ${framework}\n`;
    if (customInstructions) {
      context += `\n--- Custom Instructions ---\n${customInstructions}--- End Custom Instructions ---\n\n`;
    }
    context += `Project files:\n${JSON.stringify(fileTree, null, 2)}`;

    // Read key files for richer context
    const keyFiles = [
      "package.json",
      "src/App.tsx",
      "src/main.tsx",
      "src/types/index.ts",
      "src/store/app-store.ts",
      "src/lib/utils.ts",
    ];

    for (const file of keyFiles) {
      try {
        const content = await sandbox.readFile(file);
        context += `\n\n--- ${file} ---\n${content}`;
      } catch { /* skip if doesn't exist */ }
    }

    return context;
  }

  private async checkAndFixErrors(
    sandbox: SandboxInterface,
    projectContext: string,
    callbacks: OrchestratorCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    // Check TypeScript errors
    const checkResult = await sandbox.executeCommand("npx tsc --noEmit 2>&1 || true");
    const tscOutput = checkResult.stdout + "\n" + checkResult.stderr;
    const tscErrors = this.debugger_.parseCompilationErrors(tscOutput);

    // Also check Vite dev server for runtime errors (use actual sandbox port)
    let viteErrors: string[] = [];
    let viteStderr = "";
    if (sandbox.getPreviewUrl) {
      try {
        const previewUrl = await sandbox.getPreviewUrl();
        const viteCheck = await sandbox.executeCommand(`timeout 3 curl -s ${previewUrl} 2>&1 || true`);
        viteStderr = viteCheck.stderr || "";
        viteErrors = this.debugger_.parseViteErrors(viteStderr);
      } catch { /* preview URL unavailable, skip Vite check */ }
    }

    const allErrors = [...tscErrors, ...viteErrors];

    if (allErrors.length === 0) return;

    this.hadErrors = true;
    callbacks.onDebuggerStart();
    callbacks.onThinking(`Debugger detected ${allErrors.length} error(s), attempting fix...`);

    const errorText = allErrors.join("\n---\n");
    let attempt = 1;

    while (attempt <= 3) {
      if (signal?.aborted) return;

      // Extract affected files from error output
      const affectedPaths = this.debugger_.extractAffectedFiles(tscOutput + "\n" + viteStderr);
      const relevantFiles: Record<string, string> = {};

      for (const filePath of affectedPaths) {
        try { relevantFiles[filePath] = await sandbox.readFile(filePath); } catch { /* skip */ }
      }

      // If no files found from errors, check commonly referenced files
      if (Object.keys(relevantFiles).length === 0) {
        const fileMatches = (tscOutput + "\n" + viteStderr).match(/src\/[\w/.-]+\.\w+/g) || [];
        for (const filePath of [...new Set(fileMatches)]) {
          try { relevantFiles[filePath] = await sandbox.readFile(filePath); } catch { /* skip */ }
        }
      }

      const result = await this.debugger_.diagnoseAndFix(
        errorText, relevantFiles, projectContext, attempt, signal
      );

      if (!result.fixed) {
        callbacks.onDebuggerFailed(result.explanation);
        return;
      }

      for (const op of result.operations) {
        if (op.content) {
          await sandbox.writeFile(op.path, op.content);
          this.createdFiles.set(op.path, op.content);
          callbacks.onCodeChange({ file: op.path, action: op.action, content: op.content });
          callbacks.onFileChanged(op.path);
        }
      }
      for (const cmd of result.commands) {
        callbacks.onTerminalOutput(`$ ${cmd}`);
        const cmdRes = await sandbox.executeCommand(cmd);
        if (cmdRes.stdout) callbacks.onTerminalOutput(cmdRes.stdout);
        if (cmdRes.stderr) callbacks.onTerminalOutput(cmdRes.stderr);
      }

      callbacks.onDebuggerFix(result.explanation);

      // Re-check after fix
      const recheck = await sandbox.executeCommand("npx tsc --noEmit 2>&1 || true");
      const recheckErrors = this.debugger_.parseCompilationErrors(
        recheck.stdout + "\n" + recheck.stderr
      );
      if (recheckErrors.length === 0) return;

      attempt++;
    }

    callbacks.onDebuggerFailed(`Could not fix all errors after 3 attempts`);
  }

  private async readAllProjectFiles(sandbox: SandboxInterface): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const tree = await sandbox.getFileTree();

    const walk = async (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === "file" && !node.path.includes("node_modules")) {
          try { files[node.path] = await sandbox.readFile(node.path); } catch { /* skip */ }
        }
        if (node.children) await walk(node.children);
      }
    };

    await walk(tree);
    return files;
  }
}
