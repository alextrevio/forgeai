import { callLLM, callLLMForJSON, LLM_CONFIGS } from "@forgeai/agents";
import type { LLMConfig } from "@forgeai/agents";
import { logger } from "../lib/logger";
import { usageTracker } from "./usage-tracker";

// ══════════════════════════════════════════════════════════════════
// MODEL CONFIGURATION PER AGENT TYPE
// ══════════════════════════════════════════════════════════════════

export interface ModelConfig {
  provider: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

const MODEL_CONFIG: Record<string, ModelConfig> = {
  planner: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 4096,
    temperature: 0.3,
  },
  coder: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 8192,
    temperature: 0.2,
  },
  research: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 4096,
    temperature: 0.4,
  },
  designer: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 4096,
    temperature: 0.5,
  },
  analyst: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 4096,
    temperature: 0.2,
  },
  writer: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 4096,
    temperature: 0.6,
  },
  deploy: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 4096,
    temperature: 0.1,
  },
  qa: {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    maxTokens: 4096,
    temperature: 0.1,
  },
};

// ══════════════════════════════════════════════════════════════════
// MODEL ROUTER
// ══════════════════════════════════════════════════════════════════

export class ModelRouter {
  /**
   * Get the full model configuration for an agent type.
   */
  getModelConfig(agentType: string): ModelConfig {
    return MODEL_CONFIG[agentType] || MODEL_CONFIG.coder;
  }

  /**
   * Get just the model name for an agent type.
   */
  getModelName(agentType: string): string {
    return this.getModelConfig(agentType).model;
  }

  /**
   * Apply the model configuration for an agent type to the underlying LLM_CONFIGS
   * so that callLLM/callLLMForJSON picks up the correct model.
   */
  private applyConfig(agentType: string, overrideModel?: string): void {
    const config = this.getModelConfig(agentType);
    const llmConfig: LLMConfig = {
      model: overrideModel || config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    };
    // Update the shared LLM_CONFIGS so callLLM uses the correct model
    LLM_CONFIGS[agentType] = llmConfig;
  }

  /**
   * Call the LLM with the optimal model for the given agent type.
   * Returns the raw string response.
   */
  async callModel(
    agentType: string,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    signal?: AbortSignal
  ): Promise<{ text: string; model: string }> {
    this.applyConfig(agentType);
    const model = this.getModelName(agentType);

    logger.info({ agentType, model }, "ModelRouter: calling LLM");

    const text = await callLLM(agentType, systemPrompt, messages, signal);
    return { text, model };
  }

  /**
   * Call the LLM and extract JSON, using the optimal model for the agent type.
   */
  async callModelForJSON<T = unknown>(
    agentType: string,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    signal?: AbortSignal
  ): Promise<{ text: string; parsed: T | null; parseError?: string; model: string }> {
    this.applyConfig(agentType);
    const model = this.getModelName(agentType);

    logger.info({ agentType, model }, "ModelRouter: calling LLM for JSON");

    const result = await callLLMForJSON<T>(agentType, systemPrompt, messages, signal);
    return { ...result, model };
  }

  /**
   * Call the LLM with an optional model override (e.g. user picks a different model).
   */
  async callModelWithOverride<T = unknown>(
    agentType: string,
    overrideModel: string | undefined,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    signal?: AbortSignal
  ): Promise<{ text: string; parsed: T | null; parseError?: string; model: string }> {
    this.applyConfig(agentType, overrideModel);
    const model = overrideModel || this.getModelName(agentType);

    logger.info({ agentType, model, override: !!overrideModel }, "ModelRouter: calling LLM with override");

    const result = await callLLMForJSON<T>(agentType, systemPrompt, messages, signal);
    return { ...result, model };
  }

  /**
   * Call the LLM and track usage (tokens + cost).
   * This is the preferred method when user/project context is available.
   */
  async callModelTracked(
    agentType: string,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    ctx: { userId: string; projectId?: string; taskId?: string; action: string },
    signal?: AbortSignal
  ): Promise<{ text: string; model: string }> {
    const config = this.getModelConfig(agentType);
    const result = await this.callModel(agentType, systemPrompt, messages, signal);

    // Estimate tokens from input/output text
    const inputText = systemPrompt + messages.map((m) => m.content).join("");
    const inputTokens = usageTracker.estimateTokens(inputText);
    const outputTokens = usageTracker.estimateTokens(result.text);

    // Track usage (fire-and-forget, don't block response)
    usageTracker.trackUsage({
      userId: ctx.userId,
      projectId: ctx.projectId,
      taskId: ctx.taskId,
      provider: config.provider,
      model: result.model,
      inputTokens,
      outputTokens,
      agentType,
      action: ctx.action,
    }).catch((err) => {
      logger.warn({ err: err.message, agentType, userId: ctx.userId }, "Usage tracking failed");
    });

    return result;
  }

  /**
   * Call the LLM for JSON and track usage.
   */
  async callModelForJSONTracked<T = unknown>(
    agentType: string,
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    ctx: { userId: string; projectId?: string; taskId?: string; action: string },
    signal?: AbortSignal
  ): Promise<{ text: string; parsed: T | null; parseError?: string; model: string }> {
    const config = this.getModelConfig(agentType);
    const result = await this.callModelForJSON<T>(agentType, systemPrompt, messages, signal);

    const inputText = systemPrompt + messages.map((m) => m.content).join("");
    const inputTokens = usageTracker.estimateTokens(inputText);
    const outputTokens = usageTracker.estimateTokens(result.text);

    usageTracker.trackUsage({
      userId: ctx.userId,
      projectId: ctx.projectId,
      taskId: ctx.taskId,
      provider: config.provider,
      model: result.model,
      inputTokens,
      outputTokens,
      agentType,
      action: ctx.action,
    }).catch((err) => {
      logger.warn({ err: err.message, agentType, userId: ctx.userId }, "Usage tracking failed");
    });

    return result;
  }

  /**
   * List all model configurations.
   */
  getAllConfigs(): Record<string, ModelConfig> {
    return { ...MODEL_CONFIG };
  }
}

// Singleton instance
export const modelRouter = new ModelRouter();
