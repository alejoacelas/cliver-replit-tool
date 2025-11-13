import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { streamOpenAIResponse, inferCustomerInfo } from "./openai";
import { streamAnthropicResponse } from "./anthropic";
import type { UserCallConfig } from "@shared/schema";
import * as XLSX from "xlsx";
import { DEFAULT_CONFIG } from "./prompt";
import { registerApiV1Routes } from "./apiV1Routes";
import bcrypt from "bcrypt";
import crypto from "crypto";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Conversation routes
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title } = req.body;

      if (!title) {
        return res.status(400).json({ message: "Title is required" });
      }

      const conversation = await storage.createConversation({
        userId,
        title,
      });

      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get('/api/conversations/:conversationId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { conversationId } = req.params;
      
      // Verify user owns this conversation
      const conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.userId !== req.user.claims.sub) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const messages = await storage.getMessages(conversationId);
      
      // Attach responses to each message
      const messagesWithResponses = await Promise.all(
        messages.map(async (message) => {
          const responses = await storage.getMessageResponses(message.id);
          return {
            ...message,
            responses,
          };
        })
      );

      res.json(messagesWithResponses);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/conversations/:conversationId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId } = req.params;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }

      // Verify user owns this conversation
      const conversation = await storage.getConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Create user message
      const message = await storage.createMessage({
        conversationId,
        role: "user",
        content,
      });

      // Check if this is the first message in the conversation
      const allMessages = await storage.getMessages(conversationId);
      const isFirstMessage = allMessages.length === 1;

      // If first message, infer and update conversation title
      if (isFirstMessage) {
        inferAndUpdateConversationTitle(conversationId, content);
      }

      // Get user's enabled call configs
      const allConfigs = await storage.getUserCallConfigs(userId);
      const enabledConfigs = allConfigs.filter(c => c.enabled);

      // Create placeholder responses for each enabled config
      const responsePromises = enabledConfigs.map(async (config) => {
        return await storage.createMessageResponse({
          messageId: message.id,
          callConfigId: config.id,
          displayName: config.displayName,
          content: "",
          model: config.model,
          status: "streaming",
        });
      });

      const createdResponses = await Promise.all(responsePromises);

      // Update conversation timestamp
      await storage.updateConversation(conversationId, {
        updatedAt: new Date(),
      });

      // Trigger streaming responses (don't await - happens in background)
      triggerStreamingResponses(message.id, enabledConfigs, content, createdResponses);

      res.json({ message });
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Call config routes
  app.get('/api/call-configs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let configs = await storage.getUserCallConfigs(userId);

      // If user has no configs, create default one
      if (configs.length === 0) {
        const defaultConfig = await storage.createUserCallConfig({
          userId,
          ...DEFAULT_CONFIG,
        });
        configs = [defaultConfig];
      }

      res.json(configs);
    } catch (error) {
      console.error("Error fetching call configs:", error);
      res.status(500).json({ message: "Failed to fetch call configs" });
    }
  });

  app.put('/api/call-configs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { configs } = req.body as { configs: UserCallConfig[] };

      if (!Array.isArray(configs)) {
        return res.status(400).json({ message: "Configs must be an array" });
      }

      // Verify all configs belong to this user (only check if array is not empty)
      if (configs.length > 0) {
        const allOwnedByUser = configs.every(c => c.userId === userId);
        if (!allOwnedByUser) {
          return res.status(403).json({ message: "Cannot modify other users' configs" });
        }
      }

      await storage.batchUpdateUserCallConfigs(userId, configs);

      const updatedConfigs = await storage.getUserCallConfigs(userId);
      res.json(updatedConfigs);
    } catch (error) {
      console.error("Error updating call configs:", error);
      res.status(500).json({ message: "Failed to update call configs" });
    }
  });

  // Export chat history
  app.get('/api/export', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { format, startDate, endDate } = req.query;

      if (!format || !startDate || !endDate) {
        return res.status(400).json({ message: "Format, startDate, and endDate are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const data = await storage.getConversationsWithMessagesInDateRange(userId, start, end);

      if (format === 'csv') {
        // Generate CSV
        const csvRows: string[] = [];
        csvRows.push('Conversation Title,Message Date,Message Role,Message Content,Response Model,Response Content,Response Status');

        for (const conversation of data) {
          for (const message of conversation.messages) {
            if (message.responses && message.responses.length > 0) {
              for (const response of message.responses) {
                const row = [
                  `"${conversation.title.replace(/"/g, '""')}"`,
                  message.timestamp.toISOString(),
                  message.role,
                  `"${message.content.replace(/"/g, '""')}"`,
                  response.model || '',
                  `"${(response.content || '').replace(/"/g, '""')}"`,
                  response.status
                ].join(',');
                csvRows.push(row);
              }
            } else {
              const row = [
                `"${conversation.title.replace(/"/g, '""')}"`,
                message.timestamp.toISOString(),
                message.role,
                `"${message.content.replace(/"/g, '""')}"`,
                '',
                '',
                ''
              ].join(',');
              csvRows.push(row);
            }
          }
        }

        const csv = csvRows.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="chat-history-${Date.now()}.csv"`);
        res.send(csv);
      } else if (format === 'excel') {
        // Generate Excel
        const rows: any[] = [];
        
        for (const conversation of data) {
          for (const message of conversation.messages) {
            if (message.responses && message.responses.length > 0) {
              for (const response of message.responses) {
                rows.push({
                  'Conversation Title': conversation.title,
                  'Message Date': message.timestamp,
                  'Message Role': message.role,
                  'Message Content': message.content,
                  'Response Model': response.model || '',
                  'Response Content': response.content || '',
                  'Response Status': response.status
                });
              }
            } else {
              rows.push({
                'Conversation Title': conversation.title,
                'Message Date': message.timestamp,
                'Message Role': message.role,
                'Message Content': message.content,
                'Response Model': '',
                'Response Content': '',
                'Response Status': ''
              });
            }
          }
        }

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Chat History');

        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="chat-history-${Date.now()}.xlsx"`);
        res.send(excelBuffer);
      } else {
        return res.status(400).json({ message: "Invalid format. Use 'csv' or 'excel'" });
      }
    } catch (error) {
      console.error("Error exporting chat history:", error);
      res.status(500).json({ message: "Failed to export chat history" });
    }
  });

  // Server-sent events endpoint for streaming updates
  app.get('/api/responses/:responseId/stream', isAuthenticated, async (req: any, res) => {
    const { responseId } = req.params;

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Poll for updates (in a real implementation, you might use a pub/sub system)
    const intervalId = setInterval(async () => {
      try {
        const response = await storage.getMessageResponses(responseId);
        if (response && response.length > 0) {
          const latestResponse = response[0];
          res.write(`data: ${JSON.stringify({ type: 'update', response: latestResponse })}\n\n`);

          if (latestResponse.status !== 'streaming') {
            clearInterval(intervalId);
            res.write('data: [DONE]\n\n');
            res.end();
          }
        }
      } catch (error) {
        console.error('Error polling response:', error);
        clearInterval(intervalId);
        res.end();
      }
    }, 1000);

    // Clean up on disconnect
    req.on('close', () => {
      clearInterval(intervalId);
    });
  });

  // API Key management routes (for web UI)
  app.get('/api/api-keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const keys = await storage.getApiKeys(userId);
      
      res.json(keys.map(key => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        revokedAt: key.revokedAt,
      })));
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.post('/api/api-keys', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }

      const apiKey = generateApiKey('live');
      const keyHash = await bcrypt.hash(apiKey, 10);
      const keyPrefix = apiKey.substring(0, 12);

      const created = await storage.createApiKey({
        userId,
        name: name.trim(),
        keyHash,
        keyPrefix,
        lastUsedAt: null,
        revokedAt: null,
      });

      res.json({
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        apiKey,
        createdAt: created.createdAt,
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.delete('/api/api-keys/:keyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { keyId } = req.params;

      const keys = await storage.getApiKeys(userId);
      const key = keys.find(k => k.id === keyId);

      if (!key) {
        return res.status(404).json({ message: "API key not found" });
      }

      await storage.revokeApiKey(keyId);

      res.json({ message: "API key revoked successfully" });
    } catch (error) {
      console.error("Error revoking API key:", error);
      res.status(500).json({ message: "Failed to revoke API key" });
    }
  });

  // Register API v1 routes
  registerApiV1Routes(app);

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to determine if a model is an Anthropic/Claude model
function isAnthropicModel(model: string): boolean {
  return model.toLowerCase().includes('claude');
}

