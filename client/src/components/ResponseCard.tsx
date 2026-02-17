import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, ChevronRight, Search } from "lucide-react";
import type { Response } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

interface ResponseCardProps {
  response: Response;
  streamingStatus?: string | null;
  streamingToolEvents?: Array<{ type: string; tool: string; args?: any; id?: string; count?: number }>;
  completeData?: any;
}

const TOOL_LABELS: Record<string, string> = {
  search_web: "Web",
  search_screening_list: "Screening",
  search_epmc: "EPMC",
  get_orcid_profile: "ORCID",
  search_orcid_works: "ORCID",
};

function groupToolCalls(toolCalls: any[]) {
  const groups: Record<string, any[]> = {};
  for (const tc of toolCalls) {
    const label = TOOL_LABELS[tc.tool] || tc.tool || "Other";
    if (!groups[label]) groups[label] = [];
    groups[label].push(tc);
  }
  return groups;
}

export function ResponseCard({ response, streamingStatus, streamingToolEvents, completeData }: ResponseCardProps) {
  const [rawOpen, setRawOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const isStreaming = response.status === "streaming";
  const isError = response.status === "error";
  const isCompleted = response.status === "completed";

  // Reconstruct complete data: prefer streaming prop, fall back to persisted toolCalls
  const persisted = response.toolCalls as any;
  const complete = completeData || (persisted?.decision ? persisted : null);
  const toolCalls = complete?.audit?.toolCalls || (Array.isArray(persisted) ? persisted : []);
  const hasToolCalls = toolCalls.length > 0;

  // Build source ID → {url, title} lookup for hyperlinking
  const sourceMap = new Map<string, { url?: string; title?: string }>();
  for (const tc of toolCalls) {
    if (tc.id) sourceMap.set(tc.id, { url: tc.url, title: tc.title });
  }

  // --- Streaming state (replaces everything while in progress) ---
  if (isStreaming && !complete) {
    return (
      <div className="space-y-3 py-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span className="text-sm">{streamingStatus || "Processing…"}</span>
        </div>

        {streamingToolEvents && streamingToolEvents.length > 0 && (
          <div className="space-y-1 pl-0.5">
            {streamingToolEvents.map((evt, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="w-3 h-3 shrink-0" />
                <span>{TOOL_LABELS[evt.tool] || evt.tool}</span>
                {evt.type === "result" && evt.count !== undefined && (
                  <span className="font-mono text-foreground/50">{evt.count} results</span>
                )}
              </div>
            ))}
          </div>
        )}

        {response.content && (
          <div className="prose prose-sm max-w-none prose-headings:font-medium prose-p:leading-relaxed prose-p:text-foreground/85">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response.content}
            </ReactMarkdown>
            <span className="inline-block w-1.5 h-3.5 bg-foreground/30 animate-pulse ml-0.5" />
          </div>
        )}
      </div>
    );
  }

  // --- Error state ---
  if (isError) {
    return (
      <div className="py-3 text-sm text-destructive">
        {response.error || "An error occurred."}
      </div>
    );
  }

  // --- Completed / has data ---
  return (
    <div className="space-y-0">
      {/* 1. Decision headline */}
      {complete?.decision && (
        <div className="flex items-start justify-between gap-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className={decisionClass(complete.decision.status)}>
                {complete.decision.status}
              </span>
              {complete.decision.flags_count > 0 && (
                <span className="text-xs text-muted-foreground">
                  {complete.decision.flags_count} flag{complete.decision.flags_count === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {complete.decision.summary && (
              <p className="text-sm text-muted-foreground leading-snug">
                {complete.decision.summary}
              </p>
            )}
          </div>
          {isCompleted && response.duration && (
            <span className="text-xs font-mono text-muted-foreground shrink-0 pt-0.5">
              {(response.duration / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      )}

      {/* 2. Checks grid */}
      {complete?.checks && complete.checks.length > 0 && (
        <div className="border-t border-border py-3 space-y-2">
          {complete.checks.map((check: any, i: number) => (
            <div key={i} className="space-y-0.5">
              <div className="flex items-baseline gap-2">
                <span className={checkStatusClass(check.status)}>
                  {check.status}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {check.criterion}
                </span>
              </div>
              {check.evidence && (
                <p className="text-xs text-muted-foreground leading-relaxed pl-0.5">
                  {check.evidence}
                  {check.sources && check.sources.length > 0 && (
                    <>
                      {" "}
                      {check.sources.map((src: string, j: number) => (
                        <SourceRef key={j} id={src} sourceMap={sourceMap} />
                      ))}
                    </>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Background work */}
      {complete?.backgroundWork && complete.backgroundWork.length > 0 && (
        <div className="border-t border-border py-3 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Background Work
          </span>
          {complete.backgroundWork.map((work: any, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-xs font-mono text-muted-foreground shrink-0 pt-px">
                {work.relevance}
              </span>
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground">{work.organism}</span>
                {work.summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {work.summary}
                    {work.sources && work.sources.length > 0 && (
                      <>
                        {" "}
                        {work.sources.map((src: string, j: number) => (
                          <SourceRef key={j} id={src} sourceMap={sourceMap} />
                        ))}
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Raw analysis (collapsible, default closed) */}
      {response.content && (
        <div className="border-t border-border">
          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full py-2.5 transition-colors">
              <ChevronRight className={`w-3 h-3 transition-transform ${rawOpen ? "rotate-90" : ""}`} />
              <span>Full analysis</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pb-3">
              <div className="prose prose-sm max-w-none prose-headings:font-medium prose-p:leading-relaxed prose-p:text-foreground/85">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-0.5">{children}</ol>,
                    h1: ({ children }) => <h1 className="text-base font-medium mb-2 mt-4 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-medium mb-1.5 mt-3 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-medium mb-1.5 mt-3 first:mt-0">{children}</h3>,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-foreground/70 hover:text-foreground underline underline-offset-2">
                        {children}
                      </a>
                    ),
                    code: ({ children }) => <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{children}</code>,
                    pre: ({ children }) => <pre className="bg-muted p-3 rounded-md overflow-x-auto mb-3 font-mono text-xs">{children}</pre>,
                  }}
                >
                  {response.content}
                </ReactMarkdown>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* 5. Sources cited (collapsible, default closed) */}
      {hasToolCalls && (
        <div className="border-t border-border">
          <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full py-2.5 transition-colors">
              <ChevronRight className={`w-3 h-3 transition-transform ${sourcesOpen ? "rotate-90" : ""}`} />
              <span>{toolCalls.length} source{toolCalls.length === 1 ? "" : "s"}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="pb-3">
              <div className="space-y-3">
                {Object.entries(groupToolCalls(toolCalls)).map(([group, items]) => (
                  <div key={group} className="space-y-1">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {group}
                    </span>
                    {items.map((tc: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-muted-foreground shrink-0">[{tc.id}]</span>
                        <div className="min-w-0">
                          {tc.url ? (
                            <a
                              href={tc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground/70 hover:text-foreground underline underline-offset-2 truncate block"
                            >
                              {tc.title || tc.url}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">{tc.title || tc.tool}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Duration fallback if no decision block showed it */}
      {isCompleted && response.duration && !complete?.decision && (
        <div className="border-t border-border py-2">
          <span className="text-xs font-mono text-muted-foreground">
            {(response.duration / 1000).toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  );
}

// --- Inline source reference (links when URL available) ---

function SourceRef({ id, sourceMap }: { id: string; sourceMap: Map<string, { url?: string; title?: string }> }) {
  const source = sourceMap.get(id);
  if (source?.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-foreground/50 hover:text-foreground underline underline-offset-2"
        title={source.title || source.url}
      >
        [{id}]
      </a>
    );
  }
  return <span className="font-mono text-foreground/40">[{id}] </span>;
}

// --- Style helpers ---

function decisionClass(status: string): string {
  const base = "text-lg font-semibold tracking-tight";
  if (status === "FLAG") return `${base} text-destructive`;
  if (status === "REVIEW") return `${base} text-foreground border-b-2 border-foreground`;
  // PASS or anything else
  return `${base} text-foreground`;
}

function checkStatusClass(status: string): string {
  if (status === "FLAG") return "text-xs text-destructive font-medium";
  if (status === "UNDETERMINED") return "text-xs text-foreground font-medium";
  // NO FLAG
  return "text-xs text-muted-foreground";
}
