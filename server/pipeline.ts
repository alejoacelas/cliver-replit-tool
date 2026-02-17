import type { SSEEvent, CompleteData } from "@shared/schema";
import {
  completeWithTools,
  extractStructured,
  generateText,
  normalizeToolCalls,
  type RawToolCall,
  type CompletionResult,
} from "./openrouter.js";
import {
  VERIFICATION_PROMPT,
  WORK_PROMPT,
  EXTRACTION_PROMPT_EVIDENCE,
  EXTRACTION_PROMPT_DETERMINATIONS,
  EXTRACTION_PROMPT_WORK,
  SUMMARY_PROMPT,
  VERIFICATION_EVIDENCE_SCHEMA,
  VERIFICATION_DETERMINATION_SCHEMA,
  BACKGROUND_WORK_SCHEMA,
} from "./prompts.js";

const MAIN_MODEL = "google/gemini-3-pro-preview";
const EXTRACTION_MODEL = "google/gemini-3-flash-preview";
const TOOL_CONTEXT_TRUNCATION = 2000;
const SANCTIONS_CRITERION = "Sanctions and Export Control Screening";

function formatToolContext(toolCalls: RawToolCall[]): string {
  if (!toolCalls.length) return "";
  const lines = ["\n\n=== Tool Outputs Reference ==="];
  for (const tc of toolCalls) {
    lines.push(`\n[${tc.toolName}]:`);
    const preview = tc.modelOutput.length > TOOL_CONTEXT_TRUNCATION
      ? tc.modelOutput.slice(0, TOOL_CONTEXT_TRUNCATION)
      : tc.modelOutput;
    lines.push(preview);
  }
  return lines.join("\n");
}

function computeDecision(determinations: any[]): { status: string; flags_count: number; summary?: string } {
  let sanctionsFlag = false;
  const otherIssues: any[] = [];

  for (const d of determinations) {
    if (d.criterion === SANCTIONS_CRITERION) {
      if (d.flag === "FLAG") sanctionsFlag = true;
    } else {
      if (d.flag === "FLAG" || d.flag === "UNDETERMINED") otherIssues.push(d);
    }
  }

  if (sanctionsFlag) return { status: "FLAG", flags_count: 1 };
  if (otherIssues.length) return { status: "REVIEW", flags_count: otherIssues.length };
  return { status: "PASS", flags_count: 0 };
}

function mergeChecks(evidence: any[], determinations: any[]) {
  const evByC: Record<string, any> = {};
  for (const e of evidence) evByC[e.criterion] = e;
  const detByC: Record<string, any> = {};
  for (const d of determinations) detByC[d.criterion] = d;

  const checks: any[] = [];
  for (const criterion of Object.keys(evByC)) {
    const ev = evByC[criterion];
    const det = detByC[criterion];
    if (ev && det) {
      checks.push({
        criterion,
        status: det.flag,
        evidence: ev.evidence_summary,
        sources: ev.sources,
      });
    }
  }
  return checks;
}