// Helper function to trigger streaming responses
async function triggerStreamingResponses(
  messageId: string,
  configs: UserCallConfig[],
  userInput: string,
  createdResponses: any[]
) {
  // Process each config in parallel
  const streamPromises = configs.map(async (config, index) => {
    const responseRecord = createdResponses[index];
    const startTime = Date.now();

    try {
      let accumulatedText = "";
      let completeData: any = null;

      // Choose the appropriate streaming function based on the model
      const isAnthropic = isAnthropicModel(config.model);
      const streamGenerator = isAnthropic 
        ? streamAnthropicResponse({
            model: config.model,
            input: userInput,
            instructions: config.systemPrompt || undefined,
            reasoningEffort: config.reasoningEffort,
            webSearchEnabled: config.webSearchEnabled,
            topP: config.topP,
            responseMode: config.responseMode,
          })
        : streamOpenAIResponse({
            model: config.model,
            input: userInput,
            instructions: config.systemPrompt || undefined,
            reasoningEffort: config.reasoningEffort,
            webSearchEnabled: config.webSearchEnabled,
            topP: config.topP,
            responseMode: config.responseMode,
          });

      for await (const event of streamGenerator) {
        if (event.type === 'delta') {
          accumulatedText += event.content;
          
          // Update response in database periodically
          await storage.updateMessageResponse(responseRecord.id, {
            content: accumulatedText,
          });
        } else if (event.type === 'complete') {
          completeData = event.response;
        } else if (event.type === 'error') {
          // Handle error
          await storage.updateMessageResponse(responseRecord.id, {
            status: "error",
            error: event.error,
          });
          return;
        }
      }

      // Update with final data
      if (completeData) {
        const duration = Date.now() - startTime;
        
        await storage.updateMessageResponse(responseRecord.id, {
          content: completeData.text,
          responseId: completeData.response_id,
          inputTokens: completeData.usage?.input_tokens || null,
          outputTokens: completeData.usage?.output_tokens || null,
          totalTokens: completeData.usage?.total_tokens || null,
          duration,
          toolCalls: completeData.tool_calls,
          annotations: completeData.annotations,
          status: "completed",
        });
      }
    } catch (error) {
      console.error(`Error streaming response for config ${config.id}:`, error);
      await storage.updateMessageResponse(responseRecord.id, {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  // Don't await - let them run in background
  Promise.all(streamPromises).catch(err => {
    console.error('Error in streaming responses:', err);
  });
}

// Helper function to infer and update conversation title
async function inferAndUpdateConversationTitle(conversationId: string, messageContent: string) {
  try {
    const { customerName, institution } = await inferCustomerInfo(messageContent);
    const newTitle = `${customerName} - ${institution}`;
    
    await storage.updateConversation(conversationId, {
      title: newTitle,
      updatedAt: new Date(),
    });
    
    console.log(`Updated conversation ${conversationId} title to: ${newTitle}`);
  } catch (error) {
    console.error('Error inferring conversation title:', error);
  }
}

function generateApiKey(type: 'live' | 'test'): string {
  const prefix = type === 'live' ? 'clv_live_' : 'clv_test_';
  const randomString = crypto.randomBytes(16).toString('hex');
  return prefix + randomString;
}
