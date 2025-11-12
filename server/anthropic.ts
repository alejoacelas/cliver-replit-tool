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
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropic;
}

// Infer customer name and institution from message text
export async function inferCustomerInfo(messageText: string): Promise<{ customerName: string; institution: string }> {
  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: "claude-3-5-haiku-20241022", // Using Haiku for fast, efficient extraction
      max_tokens: 100,
      temperature: 0.3,
      messages: [
        {
          role: "user",
          content: `Extract the customer's name and institution/company name from this text. Respond ONLY with a JSON object in this exact format: {"customerName": "name or Unknown client", "institution": "institution or Unknown institution"}. If information is not found, use the default values.\n\nText: ${messageText}`
        }
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const parsed = JSON.parse(responseText);

    return {
      customerName: parsed.customerName || "Unknown client",
      institution: parsed.institution || "Unknown institution"
    };
  } catch (error) {
    console.error("Error inferring customer info:", error);
    return {
      customerName: "Unknown client",
      institution: "Unknown institution"
    };
  }
}

// Hardcoded MCP tools as specified by user
const HARDCODED_MCP_TOOLS: MCPTool[] = [
  {
    server_label: "custom_screening_tools",
    server_url: "https://cf-template.alejoacelas.workers.dev/sse",
    require_approval: "never"
  }
];

// Build tools array for Anthropic API
function buildTools(mcpTools: MCPTool[]) {
  const tools: any[] = [];

  // Add MCP tools
  mcpTools.forEach(mcpTool => {
    tools.push({
      type: "custom",
      name: mcpTool.server_label,
      description: `MCP tool from ${mcpTool.server_url}`,
      input_schema: {
        type: "object",
        properties: {},
        required: []
      }
    });
  });

  return tools;
}

// Extract response data from Anthropic API output
function extractResponseData(response: any): SimplifiedResponse {
  const toolCalls: ToolCall[] = [];
  const annotations: Annotation[] = [];
  let text = "";

  // Extract text from content blocks
  if (response.content) {
    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          name: block.name || 'tool',
          arguments: block.input || {},
          output: null
        });
      }
    }
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
  webSearchEnabled: boolean;
  topP?: number | null;
  responseMode: 'markdown' | 'json-field';
}

// Stream responses from Anthropic API
export async function* streamAnthropicResponse(params: StreamCallParams) {
  const {
    model,
    input,
    instructions,
    webSearchEnabled,
    topP,
    responseMode,
  } = params;

  // Build system prompt
  let systemPrompt = instructions || "";
  if (responseMode === 'json-field') {
    systemPrompt += "\n\nYou must respond with a JSON object containing a 'final_response' field with your answer.";
  }

  // Build request parameters
  const requestParams: any = {
    model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: input
      }
    ],
    stream: true,
  };

  // Add system prompt if specified
  if (systemPrompt) {
    requestParams.system = systemPrompt;
  }

  // Add top_p if specified
  if (topP !== null && topP !== undefined) {
    requestParams.top_p = topP;
  }

  // Add tools if MCP tools are configured
  const tools = buildTools(HARDCODED_MCP_TOOLS);
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
