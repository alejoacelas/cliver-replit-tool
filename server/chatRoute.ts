import type { Express, Request, Response } from "express";
import { streamText, convertToCoreMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { isAuthenticated } from "./replitAuth";
import { getAllMCPTools } from "./mcpTools";

/**
 * Register the /api/chat route for AI SDK chat
 * This route handles streaming chat completions with tool support
 */
export function registerChatRoute(app: Express) {
  app.post('/api/chat', isAuthenticated, async (req: any, res: Response) => {
    try {
      const { messages, model, webSearch, ...options } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages array is required" });
      }

      // Convert messages to core messages format
      const coreMessages = convertToCoreMessages(messages);

      // Get MCP tools
      const tools = getAllMCPTools();

      // Add web search tool if enabled (mock implementation)
      const allTools: any = { ...tools };
      if (webSearch) {
        // Mock web search tool - you can implement actual web search here
        allTools.web_search = {
          description: 'Search the web for current information',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query'
              }
            },
            required: ['query']
          },
          execute: async ({ query }: { query: string }) => {
            // MOCK IMPLEMENTATION - Replace with actual web search
            return {
              query,
              results: [
                {
                  title: 'Mock Search Result 1',
                  url: 'https://example.com/result1',
                  snippet: 'This is a mock search result snippet'
                },
                {
                  title: 'Mock Search Result 2',
                  url: 'https://example.com/result2',
                  snippet: 'Another mock search result snippet'
                }
              ]
            };
          }
        };
      }

      // Determine model (default to gpt-4o)
      const selectedModel = model || 'gpt-4o';

      // Stream the response
      const result = streamText({
        model: openai(selectedModel),
        messages: coreMessages,
        tools: Object.keys(allTools).length > 0 ? allTools : undefined,
        onFinish: ({ text, toolCalls, usage }) => {
          console.log('[Chat] Response finished:', {
            textLength: text.length,
            toolCallsCount: toolCalls?.length || 0,
            usage
          });
        },
      });

      // Use AI SDK's toTextStreamResponse helper for proper streaming
      result.toTextStreamResponse().then((response: Response) => {
        // Copy headers from AI SDK response
        response.headers.forEach((value: string, key: string) => {
          res.setHeader(key, value);
        });

        // Stream the response body
        if (response.body) {
          const reader = response.body.getReader();
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  res.end();
                  break;
                }
                res.write(value);
              }
            } catch (err: any) {
              console.error('[Chat] Stream error:', err);
              res.end();
            }
          };
          pump();
        } else {
          res.end();
        }
      }).catch((error: any) => {
        console.error('[Chat] Response error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream response' });
        } else {
          res.end();
        }
      });

    } catch (error) {
      console.error('[Chat] Error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to process chat request',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });
}
