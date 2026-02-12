import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Loader2, AlertCircle, ChevronRight, Search, Wrench } from "lucide-react";
import type { MessageResponse, ToolCall, Annotation } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";

interface ResponseCardProps {
  response: MessageResponse;
  streamingText?: string;
}

export function ResponseCard({ response, streamingText }: ResponseCardProps) {
  const [toolCallsOpen, setToolCallsOpen] = useState(false);
  const isStreaming = response.status === "streaming";
  const isError = response.status === "error";
  const isCompleted = response.status === "completed";

  const toolCalls = (response.toolCalls as ToolCall[] | null) || [];
  const annotations = (response.annotations as Annotation[] | null) || [];

  const webSearchCall = toolCalls.find(tc => tc.name === 'web_search');
  const webSearchQueries = webSearchCall?.arguments?.queries || [];
  const webSearchResults = (webSearchCall?.output as Annotation[]) || [];
  const mcpToolCalls = toolCalls.filter(tc => tc.name !== 'web_search');
  const hasToolCalls = toolCalls.length > 0;

  const displayContent = isStreaming && streamingText ? streamingText : response.content;

  return (
    <div className="border border-border rounded-lg" data-testid={`response-card-${response.id}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate" data-testid={`response-title-${response.id}`}>
            {response.displayName}
          </span>
          <span className="text-xs text-muted-foreground shrink-0" data-testid={`response-model-${response.id}`}>
            {response.model}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-muted-foreground" data-testid={`response-status-streaming-${response.id}`}>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">Streaming</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5 text-muted-foreground" data-testid={`response-status-completed-${response.id}`}>
              <Check className="w-3 h-3" />
              <span className="text-xs">Done</span>
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-1.5 text-destructive" data-testid={`response-status-error-${response.id}`}>
              <AlertCircle className="w-3 h-3" />
              <span className="text-xs">Error</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-3" data-testid={`response-content-${response.id}`}>
        {isError ? (
          <div className="text-sm text-destructive">
            {response.error || "An error occurred while processing this response."}
          </div>
        ) : (
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
              {displayContent || ""}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-3.5 bg-foreground/30 animate-pulse ml-0.5" />
        )}
      </div>

      {hasToolCalls && (
        <div className="border-t border-border">
          <Collapsible open={toolCallsOpen} onOpenChange={setToolCallsOpen}>
            <CollapsibleTrigger
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full px-4 py-2 transition-colors"
              data-testid={`response-tools-toggle-${response.id}`}
            >
              <ChevronRight className={`w-3 h-3 transition-transform ${toolCallsOpen ? 'rotate-90' : ''}`} />
              <span>{toolCalls.length} tool {toolCalls.length === 1 ? 'call' : 'calls'}</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-3">
              <div className="space-y-3">
                {webSearchCall && (
                  <div data-testid={`response-websearch-${response.id}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Search className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-medium">Web Search</span>
                    </div>
                    {webSearchQueries.length > 0 && (
                      <div className="mb-1.5 space-y-0.5">
                        {webSearchQueries.map((query: string, idx: number) => (
                          <div key={idx} className="text-xs text-muted-foreground pl-3 border-l border-border">
                            {query}
                          </div>
                        ))}
                      </div>
                    )}
                    {webSearchResults.length > 0 && (
                      <div className="space-y-0.5">
                        {webSearchResults.map((result, idx) => (
                          <div key={idx} className="text-xs pl-3 border-l border-border">
                            <a
                              href={result.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-foreground/70 hover:text-foreground underline underline-offset-2"
                            >
                              {result.content}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {mcpToolCalls.map((toolCall, idx) => (
                  <div key={idx} data-testid={`response-mcp-tool-${idx}-${response.id}`}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Wrench className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-medium">{toolCall.name}</span>
                    </div>
                    {toolCall.arguments && (
                      <div className="text-xs font-mono bg-muted rounded p-2 mb-1.5 overflow-x-auto">
                        <pre>{JSON.stringify(toolCall.arguments, null, 2)}</pre>
                      </div>
                    )}
                    {toolCall.output && (
                      <div className="text-xs text-muted-foreground">
                        {typeof toolCall.output === 'string' ? toolCall.output : JSON.stringify(toolCall.output)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {isCompleted && (response.totalTokens || response.duration) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono px-4 py-2 border-t border-border" data-testid={`response-metadata-${response.id}`}>
          {response.totalTokens && (
            <span>{response.inputTokens}/{response.outputTokens}/{response.totalTokens} tok</span>
          )}
          {response.duration && (
            <span>{(response.duration / 1000).toFixed(1)}s</span>
          )}
        </div>
      )}
    </div>
  );
}
