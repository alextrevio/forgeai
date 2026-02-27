import * as cheerio from "cheerio";
import { logger } from "../../lib/logger";

// ══════════════════════════════════════════════════════════════════
// WEB SCRAPER — Fetches URLs and converts HTML to clean text/markdown
// ══════════════════════════════════════════════════════════════════

export interface ScrapedPage {
  title: string;
  content: string;
  links: string[];
  url: string;
  wordCount: number;
}

const DEFAULT_TIMEOUT = 10_000;
const MAX_CONTENT_LENGTH = 50_000; // ~50KB of text, enough for LLM context

const USER_AGENT = "Mozilla/5.0 (compatible; AryaBot/1.0; +https://forgeai.dev)";

// Tags to completely remove (including their content)
const REMOVE_TAGS = [
  "script", "style", "noscript", "iframe", "svg", "canvas",
  "nav", "footer", "header", "aside",
  "form", "button", "input", "select", "textarea",
];

// Tags that translate to markdown
const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "main",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "li", "blockquote", "pre", "code",
  "tr", "td", "th",
]);

export class WebScraper {
  /**
   * Scrape a single URL and return structured content.
   */
  async scrape(url: string): Promise<ScrapedPage> {
    logger.info({ url }, "WebScraper: fetching");

    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es,en;q=0.5",
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT),
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("html") && !contentType.includes("xml") && !contentType.includes("text")) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    const html = await res.text();
    return this.parseHTML(html, url);
  }

  /**
   * Scrape multiple URLs in parallel with error tolerance.
   */
  async scrapeMultiple(urls: string[], concurrency = 3): Promise<ScrapedPage[]> {
    const results: ScrapedPage[] = [];
    const queue = [...urls];

    const worker = async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        if (!url) break;
        try {
          const page = await this.scrape(url);
          results.push(page);
        } catch (err) {
          logger.warn({ url, error: err instanceof Error ? err.message : String(err) }, "WebScraper: failed to scrape URL");
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
    await Promise.all(workers);

    return results;
  }

  /**
   * Parse HTML string into clean structured content.
   */
  private parseHTML(html: string, url: string): ScrapedPage {
    const $ = cheerio.load(html);

    // Extract title
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      "";

    // Remove unwanted tags entirely
    for (const tag of REMOVE_TAGS) {
      $(tag).remove();
    }

    // Remove hidden elements
    $("[style*='display:none'], [style*='display: none'], [hidden], .hidden, .sr-only").remove();

    // Extract links before converting to text
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        try {
          const absolute = new URL(href, url).href;
          if (!links.includes(absolute)) links.push(absolute);
        } catch {
          // Skip invalid URLs
        }
      }
    });

    // Convert to markdown-like text
    const content = this.htmlToMarkdown($, $("body"));

    // Trim to max length
    const trimmed = content.length > MAX_CONTENT_LENGTH
      ? content.slice(0, MAX_CONTENT_LENGTH) + "\n\n[... contenido truncado ...]"
      : content;

    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

    logger.info({ url, title, wordCount, linksCount: links.length }, "WebScraper: parsed");

    return {
      title,
      content: trimmed,
      links: links.slice(0, 50), // Cap at 50 links
      url,
      wordCount,
    };
  }

  /**
   * Convert cheerio elements to markdown-like text.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private htmlToMarkdown($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): string {
    const lines: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processNode = (el: any): string => {
      if (el.type === "text") {
        const text = el.data || "";
        return (text as string).replace(/\s+/g, " ");
      }

      if (el.type !== "tag") return "";

      const tagName = (el.tagName || "").toLowerCase();
      const children = el.children || [];
      const inner = (children as unknown[]).map(processNode).join("").trim();

      if (!inner) return "";

      // Headings
      if (tagName === "h1") return `\n# ${inner}\n`;
      if (tagName === "h2") return `\n## ${inner}\n`;
      if (tagName === "h3") return `\n### ${inner}\n`;
      if (tagName === "h4") return `\n#### ${inner}\n`;
      if (tagName === "h5" || tagName === "h6") return `\n##### ${inner}\n`;

      // Lists
      if (tagName === "li") return `- ${inner}\n`;
      if (tagName === "ul" || tagName === "ol") return `\n${inner}\n`;

      // Block quotes
      if (tagName === "blockquote") return `\n> ${inner.replace(/\n/g, "\n> ")}\n`;

      // Code
      if (tagName === "pre") return `\n\`\`\`\n${inner}\n\`\`\`\n`;
      if (tagName === "code") return `\`${inner}\``;

      // Links
      if (tagName === "a") {
        const href = $(el).attr("href");
        return href ? `[${inner}](${href})` : inner;
      }

      // Emphasis
      if (tagName === "strong" || tagName === "b") return `**${inner}**`;
      if (tagName === "em" || tagName === "i") return `*${inner}*`;

      // Tables
      if (tagName === "tr") return inner.replace(/\|$/, "") + "|\n";
      if (tagName === "td" || tagName === "th") return `| ${inner} `;

      // Block-level elements get newlines
      if (BLOCK_TAGS.has(tagName)) return `\n${inner}\n`;

      // Inline elements
      return inner;
    };

    root.contents().each((_, el) => {
      const text = processNode(el);
      if (text.trim()) lines.push(text);
    });

    // Clean up excessive whitespace
    return lines
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^ +/gm, "")
      .trim();
  }

  /**
   * Format scraped content for LLM context.
   */
  formatForLLM(page: ScrapedPage): string {
    const lines = [
      `\n--- Contenido de: ${page.title || page.url} ---`,
      `URL: ${page.url}`,
      `Palabras: ~${page.wordCount}`,
      "",
      page.content,
      "",
      "--- Fin del contenido ---\n",
    ];
    return lines.join("\n");
  }
}

// Singleton instance
export const webScraper = new WebScraper();
