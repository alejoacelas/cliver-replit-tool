import { sql } from 'drizzle-orm';
import {
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Conversations table
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  browserId: varchar("browser_id").notNull().default(""),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
}));

export type Conversation = typeof conversations.$inferSelect;

// Messages table
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: varchar("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  responses: many(responses),
}));

export type Message = typeof messages.$inferSelect;

// Responses table (one per message)
export const responses = pgTable("responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  model: varchar("model"),
  status: varchar("status", { enum: ["streaming", "completed", "error"] }).notNull().default("streaming"),
  toolCalls: jsonb("tool_calls"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  duration: integer("duration"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const responsesRelations = relations(responses, ({ one }) => ({
  message: one(messages, {
    fields: [responses.messageId],
    references: [messages.id],
  }),
}));

export type Response = typeof responses.$inferSelect;

// TypeScript interfaces for SSE events
export interface SSEEvent {
  type: "status" | "tool_call" | "tool_result" | "delta" | "complete" | "error";
  [key: string]: any;
}

export interface CompleteData {
  decision: { status: string; flags_count: number; summary: string };
  checks: Array<{ criterion: string; status: string; evidence: string; sources: string[] }>;
  backgroundWork: Array<{ relevance: number; organism: string; summary: string; sources: string[] }> | null;
  audit: { toolCalls: any[]; raw: { verification: string; work: string | null } };
}
