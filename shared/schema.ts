import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (mandatory for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (mandatory for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Conversations table
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  responses: many(messageResponses),
}));

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Message responses table (multiple AI responses per message)
export const messageResponses = pgTable("message_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: 'cascade' }),
  callConfigId: varchar("call_config_id").notNull(),
  displayName: text("display_name").notNull(),
  content: text("content").notNull(),
  responseId: varchar("response_id"),
  model: varchar("model").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  duration: integer("duration"),
  toolCalls: jsonb("tool_calls"),
  annotations: jsonb("annotations"),
  status: varchar("status", { enum: ["streaming", "completed", "error"] }).notNull().default("streaming"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messageResponsesRelations = relations(messageResponses, ({ one }) => ({
  message: one(messages, {
    fields: [messageResponses.messageId],
    references: [messages.id],
  }),
}));

export const insertMessageResponseSchema = createInsertSchema(messageResponses).omit({
  id: true,
  createdAt: true,
});

export type InsertMessageResponse = z.infer<typeof insertMessageResponseSchema>;
export type MessageResponse = typeof messageResponses.$inferSelect;

// User call configurations table
export const userCallConfigs = pgTable("user_call_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  displayName: text("display_name").notNull(),
  model: varchar("model").notNull(),
  systemPrompt: text("system_prompt"),
  reasoningEffort: varchar("reasoning_effort", { enum: ["low", "medium", "high"] }),
  webSearchEnabled: boolean("web_search_enabled").notNull().default(true),
  topP: real("top_p"),
  responseMode: varchar("response_mode", { enum: ["markdown", "json-field"] }).notNull().default("markdown"),
  enabled: boolean("enabled").notNull().default(true),
  order: integer("order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userCallConfigsRelations = relations(userCallConfigs, ({ one }) => ({
  user: one(users, {
    fields: [userCallConfigs.userId],
    references: [users.id],
  }),
}));

export const insertUserCallConfigSchema = createInsertSchema(userCallConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUserCallConfig = z.infer<typeof insertUserCallConfigSchema>;
export type UserCallConfig = typeof userCallConfigs.$inferSelect;

// TypeScript interfaces for API data structures
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
