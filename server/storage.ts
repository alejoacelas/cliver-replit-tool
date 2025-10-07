// Referenced from javascript_database and javascript_log_in_with_replit blueprints
import {
  users,
  conversations,
  messages,
  messageResponses,
  userCallConfigs,
  apiKeys,
  apiRequests,
  apiRequestResponses,
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
  type ApiKey,
  type InsertApiKey,
  type ApiRequest,
  type InsertApiRequest,
  type ApiRequestResponse,
  type InsertApiRequestResponse,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, not, inArray, gte, lte, isNull, sql } from "drizzle-orm";

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
  batchUpdateUserCallConfigs(userId: string, configs: UserCallConfig[]): Promise<void>;
  
  // Export operations
  getConversationsWithMessagesInDateRange(userId: string, startDate: Date, endDate: Date): Promise<any[]>;
  
  // API Key operations
  getApiKeys(userId: string): Promise<ApiKey[]>;
  getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined>;
  getApiKeysByPrefix(keyPrefix: string): Promise<ApiKey[]>;
  createApiKey(key: InsertApiKey): Promise<ApiKey>;
  revokeApiKey(id: string): Promise<void>;
  updateApiKeyLastUsed(id: string): Promise<void>;
  
  // API Request operations
  getApiRequests(userId: string, options?: { status?: string; limit?: number; offset?: number; startDate?: Date; endDate?: Date }): Promise<{ requests: ApiRequest[]; total: number }>;
  getApiRequest(id: string): Promise<ApiRequest | undefined>;
  createApiRequest(request: InsertApiRequest): Promise<ApiRequest>;
  updateApiRequest(id: string, updates: Partial<ApiRequest>): Promise<ApiRequest>;
  countPendingRequests(userId: string): Promise<number>;
  
  // API Request Response operations
  getApiRequestResponses(requestId: string): Promise<ApiRequestResponse[]>;
  createApiRequestResponse(response: InsertApiRequestResponse): Promise<ApiRequestResponse>;
  updateApiRequestResponse(id: string, updates: Partial<ApiRequestResponse>): Promise<ApiRequestResponse>;
  
  // User call config operations (for API)
  getUserCallConfig(id: string): Promise<UserCallConfig | undefined>;
  getUserCallConfigsByIds(userId: string, ids: string[]): Promise<UserCallConfig[]>;
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

  async batchUpdateUserCallConfigs(userId: string, configs: UserCallConfig[]): Promise<void> {
    const configIds = configs.map(c => c.id);

    // Delete configs that are no longer in the list
    if (configIds.length > 0) {
      // Delete configs not in the provided list
      await db
        .delete(userCallConfigs)
        .where(
          and(
            eq(userCallConfigs.userId, userId),
            not(inArray(userCallConfigs.id, configIds))
          )
        );
    } else {
      // If configs array is empty, delete all configs for this user
      await db
        .delete(userCallConfigs)
        .where(eq(userCallConfigs.userId, userId));
    }

    // Upsert all configs
    for (const config of configs) {
      // Convert date strings to Date objects
      const configToSave = {
        ...config,
        createdAt: config.createdAt ? new Date(config.createdAt) : new Date(),
        updatedAt: new Date(),
      };
      
      await db
        .insert(userCallConfigs)
        .values(configToSave)
        .onConflictDoUpdate({
          target: userCallConfigs.id,
          set: {
            ...configToSave,
            updatedAt: new Date(),
          },
        });
    }
  }

  async getConversationsWithMessagesInDateRange(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
    // Get all user's conversations
    const userConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.createdAt));

    // For each conversation, get messages within the date range
    const result = [];
    for (const conversation of userConversations) {
      // Filter messages by timestamp within date range
      const conversationMessages = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversation.id),
            gte(messages.timestamp, startDate),
            lte(messages.timestamp, endDate)
          )
        )
        .orderBy(asc(messages.timestamp));

      // Skip conversations with no messages in the date range
      if (conversationMessages.length === 0) {
        continue;
      }

      const messagesWithResponses = [];
      for (const message of conversationMessages) {
        const responses = await db
          .select()
          .from(messageResponses)
          .where(eq(messageResponses.messageId, message.id));

        messagesWithResponses.push({
          ...message,
          responses,
        });
      }

      result.push({
        ...conversation,
        messages: messagesWithResponses,
      });
    }

    return result;
  }

  // API Key operations
  async getApiKeys(userId: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.keyHash, keyHash),
        isNull(apiKeys.revokedAt)
      ));
    return key;
  }

  async getApiKeysByPrefix(keyPrefix: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, keyPrefix));
  }

  async createApiKey(key: InsertApiKey): Promise<ApiKey> {
    const [created] = await db
      .insert(apiKeys)
      .values(key)
      .returning();
    return created;
  }

  async revokeApiKey(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async updateApiKeyLastUsed(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  // API Request operations
  async getApiRequests(
    userId: string, 
    options?: { status?: string; limit?: number; offset?: number; startDate?: Date; endDate?: Date }
  ): Promise<{ requests: ApiRequest[]; total: number }> {
    const { status, limit = 50, offset = 0, startDate, endDate } = options || {};
    
    const conditions: any[] = [eq(apiRequests.userId, userId)];
    if (status) {
      conditions.push(eq(apiRequests.status, status as any));
    }
    if (startDate) {
      conditions.push(gte(apiRequests.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(apiRequests.createdAt, endDate));
    }

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [requests, totalResult] = await Promise.all([
      db
        .select()
        .from(apiRequests)
        .where(whereClause)
        .orderBy(desc(apiRequests.createdAt))
        .limit(Math.min(limit, 100))
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(apiRequests)
        .where(whereClause)
    ]);

    return {
      requests,
      total: totalResult[0]?.count || 0
    };
  }

  async getApiRequest(id: string): Promise<ApiRequest | undefined> {
    const [request] = await db
      .select()
      .from(apiRequests)
      .where(eq(apiRequests.id, id));
    return request;
  }

  async createApiRequest(request: InsertApiRequest): Promise<ApiRequest> {
    const [created] = await db
      .insert(apiRequests)
      .values(request)
      .returning();
    return created;
  }

  async updateApiRequest(id: string, updates: Partial<ApiRequest>): Promise<ApiRequest> {
    const [updated] = await db
      .update(apiRequests)
      .set(updates)
      .where(eq(apiRequests.id, id))
      .returning();
    return updated;
  }

  async countPendingRequests(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiRequests)
      .where(and(
        eq(apiRequests.userId, userId),
        inArray(apiRequests.status, ['pending', 'processing'])
      ));
    return result[0]?.count || 0;
  }

  // API Request Response operations
  async getApiRequestResponses(requestId: string): Promise<ApiRequestResponse[]> {
    return await db
      .select()
      .from(apiRequestResponses)
      .where(eq(apiRequestResponses.requestId, requestId))
      .orderBy(apiRequestResponses.createdAt);
  }

  async createApiRequestResponse(response: InsertApiRequestResponse): Promise<ApiRequestResponse> {
    const [created] = await db
      .insert(apiRequestResponses)
      .values(response)
      .returning();
    return created;
  }

  async updateApiRequestResponse(id: string, updates: Partial<ApiRequestResponse>): Promise<ApiRequestResponse> {
    const [updated] = await db
      .update(apiRequestResponses)
      .set(updates)
      .where(eq(apiRequestResponses.id, id))
      .returning();
    return updated;
  }

  // User call config operations (for API)
  async getUserCallConfig(id: string): Promise<UserCallConfig | undefined> {
    const [config] = await db
      .select()
      .from(userCallConfigs)
      .where(eq(userCallConfigs.id, id));
    return config;
  }

  async getUserCallConfigsByIds(userId: string, ids: string[]): Promise<UserCallConfig[]> {
    if (ids.length === 0) return [];
    
    return await db
      .select()
      .from(userCallConfigs)
      .where(and(
        eq(userCallConfigs.userId, userId),
        inArray(userCallConfigs.id, ids)
      ));
  }
}

export const storage = new DatabaseStorage();
