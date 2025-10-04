import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, Loader2, AlertCircle, ChevronDown, Search, Wrench } from "lucide-react";
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

  // Parse tool calls and annotations
  const toolCalls = (response.toolCalls as ToolCall[] | null) || [];
  const annotations = (response.annotations as Annotation[] | null) || [];

  // Extract web search queries
  const webSearchCall = toolCalls.find(tc => tc.name === 'web_search');
  const webSearchQueries = webSearchCall?.arguments?.queries || [];
  const webSearchResults = (webSearchCall?.output as Annotation[]) || [];
  
  // Extract MCP tool calls
  const mcpToolCalls = toolCalls.filter(tc => tc.name !== 'web_search');

  const hasToolCalls = toolCalls.length > 0;

  // Display content (streaming or final)
  const displayContent = isStreaming && streamingText ? streamingText : response.content;

  return (
    <Card className="p-6 animate-fade-in" data-testid={`response-card-${response.id}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold" data-testid={`response-title-${response.id}`}>
            {response.displayName}
          </h3>
          <Badge variant="outline" className="text-xs" data-testid={`response-model-${response.id}`}>
            {response.model}
          </Badge>
        </div>
        
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-2 text-chart-3" data-testid={`response-status-streaming-${response.id}`}>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs font-medium">Streaming...</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-2 text-chart-2" data-testid={`response-status-completed-${response.id}`}>
              <Check className="w-4 h-4" />
              <span className="text-xs font-medium">Completed</span>
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-2 text-destructive" data-testid={`response-status-error-${response.id}`}>
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Error</span>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="prose prose-sm max-w-none mb-4" data-testid={`response-content-${response.id}`}>
        {isError ? (
          <div className="text-destructive">
            {response.error || "An error occurred while processing this response."}
          </div>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
              h1: ({ children }) => <h1 className="text-xl font-semibold mb-3 mt-6 first:mt-0">{children}</h1>,
              h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 mt-5 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
              code: ({ children }) => <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded">{children}</code>,
              pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-4 font-mono text-sm">{children}</pre>,
              table: ({ children }) => <Table className="mb-4">{children}</Table>,
              thead: ({ children }) => <TableHeader>{children}</TableHeader>,
              tbody: ({ children }) => <TableBody>{children}</TableBody>,
              tr: ({ children }) => <TableRow>{children}</TableRow>,
              th: ({ children }) => <TableHead>{children}</TableHead>,
              td: ({ children }) => <TableCell>{children}</TableCell>,
            }}
          >
            {displayContent || ""}
          </ReactMarkdown>
        )}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
        )}
      </div>

      {/* Tool Calls Section */}
      {hasToolCalls && (
        <Collapsible open={toolCallsOpen} onOpenChange={setToolCallsOpen}>
          <CollapsibleTrigger 
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover-elevate w-full rounded-md p-2 -ml-2"
            data-testid={`response-tools-toggle-${response.id}`}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${toolCallsOpen ? 'rotate-180' : ''}`} />
            <span>Tool Calls ({toolCalls.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              {/* Web Search */}
              {webSearchCall && (
                <div data-testid={`response-websearch-${response.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4 text-chart-2" />
                    <span className="text-sm font-medium">Web Search</span>
                  </div>
                  {webSearchQueries.length > 0 && (
                    <div className="mb-2 space-y-1">
                      <p className="text-xs text-muted-foreground">Queries:</p>
                      {webSearchQueries.map((query: string, idx: number) => (
                        <div key={idx} className="text-sm pl-4 border-l-2 border-border">
                          "{query}"
                        </div>
                      ))}
                    </div>
                  )}
                  {webSearchResults.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Results:</p>
                      {webSearchResults.map((result, idx) => (
                        <div key={idx} className="text-sm pl-4 border-l-2 border-border">
                          <a 
                            href={result.source} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {result.content}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MCP Tools */}
              {mcpToolCalls.map((toolCall, idx) => (
                <div key={idx} data-testid={`response-mcp-tool-${idx}-${response.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{toolCall.name}</span>
                  </div>
                  {toolCall.arguments && (
                    <div className="text-xs font-mono bg-background rounded p-2 mb-2">
                      <pre>{JSON.stringify(toolCall.arguments, null, 2)}</pre>
                    </div>
                  )}
                  {toolCall.output && (
                    <div className="text-sm text-muted-foreground">
                      Output: {typeof toolCall.output === 'string' ? toolCall.output : JSON.stringify(toolCall.output)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Footer Metadata */}
      {isCompleted && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono pt-4 border-t border-border mt-4 flex-wrap" data-testid={`response-metadata-${response.id}`}>
          {response.totalTokens && (
            <span>
              {response.inputTokens}/{response.outputTokens}/{response.totalTokens} tokens
            </span>
          )}
          {response.duration && (
            <span>{(response.duration / 1000).toFixed(2)}s</span>
          )}
        </div>
      )}
    </Card>
  );
}
