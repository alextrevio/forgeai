import { logger } from "../../lib/logger";

// ══════════════════════════════════════════════════════════════════
// WEB SEARCH TOOL — Multi-provider web search for agents
// Supports: Serper.dev (Google), Tavily, DuckDuckGo (fallback)
// ══════════════════════════════════════════════════════════════════

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  source?: string;
}

export interface SearchOptions {
  maxResults?: number;
  type?: "web" | "news" | "images";
  language?: string;
}

type SearchProvider = "serper" | "tavily" | "duckduckgo" | "none";

// ── Provider Detection ────────────────────────────────────────────

function detectProvider(): SearchProvider {
  if (process.env.SERPER_API_KEY) return "serper";
  if (process.env.TAVILY_API_KEY) return "tavily";
  return "duckduckgo";
}

// ── Serper.dev (Google Search API) ────────────────────────────────

async function searchSerper(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY!;
  const maxResults = opts.maxResults || 5;

  const endpoint =
    opts.type === "news"
      ? "https://google.serper.dev/news"
      : opts.type === "images"
        ? "https://google.serper.dev/images"
        : "https://google.serper.dev/search";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      num: maxResults,
      hl: opts.language || "es",
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string; date?: string; source?: string }>;
    news?: Array<{ title?: string; link?: string; snippet?: string; date?: string; source?: string }>;
  };

  const items = data.organic || data.news || [];
  return items.slice(0, maxResults).map((item) => ({
    title: item.title || "",
    url: item.link || "",
    snippet: item.snippet || "",
    date: item.date,
    source: item.source,
  }));
}

// ── Tavily API ────────────────────────────────────────────────────

async function searchTavily(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY!;
  const maxResults = opts.maxResults || 5;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
      topic: opts.type === "news" ? "news" : "general",
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string; published_date?: string }>;
  };

  return (data.results || []).slice(0, maxResults).map((item) => ({
    title: item.title || "",
    url: item.url || "",
    snippet: item.content || "",
    date: item.published_date,
    source: item.url ? new URL(item.url).hostname : undefined,
  }));
}

// ── DuckDuckGo (HTML scraping fallback) ───────────────────────────

async function searchDuckDuckGo(query: string, opts: SearchOptions): Promise<SearchResult[]> {
  const maxResults = opts.maxResults || 5;

  // Use DuckDuckGo's lite HTML endpoint
  const params = new URLSearchParams({ q: query, kl: opts.language === "en" ? "us-en" : "es-es" });
  const res = await fetch(`https://lite.duckduckgo.com/lite/?${params.toString()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AryaBot/1.0)",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`DuckDuckGo request failed: ${res.status}`);
  }

  const html = await res.text();
  const results: SearchResult[] = [];

  // Parse the lite HTML response — each result has a link and snippet
  const resultBlocks = html.split(/class="result-link"/).slice(1);
  for (const block of resultBlocks) {
    if (results.length >= maxResults) break;

    const hrefMatch = block.match(/href="([^"]+)"/);
    const url = hrefMatch?.[1] || "";
    if (!url || url.startsWith("/")) continue;

    // Title is the link text
    const titleMatch = block.match(/>([^<]+)</);
    const title = titleMatch?.[1]?.trim() || "";

    // Snippet follows in a snippet class or next td
    const snippetMatch = block.match(/class="result-snippet"[^>]*>([^<]+)</);
    const snippet = snippetMatch?.[1]?.trim() || "";

    if (title && url) {
      results.push({
        title,
        url,
        snippet,
        source: (() => { try { return new URL(url).hostname; } catch { return undefined; } })(),
      });
    }
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════
// WEB SEARCH TOOL CLASS
// ══════════════════════════════════════════════════════════════════

export class WebSearchTool {
  private provider: SearchProvider;

  constructor() {
    this.provider = detectProvider();
    logger.info({ provider: this.provider }, "WebSearchTool: initialized");
  }

  /**
   * Returns which search provider is active.
   */
  getProvider(): SearchProvider {
    return this.provider;
  }

  /**
   * Whether a real search provider is configured (not just DuckDuckGo fallback).
   */
  isConfigured(): boolean {
    return this.provider === "serper" || this.provider === "tavily";
  }

  /**
   * Search the web and return structured results.
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const opts: SearchOptions = {
      maxResults: 5,
      type: "web",
      language: "es",
      ...options,
    };

    logger.info({ provider: this.provider, query, type: opts.type }, "WebSearchTool: searching");

    try {
      let results: SearchResult[];

      switch (this.provider) {
        case "serper":
          results = await searchSerper(query, opts);
          break;
        case "tavily":
          results = await searchTavily(query, opts);
          break;
        case "duckduckgo":
          results = await searchDuckDuckGo(query, opts);
          break;
        default:
          return [];
      }

      logger.info({ provider: this.provider, resultCount: results.length }, "WebSearchTool: search complete");
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ provider: this.provider, query, error: message }, "WebSearchTool: search failed");

      // Fallback to DuckDuckGo if primary provider fails
      if (this.provider !== "duckduckgo") {
        logger.info("WebSearchTool: falling back to DuckDuckGo");
        try {
          return await searchDuckDuckGo(query, opts);
        } catch (fallbackErr) {
          logger.error({ error: fallbackErr }, "WebSearchTool: DuckDuckGo fallback also failed");
        }
      }

      return [];
    }
  }

  /**
   * Format search results as context string for LLM consumption.
   */
  formatResultsForLLM(results: SearchResult[], query: string): string {
    if (results.length === 0) {
      return `[Web search for "${query}" returned no results]`;
    }

    const lines = [`\n--- Resultados de búsqueda web: "${query}" ---\n`];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      lines.push(`[${i + 1}] ${r.title}`);
      lines.push(`    URL: ${r.url}`);
      if (r.snippet) lines.push(`    ${r.snippet}`);
      if (r.date) lines.push(`    Fecha: ${r.date}`);
      lines.push("");
    }

    lines.push("--- Fin de resultados ---\n");
    return lines.join("\n");
  }
}

// Singleton instance
export const webSearchTool = new WebSearchTool();
