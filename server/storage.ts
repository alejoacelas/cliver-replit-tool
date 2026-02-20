import {
  conversations,
  messages,
  responses,
  type Conversation,
  type Message,
  type Response,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export const storage = {
  async getConversations(browserId: string): Promise<Conversation[]> {
    return db.select().from(conversations)
      .where(eq(conversations.browserId, browserId))
      .orderBy(desc(conversations.createdAt));
  },

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv;
  },

  async createConversation(title: string, browserId: string): Promise<Conversation> {
    const [created] = await db.insert(conversations).values({ title, browserId }).returning();
    return created;
  },

  async updateConversationTitle(id: string, title: string): Promise<void> {
    await db.update(conversations).set({ title }).where(eq(conversations.id, id));
  },

  async getMessages(conversationId: string): Promise<(Message & { responses: Response[] })[]> {
    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    const result: (Message & { responses: Response[] })[] = [];
    for (const msg of msgs) {
      const resps = await db.select().from(responses)
        .where(eq(responses.messageId, msg.id))
        .orderBy(responses.createdAt);
      result.push({ ...msg, responses: resps });
    }
    return result;
  },

  async createMessage(conversationId: string, role: "user" | "assistant", content: string): Promise<Message> {
    const [created] = await db.insert(messages).values({ conversationId, role, content }).returning();
    return created;
  },

  async createResponse(messageId: string, model?: string): Promise<Response> {
    const [created] = await db.insert(responses).values({
      messageId,
      content: "",
      model: model || null,
      status: "streaming",
    }).returning();
    return created;
  },

  async updateResponse(id: string, updates: Partial<Response>): Promise<void> {
    await db.update(responses).set(updates).where(eq(responses.id, id));
  },
};
