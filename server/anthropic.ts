// Anthropic API integration - analogous to server/openai.ts
import Anthropic from "@anthropic-ai/sdk";

// TypeScript interfaces for API data structures (copied from shared/schema.ts)
export interface ToolCall {
  name: string;
  arguments: any;
  output: any;
}

export interface Annotation {
  type: string;
  content: string;
  source: string;
}

export interface SimplifiedResponse {
  text: string;
  tool_calls: ToolCall[];
  annotations: Annotation[];
  response_id?: string;
  usage?: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}

export interface MCPTool {
  server_label: string;
  server_url: string;
  require_approval: string;
}

// Initialize Anthropic client lazily
let anthropic: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Add beta header for MCP connector
      defaultHeaders: {
        "anthropic-beta": "mcp-client-2025-04-04"
      }
    });
  }
  return anthropic;
}

// Hardcoded MCP tools as specified by user
const HARDCODED_MCP_TOOLS: MCPTool[] = [
  {
    server_label: "custom_screening_tools",
    server_url: "https://cf-template.alejoacelas.workers.dev/sse",
    require_approval: "never"
  }
];

// Build MCP servers array for Anthropic API (MCP connector format)
function buildMCPServers(mcpTools: MCPTool[]) {
  return mcpTools.map(mcpTool => ({
    type: "url",
    url: mcpTool.server_url,
    name: mcpTool.server_label,
    tool_configuration: {
      enabled: true
    }
  }));
}

// Build tools array for Anthropic API (for web search, etc.)
function buildTools(webSearchEnabled: boolean) {
  const tools: any[] = [];

  if (webSearchEnabled) {
    tools.push({
      type: "web_search_20250305",
      name: "web_search",
      max_uses: 20
    });
  }

  return tools;
}

// Extract response data from Anthropic API output
function extractResponseData(response: any): SimplifiedResponse {
  const toolCalls: ToolCall[] = [];
  const annotations: Annotation[] = [];
  let text = "";
  let webSearchResults: any[] = [];
  let webSearchQuery: string | null = null;

  // Extract text and tool calls from content blocks
  if (response.content) {
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;

        // Extract citations from text blocks
        if (block.citations) {
          for (const citation of block.citations) {
            annotations.push({
              type: citation.type || 'citation',
              content: citation.cited_text || citation.title || '',
              source: citation.url || ''
            });
          }
        }
      }
      // Handle server tool use (includes web_search)
      else if (block.type === 'server_tool_use') {
        if (block.name === 'web_search') {
          webSearchQuery = block.input?.query || null;
        }
      }
      // Handle web search tool results
      else if (block.type === 'web_search_tool_result') {
        if (block.content && Array.isArray(block.content)) {
          for (const result of block.content) {
            if (result.type === 'web_search_result') {
              webSearchResults.push({
                type: 'web_search_result',
                content: result.title || '',
                source: result.url || ''
              });
            }
          }
        }
      }
      // Handle MCP tool use blocks
      else if (block.type === 'mcp_tool_use') {
        toolCalls.push({
          name: block.name || 'mcp_tool',
          arguments: {
            ...block.input,
            // Store the tool_use_id so we can match it with the result
            _tool_use_id: block.id,
            server_name: block.server_name
          },
          output: null
        });
      }
      // Handle MCP tool result blocks (these come after tool use)
      else if (block.type === 'mcp_tool_result') {
        // Find the corresponding tool call by matching tool_use_id with _tool_use_id
        const toolCall = toolCalls.find(tc => tc.arguments._tool_use_id === block.tool_use_id);
        if (toolCall) {
          toolCall.output = block.content || block;
        }
      }
      // Handle regular tool use (fallback)
      else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name || 'tool',
          arguments: block.input || {},
          output: null
        });
      }
    }
  }

  // Create web search tool call if we found web search activity
  if (webSearchQuery || webSearchResults.length > 0) {
    toolCalls.push({
      name: 'web_search',
      arguments: {
        query: webSearchQuery,
        status: 'completed'
      },
      output: webSearchResults
    });
  }

  return {
    text,
    tool_calls: toolCalls,
    annotations,
    response_id: response.id,
    usage: response.usage ? {
      total_tokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
      input_tokens: response.usage.input_tokens || 0,
      output_tokens: response.usage.output_tokens || 0,
    } : undefined,
    model: response.model
  };
}

