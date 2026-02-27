import { BaseAgent, type AgentContext } from "./base-agent";
import { CoderAgentRunner } from "./coder-agent";
import { ResearchAgentRunner } from "./research-agent";
import { DesignerAgentRunner } from "./designer-agent";
import { WriterAgentRunner } from "./writer-agent";
import { QAAgentRunner } from "./qa-agent";
import { DeployAgentRunner } from "./deploy-agent";
import { AnalystAgentRunner } from "./analyst-agent";

// ══════════════════════════════════════════════════════════════════
// AGENT FACTORY — Creates the right runner for each agent type
// ══════════════════════════════════════════════════════════════════

export class AgentFactory {
  static create(agentType: string, ctx: AgentContext): BaseAgent {
    switch (agentType) {
      case "coder":
        return new CoderAgentRunner(ctx);

      case "designer":
        return new CoderAgentRunner(ctx, "designer");

      case "qa":
        return new CoderAgentRunner(ctx, "qa");

      case "research":
        return new ResearchAgentRunner(ctx);

      case "analyst":
        return new AnalystAgentRunner(ctx);

      case "writer":
        return new WriterAgentRunner(ctx);

      case "deploy":
        return new DeployAgentRunner(ctx);

      default:
        // Fallback to coder for unknown agent types
        return new CoderAgentRunner(ctx);
    }
  }
}
