// Referenced from javascript_openai blueprint and user-provided MCP tools integration
import OpenAI from "openai";
import type { MCPTool, SimplifiedResponse, ToolCall, Annotation } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Infer customer name and institution from message text
export async function inferCustomerInfo(messageText: string): Promise<{ customerName: string; institution: string }> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano", // Using gpt-4.1-nano as specified for customer info extraction
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts customer information from text. Extract the customer's name and institution/company name. Respond ONLY with a JSON object in this exact format: {\"customerName\": \"name or Unknown client\", \"institution\": \"institution or Unknown institution\"}. If information is not found, use the default values."
        },
        {
          role: "user",
          content: messageText
        }
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
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

// Build tools array for OpenAI Responses API
function buildTools(mcpTools: MCPTool[], webSearch: boolean) {
  const tools: any[] = [];
  
  // Add MCP tools
  mcpTools.forEach(mcpTool => {
    tools.push({
      type: "mcp",
      server_label: mcpTool.server_label,
      server_url: mcpTool.server_url,
      require_approval: mcpTool.require_approval
    });
  });
  
  // Add web search
  if (webSearch) {
    tools.push({
      type: "web_search"
    });
  }
  
  return tools;
}

// Determine if model supports reasoning effort
function shouldIncludeReasoning(model: string): boolean {
  return model.toLowerCase().includes('o3') || model.toLowerCase().includes('o1');
}

// Extract response data from OpenAI Responses API output
function extractResponseData(response: any): SimplifiedResponse {
  const toolCalls: ToolCall[] = [];
  const annotations: Annotation[] = [];
  let text = "";
  let webSearchQueries: string[] = [];
  let webSearchAnnotations: Annotation[] = [];

  // Extract from response.output array
  if (response.output) {
    for (const outputItem of response.output) {
      if (outputItem.type === 'message') {
        // Extract text and annotations from message content
        for (const contentItem of outputItem.content || []) {
          if (contentItem.type === 'output_text') {
            text = contentItem.text || '';

            // Extract annotations for web search results
            for (const annotation of contentItem.annotations || []) {
              const processedAnnotation = {
                type: annotation.type || 'unknown',
                content: annotation.title || annotation.text || '',
                source: annotation.url || annotation.source || ''
              };

              // If it's a URL citation, treat it as a web search result
              if (annotation.type === 'url_citation') {
                webSearchAnnotations.push(processedAnnotation);
              } else {
                annotations.push(processedAnnotation);
              }
            }
          }
        }
      }
      // Handle web search calls - collect queries
      else if (outputItem.type === 'web_search_call') {
        if (outputItem.action && outputItem.action.query) {
          webSearchQueries.push(outputItem.action.query);
        }
      }
      // Handle MCP calls
      else if (outputItem.type === 'mcp_call') {
        toolCalls.push({
          name: outputItem.name || 'mcp_tool',
          arguments: outputItem.arguments || {},
          output: outputItem.output || null
        });
      }
      // Handle function calls
      else if (outputItem.type === 'function_call') {
        toolCalls.push({
          name: outputItem.name || 'function',
          arguments: outputItem.arguments || {},
          output: outputItem.output || null
        });
      }
    }
  }

  // Create web search tool call if we found web search activity
  if (webSearchQueries.length > 0 || webSearchAnnotations.length > 0) {
    toolCalls.push({
      name: 'web_search',
      arguments: {
        queries: webSearchQueries,
        status: 'completed'
      },
      output: webSearchAnnotations
    });
  }

  // Fallback to response.text if no text found
  if (!text && response.text) {
    text = response.text;
  }

  return {
    text,
    tool_calls: toolCalls,
    annotations,
    response_id: response.id,
    usage: response.usage ? {
      total_tokens: response.usage.total_tokens,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
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
  previousResponseId?: string;
}

// Stream responses from OpenAI Responses API
export async function* streamOpenAIResponse(params: StreamCallParams) {
  const {
    model,
    input,
    instructions,
    reasoningEffort,
    webSearchEnabled,
    topP,
    responseMode,
    previousResponseId
  } = params;

  // Build request parameters
  const requestParams: any = {
    model,
    input,
    tools: buildTools(HARDCODED_MCP_TOOLS, webSearchEnabled),
    stream: true,
  };

  // Add reasoning if model supports it
  if (shouldIncludeReasoning(model) && reasoningEffort) {
    requestParams.reasoning = { effort: reasoningEffort };
  }

  // Add instructions
  if (instructions) {
    requestParams.instructions = instructions;
  }

  // Add top_p if specified
  if (topP !== null && topP !== undefined) {
    requestParams.top_p = topP;
  }

  // Add previous response ID if provided
  if (previousResponseId) {
    requestParams.previous_response_id = previousResponseId;
  }

  let completeResponse: any = null;
  let accumulatedText = "";

  try {
    // Make streaming API call
    const stream = await openai.responses.create(requestParams) as any;

    for await (const event of stream) {
      // Capture complete response when streaming finishes
      if (event.type === 'response.completed') {
        completeResponse = event.response;
      }

      // Send text deltas for streaming
      if (event.type === 'response.output_text.delta') {
        accumulatedText += event.delta;
        yield {
          type: 'delta',
          content: event.delta
        };
      }
    }

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
      throw new Error('No complete response received from OpenAI');
    }
  } catch (error) {
    console.error('Error streaming OpenAI response:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
