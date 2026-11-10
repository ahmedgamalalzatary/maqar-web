import { Injectable } from '@nestjs/common';
import type { ChatBody, ChatSender } from '@maqar/shared';
import { and, count, desc, eq, inArray, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { leads } from '../leads/leads.schema.js';
import { users } from '../users/users.schema.js';
import { type ChatMessageRow, type ChatThreadRow, chatMessages, chatThreads } from './chat.schema.js';

@Injectable()
export class ChatRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findThread(id: number): Promise<ChatThreadRow | undefined> {
    const [row] = await this.db.select().from(chatThreads).where(eq(chatThreads.id, id));
    return row;
  }

  /**
   * The client's conversation about this home, made the first time. Starting one also puts the
   * client in the agent's leads (source `chat`, at `new` unless the lead is further on). All at once.
   */
  async openThread(clientId: number, propertyId: number, agentId: number): Promise<ChatThreadRow> {
    return this.db.transaction(async (tx) => {
      const [found] = await tx.select().from(chatThreads).where(and(eq(chatThreads.clientId, clientId), eq(chatThreads.propertyId, propertyId)));
      if (found) return found;
      await tx
        .insert(leads)
        .values({ clientId, agentId, propertyId, stage: 'new', source: 'chat', fromApp: true })
        .onDuplicateKeyUpdate({ set: { lastActivityAt: sql`now(3)` } });
      const [lead] = await tx.select({ id: leads.id }).from(leads).where(and(eq(leads.clientId, clientId), eq(leads.agentId, agentId)));
      // Two taps at once: the unique key keeps one conversation.
      await tx
        .insert(chatThreads)
        .values({ clientId, propertyId, agentId, leadId: lead?.id ?? null })
        .onDuplicateKeyUpdate({ set: { id: sql`${chatThreads.id}` } });
      const [row] = await tx.select().from(chatThreads).where(and(eq(chatThreads.clientId, clientId), eq(chatThreads.propertyId, propertyId)));
      return row!;
    });
  }

  /** The user's conversations that have messages, the latest first. */
  threadsOf(user: { id: number; side: ChatSender }): Promise<ChatThreadRow[]> {
    const mine = user.side === 'client' ? eq(chatThreads.clientId, user.id) : eq(chatThreads.agentId, user.id);
    return this.db
      .select()
      .from(chatThreads)
      .where(and(mine, isNotNull(chatThreads.lastMessageAt)))
      .orderBy(desc(chatThreads.lastMessageAt), desc(chatThreads.id));
  }

  /** The latest message of each conversation. */
  async lastMessages(threadIds: number[]): Promise<Map<number, ChatMessageRow>> {
    if (!threadIds.length) return new Map();
    const latest = this.db
      .select({ id: sql<number>`max(${chatMessages.id})` })
      .from(chatMessages)
      .where(inArray(chatMessages.threadId, threadIds))
      .groupBy(chatMessages.threadId);
    const rows = await this.db.select().from(chatMessages).where(inArray(chatMessages.id, latest));
    return new Map(rows.map((r) => [r.threadId, r]));
  }

  /** How many of the other side's messages `reader` has not read, per conversation. */
  async unread(threadIds: number[], reader: ChatSender): Promise<Map<number, number>> {
    if (!threadIds.length) return new Map();
    const rows = await this.db
      .select({ threadId: chatMessages.threadId, n: count() })
      .from(chatMessages)
      .where(and(inArray(chatMessages.threadId, threadIds), ne(chatMessages.sender, reader), isNull(chatMessages.readAt)))
      .groupBy(chatMessages.threadId);
    return new Map(rows.map((r) => [r.threadId, r.n]));
  }

  /** A page of messages before `before` (the newest when left out), oldest first, and whether older ones remain. */
  async page(threadId: number, limit: number, before?: number): Promise<{ items: ChatMessageRow[]; hasMore: boolean }> {
    const rows = await this.db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.threadId, threadId), before ? lt(chatMessages.id, before) : undefined))
      .orderBy(desc(chatMessages.id))
      .limit(limit + 1);
    return { items: rows.slice(0, limit).reverse(), hasMore: rows.length > limit };
  }

  /** The conversation's latest messages, oldest first: enough to see whether the away reply was sent. */
  async recent(threadId: number, limit = 50): Promise<ChatMessageRow[]> {
    return (await this.page(threadId, limit)).items;
  }

  /** Adds a message and moves the conversation (and the lead's activity) to now. `readAt` for messages already seen. */
  async add(thread: ChatThreadRow, sender: ChatSender, body: ChatBody, readAt: Date | null = null): Promise<ChatMessageRow> {
    return this.db.transaction(async (tx) => {
      const [{ id }] = await tx.insert(chatMessages).values({ threadId: thread.id, sender, kind: body.kind, body, readAt }).$returningId();
      const [row] = await tx.select().from(chatMessages).where(eq(chatMessages.id, id!));
      await tx.update(chatThreads).set({ lastMessageAt: row!.createdAt }).where(eq(chatThreads.id, thread.id));
      if (thread.leadId) await tx.update(leads).set({ lastActivityAt: sql`now(3)` }).where(eq(leads.id, thread.leadId));
      return row!;
    });
  }

  async findMessage(id: number): Promise<ChatMessageRow | undefined> {
    const [row] = await this.db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return row;
  }

  /**
   * Picks a time on a slots card, only if none is picked yet. False when someone (another tap)
   * already did.
   */
  async choose(id: number, time: string): Promise<boolean> {
    const [res] = await this.db
      .update(chatMessages)
      .set({ body: sql`json_set(${chatMessages.body}, '$.chosen', ${time})` })
      .where(and(eq(chatMessages.id, id), eq(chatMessages.kind, 'slots'), sql`json_type(json_extract(${chatMessages.body}, '$.chosen')) = 'NULL'`));
    return res.affectedRows === 1;
  }

  /** Marks the other side's messages read. Returns when, or null when there was nothing to mark. */
  async markRead(threadId: number, reader: ChatSender): Promise<Date | null> {
    const at = new Date();
    const [res] = await this.db
      .update(chatMessages)
      .set({ readAt: at })
      .where(and(eq(chatMessages.threadId, threadId), ne(chatMessages.sender, reader), isNull(chatMessages.readAt)));
    return res.affectedRows > 0 ? at : null;
  }

  /** The client's name and phone for the agent's side (empty name for a deleted account). */
  async clients(ids: number[]): Promise<Map<number, { name: string; phone: string | null }>> {
    if (!ids.length) return new Map();
    const rows = await this.db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(inArray(users.id, ids));
    return new Map(rows.map((r) => [r.id, { name: r.name, phone: r.phone }]));
  }

  /** The latest conversation between this client and agent, for the lead page's chat button. */
  async latestBetween(clientId: number, agentId: number): Promise<number | undefined> {
    const [row] = await this.db
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(and(eq(chatThreads.clientId, clientId), eq(chatThreads.agentId, agentId), isNotNull(chatThreads.lastMessageAt)))
      .orderBy(desc(chatThreads.lastMessageAt))
      .limit(1);
    return row?.id;
  }
}
