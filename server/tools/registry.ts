import type { ToolOutput } from "./web-search.js";
import { searchWeb } from "./web-search.js";
import { searchScreeningList } from "./screening-list.js";
import { searchEpmc } from "./epmc.js";
import { getOrcidProfile, searchOrcidWorks } from "./orcid.js";

// Tool definitions in OpenRouter Responses API format
const TOOL_DEFINITIONS: Record<string, { description: string; parameters: any }> = {
  search_web: {
    description: "Search the web for current information using Tavily. Use for real-time data like stock prices, news, current events, or any information not available in other specialized tools.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query string" },
      },
      required: ["query"],
    },
  },
  search_screening_list: {
    description: "Search the US Consolidated Screening List for sanctioned entities, denied parties, and other restricted persons or organizations. Use this to check if a person or organization is on any US sanctions list.",
    parameters: {
      type: "object",
      properties: {
        queries: {
          type: "array",
          items: { type: "string" },
          description: "List of keywords to match against the institution/person name. Each query should be 2-5 distinct words. Multiple queries increase correct match likelihood.",
        },
      },
      required: ["queries"],
    },
  },
  search_epmc: {
    description: "Search Europe PubMed Central (EPMC) for scientific articles and publications. Use this to find research papers by author, institution, topic, or ORCID identifier.",
    parameters: {
      type: "object",
      properties: {
        orcid: { type: "string", description: "Author's ORCID identifier (e.g., '0000-0002-1825-0097')" },
        author: { type: "string", description: "Author name to search for (e.g., 'John Smith'). Skip middle names and initials." },
        affiliation: { type: "string", description: "Institution or affiliation to search for (e.g., 'Harvard University')" },
        topic: { type: "string", description: "Topic or keywords to search for (e.g., 'CRISPR gene editing')" },
        mode: { type: "string", enum: ["lite", "full"], description: "Search mode: 'lite' returns 25 results with title, author string, and matching author details; 'full' returns 5 results with complete metadata including abstracts." },
      },
    },
  },
  get_orcid_profile: {
    description: "Get researcher profile information from ORCID (Open Researcher and Contributor ID). Returns name, biography, affiliations, employment history, education, and up to 5 recent publications. Use this to get detailed information about a specific researcher.",
    parameters: {
      type: "object",
      properties: {
        orcid_id: { type: "string", description: "The ORCID identifier in format XXXX-XXXX-XXXX-XXXX (e.g., '0000-0002-1825-0097')" },
      },
      required: ["orcid_id"],
    },
  },
  search_orcid_works: {
    description: "Search a researcher's ORCID publications by keywords. Use this after get_orcid_profile when you need to find specific publications among a researcher's full publication list. Keywords are matched against title, journal name, and publication type. Use single words or short phrases (e.g., 'GPCR', 'cancer', 'Nature', 'review').",
    parameters: {
      type: "object",
      properties: {
        orcid_id: { type: "string", description: "The ORCID identifier in format XXXX-XXXX-XXXX-XXXX (e.g., '0000-0002-1825-0097')" },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "List of keywords to search for in publications. Each keyword is matched case-insensitively against title, journal, and type.",
        },
      },
      required: ["orcid_id", "keywords"],
    },
  },
};

export function getToolDefinitions(toolNames?: string[]): any[] {
  const tools: any[] = [];
  for (const [name, spec] of Object.entries(TOOL_DEFINITIONS)) {
    if (toolNames && !toolNames.includes(name)) continue;
    tools.push({
      type: "function",
      name,
      description: spec.description,
      parameters: spec.parameters,
    });
  }
  return tools;
}

export async function executeTool(name: string, args: Record<string, any>): Promise<ToolOutput> {
  // Filter out empty/null args
  const filtered: Record<string, any> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) {
      filtered[k] = v;
    }
  }

  switch (name) {
    case "search_web":
      return searchWeb(filtered.query || "");
    case "search_screening_list":
      return searchScreeningList(filtered.queries || []);
    case "search_epmc":
      return searchEpmc(filtered);
    case "get_orcid_profile":
      return getOrcidProfile(filtered.orcid_id || "");
    case "search_orcid_works":
      return searchOrcidWorks(filtered.orcid_id || "", filtered.keywords || []);
    default:
      return { items: [], metadata: { error: true, message: `Unknown tool: ${name}` } };
  }
}