export async function* runPipeline(customerInfo: string): AsyncGenerator<SSEEvent> {
  const idCounters: Record<string, number> = {};

  // Step 1: Verification prompt
  yield { type: "status", message: "Running verification checks..." };

  const verificationPrompt = VERIFICATION_PROMPT.replace("{{customer_info}}", customerInfo);
  let verificationResult: CompletionResult;
  try {
    verificationResult = await completeWithTools(
      verificationPrompt,
      MAIN_MODEL,
      undefined,
      idCounters,
      (tool, args) => { /* tool_call events sent below */ },
      (tool, id, count) => { /* tool_result events sent below */ },
    );
  } catch (e: any) {
    yield { type: "error", message: `Verification failed: ${e.message}` };
    return;
  }

  // Emit tool call events for verification
  for (const tc of verificationResult.toolCalls) {
    yield { type: "tool_call", tool: tc.toolName, args: tc.arguments };
    try {
      const data = JSON.parse(tc.modelOutput);
      const items = data.results || [];
      const prefix = tc.toolName === "search_web" ? "web" : tc.toolName === "search_screening_list" ? "screen" : tc.toolName === "search_epmc" ? "epmc" : tc.toolName === "get_orcid_profile" ? "orcid" : "tool";
      const lastId = items.length ? items[items.length - 1].id : data.id || `${prefix}1`;
      yield { type: "tool_result", tool: tc.toolName, id: lastId, count: items.length || (data.id ? 1 : 0) };
    } catch {
      yield { type: "tool_result", tool: tc.toolName, id: "", count: 0 };
    }
  }

  // Step 2: Work prompt (always run - assumes order info is in customerInfo)
  yield { type: "status", message: "Searching for background work..." };

  const workPrompt = WORK_PROMPT.replace("{{customer_info}}", customerInfo);
  let workResult: CompletionResult | null = null;
  try {
    workResult = await completeWithTools(
      workPrompt,
      MAIN_MODEL,
      undefined,
      idCounters,
    );
  } catch (e: any) {
    console.error("Work prompt failed:", e);
    // Non-fatal: continue without work results
  }

  if (workResult) {
    for (const tc of workResult.toolCalls) {
      yield { type: "tool_call", tool: tc.toolName, args: tc.arguments };
      try {
        const data = JSON.parse(tc.modelOutput);
        const items = data.results || [];
        const lastId = items.length ? items[items.length - 1].id : data.id || "";
        yield { type: "tool_result", tool: tc.toolName, id: lastId, count: items.length || (data.id ? 1 : 0) };
      } catch {
        yield { type: "tool_result", tool: tc.toolName, id: "", count: 0 };
      }
    }
  }

  // Step 3: Structured extractions (parallel)
  yield { type: "status", message: "Extracting structured results..." };

  const verificationContext = verificationResult.text + formatToolContext(verificationResult.toolCalls);
  const workContext = workResult ? workResult.text + formatToolContext(workResult.toolCalls) : null;

  try {
    const extractionTasks: Promise<any>[] = [
      extractStructured(verificationContext, EXTRACTION_PROMPT_EVIDENCE, VERIFICATION_EVIDENCE_SCHEMA, EXTRACTION_MODEL),
      extractStructured(verificationContext, EXTRACTION_PROMPT_DETERMINATIONS, VERIFICATION_DETERMINATION_SCHEMA, EXTRACTION_MODEL),
    ];
    if (workContext) {
      extractionTasks.push(
        extractStructured(workContext, EXTRACTION_PROMPT_WORK, BACKGROUND_WORK_SCHEMA, EXTRACTION_MODEL),
      );
    }

    const results = await Promise.all(extractionTasks);
    const evidenceData = results[0];
    const determinationsData = results[1];
    const workData = results.length > 2 ? results[2] : null;

    const evidenceList = evidenceData.rows || [];
    const determinationsList = determinationsData.rows || [];

    // Compute decision
    const decision = computeDecision(determinationsList);

    // Merge checks
    const checks = mergeChecks(evidenceList, determinationsList);

    // Convert background work
    const backgroundWork = workData?.rows?.length
      ? workData.rows.map((r: any) => ({
          relevance: r.relevance_level,
          organism: r.organism,
          summary: r.work_summary,
          sources: r.sources,
        }))
      : null;

    // Step 4: Generate summary
    yield { type: "status", message: "Generating summary..." };

    let summary: string;
    try {
      const summaryPrompt = SUMMARY_PROMPT
        .replace("{{customer_info}}", customerInfo)
        .replace("{{verification_raw}}", verificationResult.text)
        .replace("{{work_raw}}", workResult?.text || "No order details provided.");
      summary = (await generateText(summaryPrompt, EXTRACTION_MODEL)).trim().replace(/^["']|["']$/g, "");
    } catch {
      summary = decision.status === "PASS"
        ? "All verification criteria passed."
        : decision.status === "FLAG"
        ? "Sanctions screening flagged - requires immediate review."
        : "Some criteria require manual review.";
    }

    decision.summary = summary;

    // Combine all tool calls for audit
    const allToolCalls = [...verificationResult.toolCalls];
    if (workResult) allToolCalls.push(...workResult.toolCalls);

    // Stream the raw markdown text
    const fullText = `## Verification Analysis\n\n${verificationResult.text}\n\n## Background Work\n\n${workResult?.text || "Not analyzed."}`;
    // Send as a single delta (not chunked, since the text is already complete)
    yield { type: "delta", content: fullText };

    // Send complete event
    const completeData: CompleteData = {
      decision: decision as any,
      checks,
      backgroundWork,
      audit: {
        toolCalls: normalizeToolCalls(allToolCalls),
        raw: {
          verification: verificationResult.text,
          work: workResult?.text || null,
        },
      },
    };

    yield { type: "complete", data: completeData };
  } catch (e: any) {
    yield { type: "error", message: `Extraction failed: ${e.message}` };
  }
}
