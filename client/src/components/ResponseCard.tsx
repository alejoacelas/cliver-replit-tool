import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Loader2, AlertCircle, ChevronRight, Search, BookOpen, Shield } from "lucide-react";
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

function DecisionBadge({ status }: { status: string }) {
  if (status === "PASS") {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><Check className="w-3 h-3" /> PASS</span>;
  }
  if (status === "FLAG") {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3" /> FLAG</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3" /> REVIEW</span>;
}

function CheckStatusBadge({ status }: { status: string }) {
  if (status === "NO FLAG") return <span className="text-xs text-green-700">NO FLAG</span>;
  if (status === "FLAG") return <span className="text-xs text-red-700 font-medium">FLAG</span>;
  return <span className="text-xs text-yellow-700">UNDETERMINED</span>;
}

const TOOL_LABELS: Record<string, string> = {
  search_web: "Web Search",
  search_screening_list: "Screening List",
  search_epmc: "PubMed Central",
  get_orcid_profile: "ORCID Profile",
  search_orcid_works: "ORCID Works",
};

export function ResponseCard({ response, streamingStatus, streamingToolEvents, completeData }: ResponseCardProps) {
  const [rawOpen, setRawOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const isStreaming = response.status === "streaming";
  const isError = response.status === "error";
  const isCompleted = response.status === "completed";

  // Use completeData from props (streaming) or try to parse from response content for persisted data
  const complete = completeData || null;
  const toolCalls = complete?.audit?.toolCalls || (response.toolCalls as any[] | null) || [];
  const hasToolCalls = toolCalls.length > 0;

  return (
    <div className="border border-border rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          {complete?.decision && <DecisionBadge status={complete.decision.status} />}
          <span className="text-xs text-muted-foreground shrink-0">{response.model}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">{streamingStatus || "Processing..."}</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Check className="w-3 h-3" />
              <span className="text-xs">Done</span>
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs">Error</span>
            </div>
          )}
        </div>
      </div>

      {/* Streaming tool events */}
      {isStreaming && streamingToolEvents && streamingToolEvents.length > 0 && !response.content && (
        <div className="px-4 py-2 border-b border-border space-y-1">
          {streamingToolEvents.map((evt, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Search className="w-3 h-3" />
              <span>{TOOL_LABELS[evt.tool] || evt.tool}</span>
              {evt.type === "result" && evt.count !== undefined && (
                <span className="text-foreground/60">({evt.count} results)</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Decision summary and checks */}
      {complete?.decision && (
        <div className="px-4 py-3 border-b border-border space-y-3">
          {complete.decision.summary && (
            <p className="text-sm">{complete.decision.summary}</p>
          )}

          {complete.checks && complete.checks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Criterion</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complete.checks.map((check: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{check.criterion}</TableCell>
                    <TableCell><CheckStatusBadge status={check.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{check.evidence}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {complete.backgroundWork && complete.backgroundWork.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs font-medium">Background Work</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Relevance</TableHead>
                    <TableHead className="text-xs">Organism</TableHead>
                    <TableHead className="text-xs">Summary</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {complete.backgroundWork.map((work: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{work.relevance}</TableCell>
                      <TableCell className="text-xs">{work.organism}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{work.summary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Main content (raw markdown) */}
      {response.content && (
        <div className="border-b border-border">
          <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full px-4 py-2 transition-colors">
              <ChevronRight className={`w-3 h-3 transition-transform ${rawOpen ? "rotate-90" : ""}`} />
              <span>Raw analysis</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-3">
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
                    code: ({ children }) => <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{children}</code>,
                    pre: ({ children }) => <pre className="bg-muted p-3 rounded-md overflow-x-auto mb-3 font-mono text-xs">{children}</pre>,
                    table: ({ children }) => <Table className="mb-3">{children}</Table>,
                    thead: ({ children }) => <TableHeader>{children}</TableHeader>,
                    tbody: ({ children }) => <TableBody>{children}</TableBody>,
                    tr: ({ children }) => <TableRow>{children}</TableRow>,
                    th: ({ children }) => <TableHead className="text-xs">{children}</TableHead>,
                    td: ({ children }) => <TableCell className="text-xs">{children}</TableCell>,
                  }}
                >
                  {response.content}
                </ReactMarkdown>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Streaming text (before complete) */}
      {isStreaming && response.content && !complete && (
        <div className="px-4 py-3">
          <div className="prose prose-sm max-w-none prose-headings:font-medium prose-p:leading-relaxed prose-p:text-foreground/85">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response.content}
            </ReactMarkdown>
          </div>
          <span className="inline-block w-1.5 h-3.5 bg-foreground/30 animate-pulse ml-0.5" />
        </div>
      )}

      {/* Error */}
      {isError && response.error && (
        <div className="px-4 py-3 text-sm text-destructive">
          {response.error}
        </div>
      )}

      {/* Tool calls audit */}
      {hasToolCalls && (
        <div className="border-t border-border">
          <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full px-4 py-2 transition-colors">
              <ChevronRight className={`w-3 h-3 transition-transform ${toolsOpen ? "rotate-90" : ""}`} />
              <Shield className="w-3 h-3" />
              <span>{toolCalls.length} source{toolCalls.length === 1 ? "" : "s"} cited</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-3">
              <div className="space-y-1">
                {toolCalls.map((tc: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground font-mono shrink-0">[{tc.id}]</span>
                    <div className="min-w-0">
                      {tc.url ? (
                        <a href={tc.url} target="_blank" rel="noopener noreferrer" className="text-foreground/70 hover:text-foreground underline underline-offset-2 truncate block">
                          {tc.title || tc.url}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">{tc.title || tc.tool}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Metadata footer */}
      {isCompleted && response.duration && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono px-4 py-2 border-t border-border">
          <span>{(response.duration / 1000).toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
}
