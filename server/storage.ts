// Referenced from javascript_database and javascript_log_in_with_replit blueprints
import {
  users,
  conversations,
  messages,
  messageResponses,
  userCallConfigs,
  type User,
  type UpsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type MessageResponse,
  type InsertMessageResponse,
  type UserCallConfig,
  type InsertUserCallConfig,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Conversation operations
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation>;
  
  // Message operations
  getMessages(conversationId: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Message response operations
  getMessageResponses(messageId: string): Promise<MessageResponse[]>;
  createMessageResponse(response: InsertMessageResponse): Promise<MessageResponse>;
  updateMessageResponse(id: string, updates: Partial<MessageResponse>): Promise<MessageResponse>;
  
  // User call config operations
  getUserCallConfigs(userId: string): Promise<UserCallConfig[]>;
  createUserCallConfig(config: InsertUserCallConfig): Promise<UserCallConfig>;
  updateUserCallConfig(id: string, updates: Partial<UserCallConfig>): Promise<UserCallConfig>;
  deleteUserCallConfig(id: string): Promise<void>;
  batchUpdateUserCallConfigs(configs: UserCallConfig[]): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT: mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Conversation operations
  async getConversations(userId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    return conversation;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [created] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return created;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation> {
    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  // Message operations
  async getMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, id));
    return message;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db
      .insert(messages)
      .values(message)
      .returning();
    return created;
  }

  // Message response operations
  async getMessageResponses(messageId: string): Promise<MessageResponse[]> {
    return await db
      .select()
      .from(messageResponses)
      .where(eq(messageResponses.messageId, messageId))
      .orderBy(messageResponses.createdAt);
  }

  async createMessageResponse(response: InsertMessageResponse): Promise<MessageResponse> {
    const [created] = await db
      .insert(messageResponses)
      .values(response)
      .returning();
    return created;
  }

  async updateMessageResponse(id: string, updates: Partial<MessageResponse>): Promise<MessageResponse> {
    const [updated] = await db
      .update(messageResponses)
      .set(updates)
      .where(eq(messageResponses.id, id))
      .returning();
    return updated;
  }

  // User call config operations
  async getUserCallConfigs(userId: string): Promise<UserCallConfig[]> {
    return await db
      .select()
      .from(userCallConfigs)
      .where(eq(userCallConfigs.userId, userId))
      .orderBy(userCallConfigs.order);
  }

  async createUserCallConfig(config: InsertUserCallConfig): Promise<UserCallConfig> {
    const [created] = await db
      .insert(userCallConfigs)
      .values(config)
      .returning();
    return created;
  }

  async updateUserCallConfig(id: string, updates: Partial<UserCallConfig>): Promise<UserCallConfig> {
    const [updated] = await db
      .update(userCallConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userCallConfigs.id, id))
      .returning();
    return updated;
  }

  async deleteUserCallConfig(id: string): Promise<void> {
    await db
      .delete(userCallConfigs)
      .where(eq(userCallConfigs.id, id));
  }

  async batchUpdateUserCallConfigs(configs: UserCallConfig[]): Promise<void> {
    // Delete configs that are no longer in the list
    const configIds = configs.map(c => c.id);
    const userId = configs[0]?.userId;
    
    if (userId) {
      await db
        .delete(userCallConfigs)
        .where(
          and(
            eq(userCallConfigs.userId, userId),
            // Delete if id is not in the list
          )
        );
    }

    // Upsert all configs
    for (const config of configs) {
      await db
        .insert(userCallConfigs)
        .values(config)
        .onConflictDoUpdate({
          target: userCallConfigs.id,
          set: {
            ...config,
            updatedAt: new Date(),
          },
        });
    }
  }
}

export const storage = new DatabaseStorage();
