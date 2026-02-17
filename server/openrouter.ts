import { getToolDefinitions, executeTool } from "./tools/registry.js";
import type { ToolOutput } from "./tools/web-search.js";

const RESPONSES_URL = "https://openrouter.ai/api/v1/responses";
const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

const TOOL_PREFIXES: Record<string, string> = {
  search_web: "web",
  search_screening_list: "screen",
  search_epmc: "epmc",
  get_orcid_profile: "orcid",
  search_orcid_works: "orcworks",
};

const SNIPPET_PREVIEW_LENGTH = 200;

function getHeaders(): Record<string, string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://cliver.example.com",
    "X-Title": process.env.OPENROUTER_TITLE || "Cliver KYC",
  };
}

export interface RawToolCall {
  toolName: string;
  arguments: Record<string, any>;
  output: ToolOutput;
  modelOutput: string; // JSON string sent to model (with IDs)
}

export interface CompletionResult {
  text: string;
  toolCalls: RawToolCall[];
}

function formatForModel(toolName: string, output: ToolOutput, counters: Record<string, number>): string {
  const prefix = TOOL_PREFIXES[toolName] || toolName.slice(0, 4);

  if (!output.items.length) {
    counters[prefix] = (counters[prefix] || 0) + 1;
    return JSON.stringify({
      instruction: "Cite using [id] format (e.g., [screen1]).",
      id: `${prefix}${counters[prefix]}`,
      ...output.metadata,
    }, null, 2);
  }

  const annotated = output.items.map(item => {
    counters[prefix] = (counters[prefix] || 0) + 1;
    return { id: `${prefix}${counters[prefix]}`, ...item };
  });

  return JSON.stringify({
    instruction: "Cite using [id] format (e.g., [web1], [epmc2]).",
    results: annotated,
    ...output.metadata,
  }, null, 2);
}

export function buildQuery(toolName: string, args: Record<string, any>): string {
  if (toolName === "search_epmc") {
    const parts: string[] = [];
    if (args.author) parts.push(args.author);
    if (args.affiliation) parts.push(`at ${args.affiliation}`);
    if (args.keyword || args.topic) parts.push(`about ${args.keyword || args.topic}`);
    return parts.length ? parts.join(" ") : "EPMC search";
  }
  if (toolName === "search_web") return args.query || "web search";
  if (toolName === "search_screening_list") {
    const queries = args.queries || [];
    return queries.length ? queries.join(", ") : "screening list search";
  }
  if (toolName === "get_orcid_profile") return args.orcid_id || "ORCID profile";
  if (toolName === "search_orcid_works") return args.orcid_id || "ORCID works";
  return JSON.stringify(args);
}

// Field extractors for normalizing tool results for audit
function extractWebFields(item: any) {
  return { title: item.title || "", url: item.url || "", snippet: (item.content || "").slice(0, SNIPPET_PREVIEW_LENGTH) || null };
}
function extractEpmcFields(item: any) {
  const doi = item.doi || "";
  const authors = Array.isArray(item.authors) ? item.authors.map((a: any) => a.name || a) : null;
  return { title: item.title || "", url: doi ? `https://doi.org/${doi}` : "", authors, year: item.pub_year ? parseInt(String(item.pub_year)) : null };
}
function extractScreeningFields(item: any) {
  return { title: item.name || "", url: "", programs: item.programs };
}
function extractOrcidProfileFields(item: any) {
  const name = item.credit_name || `${item.given_name || ""} ${item.family_name || ""}`.trim() || "Unknown";
  return { title: name, url: item.orcid_url || "" };
}
function extractOrcidWorksFields(item: any) {
  return { title: item.title || "", url: item.url || "", year: item.publication_date ? parseInt(String(item.publication_date).split("-")[0]) : null };
}

const FIELD_EXTRACTORS: Record<string, (item: any) => any> = {
  search_web: extractWebFields,
  search_epmc: extractEpmcFields,
  search_screening_list: extractScreeningFields,
  get_orcid_profile: extractOrcidProfileFields,
  search_orcid_works: extractOrcidWorksFields,
};