// Extract final response from JSON field mode
function extractJsonFieldResponse(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (parsed.final_response) {
      return parsed.final_response;
    }
    return text;
  } catch {
    return text;
  }
}

interface StreamCallParams {
  model: string;
  input: string;
  instructions?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | null;
  webSearchEnabled: boolean;
  topP?: number | null;
  responseMode: 'markdown' | 'json-field';
}

// Map reasoning effort to thinking tokens
function getThinkingTokens(reasoningEffort?: 'low' | 'medium' | 'high' | null): number {
  if (!reasoningEffort) return 0;

  const mapping = {
    low: 5000,
    medium: 20000,
    high: 50000
  };

  return mapping[reasoningEffort];
}

// Stream responses from Anthropic API
export async function* streamAnthropicResponse(params: StreamCallParams) {
  const {
    model,
    input,
    instructions,
    reasoningEffort,
    webSearchEnabled,
    topP,
    responseMode,
  } = params;

  // Build guidance message with instructions wrapped in <guidance> tags
  let guidanceContent = "";
  if (instructions) {
    guidanceContent = instructions;
  }
  if (responseMode === 'json-field') {
    if (guidanceContent) {
      guidanceContent += "\n\nYou must respond with a JSON object containing a 'final_response' field with your answer.";
    } else {
      guidanceContent = "You must respond with a JSON object containing a 'final_response' field with your answer.";
    }
  }

  // Calculate thinking tokens
  const thinkingTokens = getThinkingTokens(reasoningEffort);

  // Calculate max_tokens (ensure it's high enough to accommodate thinking + output)
  // Using 16384 as base to ensure plenty of room for both thinking and output
  const maxTokens = 60000;

  // Build request parameters
  const requestParams: any = {
    model,
    max_tokens: maxTokens,
    messages: [],
    stream: true,
  };

  // Add guidance message as first message if instructions are provided
  if (guidanceContent) {
    requestParams.messages.push({
      role: "user",
      content: `<guidance>${guidanceContent}</guidance>`
    });
  }

  // Add the actual user input as the next message
  requestParams.messages.push({
    role: "user",
    content: input
  });

  // Add thinking budget if reasoning effort is specified
  if (thinkingTokens > 0) {
    requestParams.thinking = {
      type: "enabled",
      budget_tokens: thinkingTokens
    };
  }

  // Add top_p if specified
  if (topP !== null && topP !== undefined) {
    requestParams.top_p = topP;
  }

  // Add MCP servers using the connector format
  const mcpServers = buildMCPServers(HARDCODED_MCP_TOOLS);
  if (mcpServers.length > 0) {
    requestParams.mcp_servers = mcpServers;
  }

  // Add tools (like web search)
  const tools = buildTools(webSearchEnabled);
  if (tools.length > 0) {
    requestParams.tools = tools;
  }

  let completeResponse: any = null;
  let accumulatedText = "";

  try {
    // Make streaming API call
    const client = getAnthropicClient();
    const stream = await client.messages.stream(requestParams);

    for await (const event of stream) {
      // Send text deltas for streaming
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        accumulatedText += event.delta.text;
        yield {
          type: 'delta',
          content: event.delta.text
        };
      }
    }

    // Get final message
    completeResponse = await stream.finalMessage();

    // Process complete response
    if (completeResponse) {
      const simplifiedResponse = extractResponseData(completeResponse);

      // Extract JSON field if needed
      let finalText = simplifiedResponse.text;
      if (responseMode === 'json-field') {
        finalText = extractJsonFieldResponse(simplifiedResponse.text);
      }

      yield {
        type: 'complete',
        response: {
          ...simplifiedResponse,
          text: finalText
        }
      };
    } else {
      throw new Error('No complete response received from Anthropic');
    }
  } catch (error) {
    console.error('Error streaming Anthropic response:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
