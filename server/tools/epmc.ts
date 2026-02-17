import type { ToolOutput } from "./web-search.js";

const EPMC_BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest";
const TIMEOUT = 30_000;

function clean(value: string): string {
  return value.replace(/["',\.]/g, "");
}

function buildQuery(opts: { orcid?: string; author?: string; affiliation?: string; topic?: string }): string {
  const parts: string[] = [];
  if (opts.orcid) parts.push(`AUTHORID:("${clean(opts.orcid)}")`);
  if (opts.author) parts.push(`AUTHOR:("${clean(opts.author)}")`);
  if (opts.affiliation) parts.push(`AFF:(${clean(opts.affiliation)})`);
  if (opts.topic) parts.push(`(${clean(opts.topic)})`);
  return parts.length ? parts.join(" AND ") : "*";
}

function authorNameMatches(authorSearch: string | undefined, auth: any): boolean {
  if (!authorSearch) return false;
  const first = (auth.firstName || "").toLowerCase().trim();
  const last = (auth.lastName || "").toLowerCase().trim();
  const full = (auth.fullName || "").toLowerCase().trim();
  const words = authorSearch.split(/\s+/).map(w => w.toLowerCase().trim()).filter(Boolean);
  return words.some(w => w === first || w === last || w === full);
}

function authorOrcidMatches(orcidSearch: string | undefined, auth: any): boolean {
  if (!orcidSearch) return false;
  const authorId = auth.authorId;
  return authorId?.type === "ORCID" && authorId?.value === orcidSearch;
}

function getAuthorAffiliations(auth: any): string[] {
  const details = auth.authorAffiliationDetailsList || {};
  const affs = details.authorAffiliation || [];
  return affs.map((a: any) => a.affiliation).filter(Boolean);
}

function parseArticleLite(article: any, orcidSearch?: string, authorSearch?: string): Record<string, any> {
  const authors = article.authorList?.author || [];
  const matching = authors
    .filter((a: any) => authorOrcidMatches(orcidSearch, a) || authorNameMatches(authorSearch, a))
    .map((a: any) => {
      const info: any = { first_name: a.firstName, last_name: a.lastName, affiliations: getAuthorAffiliations(a) };
      if (a.authorId?.type === "ORCID") info.orcid = a.authorId.value;
      return info;
    });

  return {
    title: article.title,
    author_string: article.authorString,
    matching_authors: matching.length ? matching : "Unclear match",
  };
}

function parseArticleFull(article: any): Record<string, any> {
  const authors = (article.authorList?.author || []).map((a: any) => {
    const info: any = { name: a.fullName, first_name: a.firstName, last_name: a.lastName, affiliations: getAuthorAffiliations(a) };
    if (a.authorId?.type === "ORCID") info.orcid = a.authorId.value;
    return info;
  });

  const journal = article.journalInfo?.journal || {};
  return {
    doi: article.doi,
    title: article.title,
    authors,
    author_string: article.authorString,
    journal: journal.title,
    pub_year: article.pubYear,
    abstract: article.abstractText,
    cited_by_count: article.citedByCount,
  };
}

export async function searchEpmc(opts: {
  orcid?: string;
  author?: string;
  affiliation?: string;
  topic?: string;
  mode?: "lite" | "full";
}): Promise<ToolOutput> {
  const { orcid, author, affiliation, topic, mode = "lite" } = opts;

  if (!orcid && !author && !affiliation && !topic) {
    return { items: [], metadata: { error: true, message: "At least one search parameter is required" } };
  }

  const maxResults = mode === "lite" ? 25 : 5;
  const query = buildQuery({ orcid, author, affiliation, topic });
  const params = new URLSearchParams({
    query,
    resultType: "core",
    pageSize: String(maxResults),
    format: "json",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${EPMC_BASE}/search?${params}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { items: [], metadata: { error: true, message: `EPMC error: ${res.status}`, query } };

    const data = await res.json();
    const results = data.resultList?.result || [];
    const parsed = mode === "lite"
      ? results.map((a: any) => parseArticleLite(a, orcid, author))
      : results.map((a: any) => parseArticleFull(a));

    return { items: parsed, metadata: { query, mode, hit_count: data.hitCount || 0 } };
  } catch (e: any) {
    clearTimeout(timeout);
    return { items: [], metadata: { error: true, message: `EPMC request failed: ${e.message}`, query } };
  }
}
