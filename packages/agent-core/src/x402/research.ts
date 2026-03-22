import { safePaidFetch } from "./client.js";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  results: SearchResult[];
  source: "x402" | "duckduckgo" | "fallback" | "error";
}

export interface FetchUrlResponse {
  content: string;
  source: "x402" | "direct" | "error";
}

export interface EnrichResponse {
  data: Record<string, unknown>;
  enriched: boolean;
  source: "x402" | "unavailable";
}

export async function webSearch(query: string): Promise<WebSearchResponse> {
  // Try x402 (StableEnrich Exa search)
  const x402Result = await safePaidFetch(
    `https://stableenrich.dev/api/exa/search?query=${encodeURIComponent(query)}&numResults=5`
  );

  if (x402Result.success && x402Result.data) {
    const raw = x402Result.data as Record<string, unknown>;
    const results = Array.isArray(raw.results)
      ? raw.results.map((r: Record<string, unknown>) => ({
          title: String(r.title ?? ""),
          url: String(r.url ?? ""),
          snippet: String(r.text ?? r.snippet ?? "").slice(0, 300),
        }))
      : [];
    return { results, source: "x402" };
  }

  // Fallback: DuckDuckGo instant answers (free, no API key)
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;
    const resp = await globalThis.fetch(ddgUrl, { signal: AbortSignal.timeout(10000) });
    if (resp.ok) {
      const data = (await resp.json()) as Record<string, unknown>;
      const results: SearchResult[] = [];

      if (data.Abstract) {
        results.push({
          title: String(data.Heading ?? query),
          url: String(data.AbstractURL ?? ""),
          snippet: String(data.Abstract).slice(0, 300),
        });
      }

      const relatedTopics = Array.isArray(data.RelatedTopics) ? data.RelatedTopics : [];
      for (const topic of relatedTopics.slice(0, 4)) {
        const t = topic as Record<string, unknown>;
        if (t.Text) {
          results.push({
            title: String(t.Text).slice(0, 80),
            url: String(t.FirstURL ?? ""),
            snippet: String(t.Text).slice(0, 300),
          });
        }
      }

      return { results, source: "duckduckgo" };
    }
  } catch {
    // Fallback also failed
  }

  // Final fallback: return empty results — agent must retry with different queries
  return {
    results: [
      {
        title: "Search unavailable",
        url: "",
        snippet: "All search APIs failed. Retry with a different query, or use fetch_url on a specific known URL.",
      },
    ],
    source: "fallback",
  };
}

export async function fetchUrl(url: string): Promise<FetchUrlResponse> {
  // Try x402 (StableEnrich Firecrawl scrape)
  const x402Result = await safePaidFetch(
    `https://stableenrich.dev/api/firecrawl/scrape?url=${encodeURIComponent(url)}`
  );

  if (x402Result.success && x402Result.data) {
    const raw = x402Result.data as Record<string, unknown>;
    const content = String(raw.markdown ?? raw.content ?? raw.text ?? "");
    if (content.length > 0) {
      return { content: content.slice(0, 4000), source: "x402" };
    }
  }

  // Fallback: direct fetch
  try {
    const resp = await globalThis.fetch(url, {
      headers: { "User-Agent": "AgentLedger-Worker/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (resp.ok) {
      const text = await resp.text();
      return { content: text.slice(0, 4000), source: "direct" };
    }
  } catch {
    // Direct fetch failed
  }

  return { content: "", source: "error" };
}

export async function enrichCompany(domain: string): Promise<EnrichResponse> {
  const x402Result = await safePaidFetch(
    `https://stableenrich.dev/api/company?domain=${encodeURIComponent(domain)}`
  );

  if (x402Result.success && x402Result.data) {
    return {
      data: x402Result.data as Record<string, unknown>,
      enriched: true,
      source: "x402",
    };
  }

  return {
    data: { domain, note: "Enrichment unavailable — x402 payment failed or service down" },
    enriched: false,
    source: "unavailable",
  };
}
