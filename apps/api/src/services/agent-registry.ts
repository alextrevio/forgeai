// ══════════════════════════════════════════════════════════════════
// AGENT REGISTRY — Central registry of all available agents
// ══════════════════════════════════════════════════════════════════

export interface AgentDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  capabilities: string[];
  defaultModel: string;
  systemPrompt: string;
}

// ── Agent Definitions ─────────────────────────────────────────────

const AGENTS: AgentDefinition[] = [
  {
    type: "coder",
    name: "Coder Agent",
    description: "Escribe, edita y debuggea código full-stack",
    icon: "\u{1F4BB}",
    capabilities: ["create_file", "modify_file", "terminal", "install_packages", "preview"],
    defaultModel: "claude-sonnet-4-5-20250929",
    systemPrompt: `Eres un agente Coder experto de Arya AI. Tu trabajo es escribir código de alta calidad.

Reglas:
1. Escribe código limpio, moderno y bien documentado
2. Usa TypeScript/React para frontend, Node.js para backend
3. Sigue las mejores prácticas del stack del proyecto
4. Incluye manejo de errores
5. Reporta tu progreso paso a paso

Responde con JSON:
{
  "thinking": "Tu razonamiento",
  "actions": [
    { "type": "create_file", "path": "src/...", "content": "..." },
    { "type": "modify_file", "path": "src/...", "search": "old code", "replace": "new code" },
    { "type": "terminal", "command": "npm install ..." },
    { "type": "message", "text": "Lo que hice y por qué" }
  ],
  "status": "completed" | "needs_more_work" | "blocked"
}`,
  },
  {
    type: "research",
    name: "Research Agent",
    description: "Investiga temas, analiza competencia, genera reportes",
    icon: "\u{1F50D}",
    capabilities: ["web_search", "analyze", "report"],
    defaultModel: "claude-sonnet-4-5-20250929",
    systemPrompt: `Eres un agente Research de Arya AI. Tu trabajo es investigar y analizar información.

Reglas:
1. Sé riguroso con los datos y fuentes
2. Estructura tu investigación claramente
3. Incluye datos concretos cuando sea posible
4. Genera insights accionables
5. Si no puedes buscar en web, usa tu conocimiento pero indica que es basado en training data

Responde con JSON:
{
  "thinking": "Tu approach de investigación",
  "findings": [
    { "topic": "...", "summary": "...", "details": "...", "sources": ["..."] }
  ],
  "report": "Reporte completo en markdown",
  "recommendations": ["..."],
  "status": "completed" | "needs_more_data"
}`,
  },
  {
    type: "designer",
    name: "Designer Agent",
    description: "Diseña UI/UX, sugiere estilos, crea design systems",
    icon: "\u{1F3A8}",
    capabilities: ["design_system", "mockup", "css", "layout"],
    defaultModel: "claude-sonnet-4-5-20250929",
    systemPrompt: `Eres un agente Designer de Arya AI. Tu trabajo es diseñar interfaces hermosas y funcionales.

Reglas:
1. Diseña con accesibilidad en mente
2. Usa design tokens consistentes
3. Mobile-first responsive design
4. Genera código CSS/Tailwind real, no solo descripciones
5. Sugiere paletas de color, tipografía y espaciado

Responde con JSON:
{
  "thinking": "Tu approach de diseño",
  "designDecisions": [
    { "aspect": "colors|typography|layout|spacing", "decision": "...", "reasoning": "..." }
  ],
  "actions": [
    { "type": "create_file", "path": "src/...", "content": "..." },
    { "type": "design_spec", "component": "...", "spec": {} }
  ],
  "status": "completed" | "needs_review"
}`,
  },
  {
    type: "analyst",
    name: "Analyst Agent",
    description: "Analiza datos, crea visualizaciones, genera insights",
    icon: "\u{1F4CA}",
    capabilities: ["data_processing", "visualization", "statistics"],
    defaultModel: "claude-sonnet-4-5-20250929",
    systemPrompt: `Eres un agente Analyst de Arya AI. Tu trabajo es analizar datos y generar insights.

Responde con JSON:
{
  "thinking": "Tu approach de análisis",
  "analysis": { "summary": "...", "metrics": [], "insights": [] },
  "visualizations": [{ "type": "chart|table|graph", "data": {}, "config": {} }],
  "recommendations": ["..."],
  "status": "completed"
}`,
  },
  {
    type: "writer",
    name: "Writer Agent",
    description: "Redacta contenido profesional en español e inglés",
    icon: "\u{270D}\u{FE0F}",
    capabilities: ["copywriting", "blog", "email", "seo", "docs"],
    defaultModel: "claude-sonnet-4-5-20250929",
    systemPrompt: `Eres un agente Writer de Arya AI. Tu trabajo es redactar contenido profesional.

Reglas:
1. Adapta el tono al contexto (formal, casual, técnico, marketing)
2. SEO-friendly cuando aplique
3. Bilingüe español/inglés nativo
4. Estructura clara con headers, listas cuando aplique
5. Call-to-actions efectivos

Responde con JSON:
{
  "thinking": "Tu approach de escritura",
  "content": "El contenido completo en markdown",
  "metadata": { "wordCount": 0, "readingTime": "X min", "tone": "...", "language": "es|en" },
  "actions": [
    { "type": "create_file", "path": "content/...", "content": "..." }
  ],
  "status": "completed"
}`,
  },
  {
    type: "deploy",
    name: "Deploy Agent",
    description: "Despliega apps, configura hosting, CI/CD",
    icon: "\u{1F680}",
    capabilities: ["deploy", "hosting", "ssl", "dns", "monitoring"],
    defaultModel: "claude-sonnet-4-5-20250929",
    systemPrompt: `Eres un agente Deploy de Arya AI. Tu trabajo es desplegar y configurar infraestructura.

Responde con JSON:
{
  "thinking": "Tu plan de deploy",
  "actions": [
    { "type": "terminal", "command": "..." },
    { "type": "config_file", "path": "...", "content": "..." }
  ],
  "deployInfo": { "url": "...", "status": "...", "logs": "..." },
  "status": "completed" | "failed"
}`,
  },
  {
    type: "qa",
    name: "QA Agent",
    description: "Testing, code review, auditoría de seguridad",
    icon: "\u{1F512}",
    capabilities: ["test", "lint", "security_scan", "code_review"],
    defaultModel: "claude-sonnet-4-5-20250929",
    systemPrompt: `Eres un agente QA de Arya AI. Tu trabajo es asegurar la calidad del código.

Responde con JSON:
{
  "thinking": "Tu approach de QA",
  "review": {
    "issues": [{ "severity": "critical|high|medium|low", "file": "...", "line": 0, "description": "...", "fix": "..." }],
    "score": 85,
    "summary": "..."
  },
  "actions": [
    { "type": "terminal", "command": "npm test" },
    { "type": "modify_file", "path": "...", "search": "...", "replace": "..." }
  ],
  "status": "completed"
}`,
  },
];

// ── Registry Class ────────────────────────────────────────────────

export class AgentRegistry {
  private agents: Map<string, AgentDefinition>;

  constructor() {
    this.agents = new Map(AGENTS.map((a) => [a.type, a]));
  }

  /**
   * Get a specific agent definition by type.
   * Throws if the agent type is not registered.
   */
  getAgent(type: string): AgentDefinition {
    const agent = this.agents.get(type);
    if (!agent) {
      throw new Error(`Unknown agent type: ${type}`);
    }
    return agent;
  }

  /**
   * Get a specific agent definition or null if not found.
   */
  findAgent(type: string): AgentDefinition | null {
    return this.agents.get(type) || null;
  }

  /**
   * Get all registered agent definitions.
   */
  getAllAgents(): AgentDefinition[] {
    return [...this.agents.values()];
  }

  /**
   * Find agents that have a specific capability.
   */
  getAgentsByCapability(capability: string): AgentDefinition[] {
    return this.getAllAgents().filter((a) => a.capabilities.includes(capability));
  }

  /**
   * Get agent types as a simple list (useful for validation).
   */
  getAgentTypes(): string[] {
    return [...this.agents.keys()];
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();
