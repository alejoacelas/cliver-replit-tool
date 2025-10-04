import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { streamOpenAIResponse, inferCustomerInfo } from "./openai";
import type { UserCallConfig } from "@shared/schema";

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
          displayName: "Default Analysis",
          model: "gpt-5",
          systemPrompt: "You are a helpful AI assistant specialized in customer background research. Provide comprehensive, accurate, and actionable insights.",
          reasoningEffort: null,
          webSearchEnabled: true,
          topP: null,
          responseMode: "markdown",
          enabled: true,
          order: 0,
          isDefault: true,
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

      // Verify all configs belong to this user
      const allOwnedByUser = configs.every(c => c.userId === userId);
      if (!allOwnedByUser) {
        return res.status(403).json({ message: "Cannot modify other users' configs" });
      }

      await storage.batchUpdateUserCallConfigs(configs);

      const updatedConfigs = await storage.getUserCallConfigs(userId);
      res.json(updatedConfigs);
    } catch (error) {
      console.error("Error updating call configs:", error);
      res.status(500).json({ message: "Failed to update call configs" });
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

  const httpServer = createServer(app);
  return httpServer;
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

      for await (const event of streamOpenAIResponse({
        model: config.model,
        input: userInput,
        instructions: config.systemPrompt || undefined,
        reasoningEffort: config.reasoningEffort,
        webSearchEnabled: config.webSearchEnabled,
        topP: config.topP,
        responseMode: config.responseMode,
      })) {
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
