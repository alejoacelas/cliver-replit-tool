import type { ToolOutput } from "./web-search.js";

const BASE_URL = "https://data.trade.gov/consolidated_screening_list/v1";
const TIMEOUT = 30_000;

function parseEntity(entity: Record<string, any>): Record<string, any> {
  const programsRaw = entity.programs;
  let programs: string[] = [];
  if (typeof programsRaw === "string") programs = programsRaw ? [programsRaw] : [];
  else if (Array.isArray(programsRaw)) programs = programsRaw;

  return {
    name: entity.name,
    programs,
    source: entity.source,
  };
}

async function searchSingle(apiKey: string, query: string): Promise<Record<string, any>[]> {
  const params = new URLSearchParams({
    "subscription-key": apiKey,
    name: query,
    fuzzy_name: "true",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${BASE_URL}/search?${params}`, {
      headers: { Accept: "application/json", "User-Agent": "KYC-API/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

export async function searchScreeningList(queries: string[]): Promise<ToolOutput> {
  if (!queries.length) {
    return {
      items: [],
      metadata: { status: "no_queries", message: "No search queries provided.", queries_searched: queries },
    };
  }

  const apiKey = process.env.SCREENING_LIST_API_KEY;
  if (!apiKey) {
    return { items: [], metadata: { error: true, message: "SCREENING_LIST_API_KEY is required", queries_searched: queries } };
  }

  const allResults: Record<string, any>[] = [];
  for (const query of queries) {
    const results = await searchSingle(apiKey, query);
    allResults.push(...results);
  }

  // Deduplicate by name
  const seen = new Set<string>();
  const unique: Record<string, any>[] = [];
  for (const entity of allResults) {
    const name = entity.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      unique.push(parseEntity(entity));
    }
  }

  if (!unique.length) {
    return {
      items: [],
      metadata: { status: "no_matches", message: "No matches found in the US Consolidated Screening List.", queries_searched: queries },
    };
  }

  return {
    items: unique,
    metadata: { status: "matches_found", total: unique.length, queries_searched: queries },
  };
}
