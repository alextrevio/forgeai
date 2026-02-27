import { agentRegistry } from "../agent-registry";
import { BaseAgent, type AgentResult, type ResultSummary } from "./base-agent";
import { webSearchTool, type SearchResult } from "../tools/web-search";
import { webScraper, type ScrapedPage } from "../tools/web-scraper";
import { logger } from "../../lib/logger";

// ══════════════════════════════════════════════════════════════════
// RESEARCH AGENT — Investigation with web search & scraping
// ══════════════════════════════════════════════════════════════════

interface ResearchResponse {
  thinking?: string;
  summary?: string;
  findings?: Array<{ topic: string; summary?: string; description?: string; details?: string; relevance?: string; sources?: string[] }>;
  report?: string;
  recommendations?: string[];
  techStack?: { suggested: string[]; reasoning: string };
  risks?: Array<{ risk: string; mitigation: string }>;
  searchQueries?: string[];
  urlsToScrape?: string[];
  status?: string;
}

// Maximum number of search queries per task
const MAX_SEARCH_QUERIES = 3;
// Maximum number of URLs to scrape per task
const MAX_SCRAPE_URLS = 2;

export class ResearchAgentRunner extends BaseAgent {
  getSystemPrompt(): string {
    const base = agentRegistry.getAgent("research").systemPrompt;
    const hasSearch = webSearchTool.isConfigured();

    // Augment the system prompt with web search instructions
    const searchInstructions = hasSearch
      ? `\n\nTienes acceso a búsqueda web en tiempo real. Para usarla, incluye un campo "searchQueries" en tu respuesta con las queries de búsqueda que necesitas. Los resultados se te proporcionarán automáticamente.

Si encuentras URLs relevantes en los resultados de búsqueda que quieras explorar a fondo, incluye un campo "urlsToScrape" con hasta ${MAX_SCRAPE_URLS} URLs.

Tu respuesta debe incluir las fuentes web reales en cada finding cuando uses datos de búsqueda.`
      : `\n\nNo tienes acceso a búsqueda web en este momento. Basa tu investigación en tu conocimiento, pero indica claramente que los datos provienen de tu training data y no de búsquedas en tiempo real.`;

    return base + searchInstructions;
  }

  async prepareContext(): Promise<Record<string, unknown>> {
    const hasSearch = webSearchTool.isConfigured();

    // Warn if web search is not configured
    if (!hasSearch) {
      this.emitActivity("agent_message", {
        message: "Web search no configurado. Usando conocimiento base del modelo.",
      });
      logger.warn("ResearchAgent: No search API key configured, using LLM knowledge only");
    }

    return {
      userMessage: this.buildUserMessage(),
      webSearchAvailable: hasSearch,
    };
  }

  buildMessages(context: Record<string, unknown>): Array<{ role: "user" | "assistant"; content: string }> {
    let message = context.userMessage as string;

    // Append web search context if results were gathered in a previous pass
    if (context.searchContext) {
      message += "\n\n" + (context.searchContext as string);
    }

    if (context.scrapeContext) {
      message += "\n\n" + (context.scrapeContext as string);
    }

    return [{ role: "user", content: message }];
  }

  async processResponse(parsed: Record<string, unknown> | null, rawText: string): Promise<AgentResult> {
    const data = parsed as ResearchResponse | null;

    if (data) {
      // ── Phase 1: Execute search queries if requested ──────────
      let searchContext = "";
      let totalSearchResults = 0;

      if (data.searchQueries && data.searchQueries.length > 0 && webSearchTool.isConfigured()) {
        const queries = data.searchQueries.slice(0, MAX_SEARCH_QUERIES);

        for (const query of queries) {
          if (this.ctx.signal.aborted) break;

          this.emitActivity("agent_message", { message: `Buscando: ${query}` });

          try {
            const results = await webSearchTool.search(query, { maxResults: 5 });
            totalSearchResults += results.length;
            searchContext += webSearchTool.formatResultsForLLM(results, query);
          } catch (err) {
            logger.warn({ query, error: err }, "ResearchAgent: search query failed");
          }
        }
      }

      // ── Phase 2: Scrape URLs if requested ─────────────────────
      let scrapeContext = "";
      let totalScrapedPages = 0;

      if (data.urlsToScrape && data.urlsToScrape.length > 0) {
        const urls = data.urlsToScrape.slice(0, MAX_SCRAPE_URLS);

        for (const url of urls) {
          if (this.ctx.signal.aborted) break;

          this.emitActivity("agent_message", { message: `Leyendo: ${url}` });

          try {
            const page = await webScraper.scrape(url);
            totalScrapedPages++;
            scrapeContext += webScraper.formatForLLM(page);
          } catch (err) {
            logger.warn({ url, error: err }, "ResearchAgent: scrape failed");
          }
        }
      }

      // ── Phase 3: If we gathered web data, make a second LLM call ──
      if (searchContext || scrapeContext) {
        this.emitActivity("agent_message", {
          message: `Analizando ${totalSearchResults} resultados de búsqueda y ${totalScrapedPages} páginas...`,
        });

        return this.synthesizeWithWebData(data, searchContext, scrapeContext, totalSearchResults, totalScrapedPages);
      }

      // ── No web data — use the original response ───────────────
      return this.buildResult(data, 0, 0);
    }

    // Fallback: raw text
    this.emitMessage(rawText?.slice(0, 500) || "Research completed");
    return {
      thinking: "Research completed (raw)",
      status: "completed",
      outputData: { summary: rawText || "Research completed", raw: true },
    };
  }

