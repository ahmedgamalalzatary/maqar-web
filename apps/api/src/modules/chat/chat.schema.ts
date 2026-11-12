import { CHAT_BLOCKERS, CHAT_MESSAGE_KINDS, CHAT_REPORT_REASONS, CHAT_SENDERS, type ChatBody, REPORT_OUTCOMES } from '@maqar/shared';
import { sql } from 'drizzle-orm';
import { bigint, index, json, mysqlEnum, mysqlTable, timestamp, unique, varchar } from 'drizzle-orm/mysql-core';
import { agents } from '../agents/agents.schema.js';
import { leads } from '../leads/leads.schema.js';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';

/**
 * One conversation per client and home (contract §8.12, §13), with the agent the home had when it
 * started. `last_message_at` orders the lists.
 */
export const chatThreads = mysqlTable(
  'chat_threads',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    clientId: bigint('client_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    propertyId: bigint('property_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    agentId: bigint('agent_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => agents.userId),
    leadId: bigint('lead_id', { mode: 'number', unsigned: true }).references(() => leads.id, { onDelete: 'set null' }),
    lastMessageAt: timestamp('last_message_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    /** Phase 24: set while the conversation is closed; nobody can send in it. Only an admin opens it again. */
    blockedAt: timestamp('blocked_at', { fsp: 3 }),
    blockedBy: mysqlEnum('blocked_by', CHAT_BLOCKERS),
  },
  (t) => [unique('chat_threads_client_property_unique').on(t.clientId, t.propertyId), index('chat_threads_agent_idx').on(t.agentId, t.lastMessageAt)],
);

export type ChatThreadRow = typeof chatThreads.$inferSelect;

/** A message. `body` holds the kind's content (`ChatBody`); `read_at` is when the other side read it. */
export const chatMessages = mysqlTable(
  'chat_messages',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    threadId: bigint('thread_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => chatThreads.id, { onDelete: 'cascade' }),
    sender: mysqlEnum('sender', CHAT_SENDERS).notNull(),
    kind: mysqlEnum('kind', CHAT_MESSAGE_KINDS).notNull(),
    body: json('body').$type<ChatBody>().notNull(),
    readAt: timestamp('read_at', { fsp: 3 }),
    createdAt: timestamp('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index('chat_messages_thread_idx').on(t.threadId, t.id)],
);

export type ChatMessageRow = typeof chatMessages.$inferSelect;

/**
 * A report on a conversation (phase 24, contract §8.12): by its client or its agent. It is open
 * until an admin closes it with an outcome.
 */
export const chatReports = mysqlTable(
  'chat_reports',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    threadId: bigint('thread_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => chatThreads.id, { onDelete: 'cascade' }),
    by: mysqlEnum('by', CHAT_SENDERS).notNull(),
    reporterId: bigint('reporter_id', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'set null' }),
    reason: mysqlEnum('reason', CHAT_REPORT_REASONS).notNull(),
    note: varchar('note', { length: 500 }),
    createdAt: timestamp('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    resolvedAt: timestamp('resolved_at', { fsp: 3 }),
    resolvedBy: bigint('resolved_by', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'set null' }),
    outcome: mysqlEnum('outcome', REPORT_OUTCOMES),
  },
  (t) => [index('chat_reports_open_idx').on(t.resolvedAt, t.createdAt), index('chat_reports_thread_idx').on(t.threadId)],
);

export type ChatReportRow = typeof chatReports.$inferSelect;