export interface ToolResult {
  tool: string;
  query: string;
  id: string;
  title: string;
  url: string;
  [key: string]: any;
}

export function normalizeToolCalls(rawCalls: RawToolCall[]): ToolResult[] {
  const results: ToolResult[] = [];
  for (const tc of rawCalls) {
    let data: any;
    try { data = JSON.parse(tc.modelOutput); } catch { data = {}; }
    const query = buildQuery(tc.toolName, tc.arguments);
    const items = data.results || [];
    const extractor = FIELD_EXTRACTORS[tc.toolName] || ((item: any) => ({ title: item.title || String(item), url: item.url || "" }));

    if (!items.length && data.id) {
      results.push({ tool: tc.toolName, query, id: data.id, title: data.message || "No results", url: "" });
    } else {
      for (const item of items) {
        results.push({ tool: tc.toolName, query, id: item.id || "", ...extractor(item) });
      }
    }
  }
  return results;
}

export async function completeWithTools(
  prompt: string,
  model: string = "google/gemini-2.5-pro-preview",
  toolNames?: string[],
  idCounters?: Record<string, number>,
  onToolCall?: (toolName: string, args: Record<string, any>) => void,
  onToolResult?: (toolName: string, id: string, count: number) => void,
): Promise<CompletionResult> {
  const tools = getToolDefinitions(toolNames);
  const inputItems: any[] = [{ role: "user", content: prompt }];
  const toolCalls: RawToolCall[] = [];
  const counters = idCounters || {};
  let outputItems: any[] = [];
  let data: any = {};

  for (let i = 0; i < 20; i++) {
    const payload = { model, input: inputItems, tools, tool_choice: "auto" };
    const res = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenRouter error ${res.status}: ${text}`);
    }
    data = await res.json();
    outputItems = data.output || [];

    const functionCalls = outputItems.filter((item: any) => item.type === "function_call");
    if (!functionCalls.length) break;

    for (const fc of functionCalls) {
      const funcName = fc.name || "";
      const callId = fc.call_id || "";
      let args: Record<string, any>;
      try { args = JSON.parse(fc.arguments || "{}"); } catch { args = {}; }

      onToolCall?.(funcName, args);

      const output = await executeTool(funcName, args);
      const modelOutput = formatForModel(funcName, output, counters);

      // Get the latest assigned ID for the callback
      const prefix = TOOL_PREFIXES[funcName] || funcName.slice(0, 4);
      const latestId = `${prefix}${counters[prefix] || 1}`;
      onToolResult?.(funcName, latestId, output.items.length);

      toolCalls.push({ toolName: funcName, arguments: args, output, modelOutput });

      inputItems.push({
        type: "function_call",
        id: fc.id || callId,
        call_id: callId,
        name: funcName,
        arguments: fc.arguments || "{}",
        status: "completed",
      });
      inputItems.push({
        type: "function_call_output",
        call_id: callId,
        output: modelOutput,
      });
    }
  }

  // Extract text from output
  let finalText = "";
  for (const item of outputItems) {
    if (item.type === "message") {
      const contentItems = item.content || [];
      finalText = contentItems
        .filter((c: any) => c.type === "output_text")
        .map((c: any) => c.text || "")
        .join("");
      break;
    }
  }
  if (!finalText) finalText = data.output_text || "";

  return { text: finalText, toolCalls };
}

export async function extractStructured(
  text: string,
  extractionPrompt: string,
  responseFormat: any,
  model: string = "google/gemini-2.5-flash",
): Promise<any> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: `${extractionPrompt}\n\n${text}` }],
      response_format: responseFormat,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter extraction error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = data.choices[0].message.content;
  return JSON.parse(content);
}

export async function generateText(
  prompt: string,
  model: string = "google/gemini-2.5-flash",
): Promise<string> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter text error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}