  /**
   * Makes a second LLM call with web search results included in context,
   * so the agent can produce a better-informed research report.
   */
  private async synthesizeWithWebData(
    initialData: ResearchResponse,
    searchContext: string,
    scrapeContext: string,
    searchResultCount: number,
    scrapedPageCount: number,
  ): Promise<AgentResult> {
    const { modelRouter } = await import("../model-router");

    // Build the synthesis prompt
    const synthesisMessage = [
      `Tarea original: ${this.ctx.step.description}`,
      `\nSolicitud del usuario: ${this.ctx.originalPrompt}`,
      `\nTu análisis inicial:\n${JSON.stringify({ thinking: initialData.thinking, findings: initialData.findings, recommendations: initialData.recommendations }, null, 2)}`,
      searchContext ? `\nResultados de búsqueda web:${searchContext}` : "",
      scrapeContext ? `\nContenido de páginas web:${scrapeContext}` : "",
      `\nAhora genera tu reporte final integrando la información de búsqueda web con tu análisis. Incluye URLs como fuentes reales en cada finding. Responde en el formato JSON estándar.`,
    ].filter(Boolean).join("\n");

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      { role: "user", content: synthesisMessage },
    ];

    try {
      const { parsed: synthParsed } = await modelRouter.callModelForJSON<ResearchResponse>(
        "research",
        this.getSystemPrompt(),
        messages,
        this.ctx.signal,
      );

      const finalData = (synthParsed as ResearchResponse) || initialData;
      return this.buildResult(finalData, searchResultCount, scrapedPageCount);
    } catch (err) {
      logger.warn({ error: err }, "ResearchAgent: synthesis call failed, using initial data");
      return this.buildResult(initialData, searchResultCount, scrapedPageCount);
    }
  }

  /**
   * Build the final AgentResult with proper emissions and result summary.
   */
  private buildResult(
    data: ResearchResponse,
    searchResultCount: number,
    scrapedPageCount: number,
  ): AgentResult {
    // Emit summary
    if (data.summary) {
      this.emitMessage(data.summary);
    }

    // Emit individual findings
    for (const finding of data.findings || []) {
      const relevance = (finding.relevance || "medium").toUpperCase();
      const desc = finding.description || finding.summary || finding.details || "";
      this.emitMessage(`[${relevance}] ${finding.topic}: ${desc}`);
    }

    // Emit recommendations
    if (data.recommendations?.length) {
      this.emitMessage(`Recomendaciones: ${data.recommendations.join("; ")}`);
    }

    const findingsCount = (data.findings || []).length;
    const recsCount = (data.recommendations || []).length;
    const metrics: Array<{ label: string; value: string | number }> = [];

    if (findingsCount > 0) metrics.push({ label: "hallazgos", value: findingsCount });
    if (recsCount > 0) metrics.push({ label: "recomendaciones", value: recsCount });
    if (data.risks?.length) metrics.push({ label: "riesgos", value: data.risks.length });
    if (searchResultCount > 0) metrics.push({ label: "resultados web", value: searchResultCount });
    if (scrapedPageCount > 0) metrics.push({ label: "páginas leídas", value: scrapedPageCount });

    const resultSummary: ResultSummary = {
      oneLiner: data.summary || `Investigación completada — ${findingsCount} hallazgo(s)`,
      metrics,
      type: "research",
    };

    return {
      thinking: data.thinking || data.summary || "Research completed",
      status: data.status || "completed",
      outputData: data as unknown as Record<string, unknown>,
      resultSummary,
    };
  }
}
