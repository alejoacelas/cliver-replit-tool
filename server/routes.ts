import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { runPipeline } from "./pipeline";
import { generateText } from "./openrouter";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "healthy" });
  });

  // List conversations
  app.get("/api/conversations", async (_req, res) => {
    try {
      const convs = await storage.getConversations();
      res.json(convs);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Create conversation
  app.post("/api/conversations", async (req, res) => {
    try {
      const { title } = req.body;
      const conv = await storage.createConversation(title || "New screening");
      res.json(conv);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Get messages for conversation
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const msgs = await storage.getMessages(req.params.id);
      res.json(msgs);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Main chat endpoint - SSE stream
  app.post("/api/chat", async (req, res) => {
    const { conversationId, content } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ message: "conversationId and content are required" });
    }

    // Verify conversation exists
    const conv = await storage.getConversation(conversationId);
    if (!conv) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    try {
      // Create user message
      const userMsg = await storage.createMessage(conversationId, "user", content);

      // Create placeholder response
      const responseRecord = await storage.createResponse(userMsg.id, "google/gemini-3-pro-preview");

      // Update conversation title on first message
      const allMsgs = await storage.getMessages(conversationId);
      if (allMsgs.length === 1) {
        inferTitle(conversationId, content);
      }

      // Send initial event with response ID
      res.write(`data: ${JSON.stringify({ type: "response_id", id: responseRecord.id, messageId: userMsg.id })}\n\n`);

      const startTime = Date.now();
      let fullContent = "";

      // Run pipeline and stream events
      for await (const event of runPipeline(content)) {
        if (res.writableEnded) break;

        res.write(`data: ${JSON.stringify(event)}\n\n`);

        if (event.type === "delta") {
          fullContent += event.content;
        }

        if (event.type === "complete") {
          const duration = Date.now() - startTime;
          await storage.updateResponse(responseRecord.id, {
            content: fullContent,
            status: "completed",
            toolCalls: event.data,
            duration,
          });
        }

        if (event.type === "error") {
          await storage.updateResponse(responseRecord.id, {
            status: "error",
            error: event.message,
          });
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Chat error:", error);
      res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Infer conversation title from first message content
async function inferTitle(conversationId: string, content: string) {
  try {
    const prompt = `Extract the customer name and institution from this text. Reply with only "Name - Institution" format, nothing else:\n\n${content}`;
    const title = await generateText(prompt, "google/gemini-2.5-flash");
    const cleaned = title.trim().replace(/^["']|["']$/g, "").slice(0, 100);
    if (cleaned) {
      await storage.updateConversationTitle(conversationId, cleaned);
    }
  } catch (e) {
    console.error("Title inference failed:", e);
  }
}
