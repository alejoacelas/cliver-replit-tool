import type { ToolOutput } from "./web-search.js";

const ORCID_BASE = "https://pub.orcid.org/v3.0";
const HEADERS = { Accept: "application/vnd.orcid+json" };
const TIMEOUT = 30_000;
const MAX_WORKS_IN_PROFILE = 5;

function safeGet(data: any, ...keys: string[]): any {
  let current = data;
  for (const key of keys) {
    if (!current || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current ?? undefined;
}

function extractDate(dateObj: any): string | null {
  if (!dateObj) return null;
  const parts = [dateObj.year?.value, dateObj.month?.value, dateObj.day?.value].filter(Boolean);
  return parts.length ? parts.join("-") : null;
}

async function fetchEndpoint(orcidId: string, endpoint: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${ORCID_BASE}/${orcidId}/${endpoint}`, {
      headers: HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`ORCID API error: ${res.status}`);
    return res.json();
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

function parsePerson(data: any): Record<string, any> {
  const result: any = {
    given_name: safeGet(data, "name", "given-names", "value"),
    family_name: safeGet(data, "name", "family-name", "value"),
    credit_name: safeGet(data, "name", "credit-name", "value"),
    biography: safeGet(data, "biography", "content"),
  };

  const keywords = safeGet(data, "keywords", "keyword") || [];
  result.keywords = keywords.map((kw: any) => kw.content).filter(Boolean);

  const emails = safeGet(data, "emails", "email") || [];
  result.emails = emails.map((e: any) => e.email).filter(Boolean);

  const extIds = safeGet(data, "external-identifiers", "external-identifier") || [];
  result.external_ids = extIds.map((eid: any) => ({
    type: eid["external-id-type"],
    value: eid["external-id-value"],
    url: safeGet(eid, "external-id-url", "value"),
  }));

  const urls = safeGet(data, "researcher-urls", "researcher-url") || [];
  result.urls = urls.map((u: any) => ({
    name: u["url-name"],
    url: safeGet(u, "url", "value"),
  }));

  return result;
}

function parseAffiliations(data: any, type: string): any[] {
  const affiliations: any[] = [];
  for (const group of data["affiliation-group"] || []) {
    for (const summary of group.summaries || []) {
      const affData = summary[`${type}-summary`];
      if (!affData) continue;
      const org = affData.organization || {};
      const addr = org.address || {};
      affiliations.push({
        organization: org.name,
        department: affData["department-name"],
        role: affData["role-title"],
        city: addr.city,
        country: addr.country,
        start_date: extractDate(affData["start-date"]),
        end_date: extractDate(affData["end-date"]),
      });
    }
  }
  return affiliations;
}

function parseWorks(data: any): any[] {
  const works: any[] = [];
  for (const group of data.group || []) {
    const summaries = group["work-summary"] || [];
    if (!summaries.length) continue;
    const work = summaries[0];
    const extIds = safeGet(group, "external-ids", "external-id") || [];
    works.push({
      title: safeGet(work, "title", "title", "value"),
      type: work.type,
      publication_date: extractDate(work["publication-date"]),
      journal: safeGet(work, "journal-title", "value"),
      url: safeGet(work, "url", "value"),
      identifiers: extIds.map((eid: any) => ({
        type: eid["external-id-type"],
        value: eid["external-id-value"],
      })),
    });
  }
  return works;
}

export async function getOrcidProfile(orcidId: string): Promise<ToolOutput> {
  try {
    const [personData, worksData, educationData, employmentData] = await Promise.all([
      fetchEndpoint(orcidId, "person"),
      fetchEndpoint(orcidId, "works"),
      fetchEndpoint(orcidId, "educations"),
      fetchEndpoint(orcidId, "employments"),
    ]);

    const allWorks = parseWorks(worksData);
    const profile: any = {
      orcid_id: orcidId,
      orcid_url: `https://orcid.org/${orcidId}`,
      ...parsePerson(personData),
      education: parseAffiliations(educationData, "education"),
      employment: parseAffiliations(employmentData, "employment"),
      total_works_count: allWorks.length,
      works: allWorks.slice(0, MAX_WORKS_IN_PROFILE),
    };

    if (allWorks.length > MAX_WORKS_IN_PROFILE) {
      profile.works_note = `Showing ${MAX_WORKS_IN_PROFILE} of ${allWorks.length} works. Use search_orcid_works to search all publications by keyword.`;
    }

    return { items: [profile], metadata: {} };
  } catch (e: any) {
    const msg = e.message?.includes("404") ? `ORCID ID not found: ${orcidId}` : `ORCID error: ${e.message}`;
    return { items: [], metadata: { error: true, message: msg } };
  }
}

export async function searchOrcidWorks(orcidId: string, keywords: string[]): Promise<ToolOutput> {
  try {
    const worksData = await fetchEndpoint(orcidId, "works");
    const allWorks = parseWorks(worksData);
    const keywordsLower = keywords.map(kw => kw.toLowerCase());

    const matching = allWorks.filter(work => {
      const parts = [work.title, work.journal, work.type].filter(Boolean);
      const text = parts.join(" ").toLowerCase();
      return keywordsLower.some(kw => text.includes(kw));
    });

    return {
      items: matching,
      metadata: { orcid_id: orcidId, keywords, total_works: allWorks.length },
    };
  } catch (e: any) {
    const msg = e.message?.includes("404") ? `ORCID ID not found: ${orcidId}` : `ORCID error: ${e.message}`;
    return { items: [], metadata: { error: true, message: msg } };
  }
}
