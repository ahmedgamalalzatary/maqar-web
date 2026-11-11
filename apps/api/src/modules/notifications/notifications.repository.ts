import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { type NewNotificationRow, type NotificationRow, notifications, pushTokens } from './notifications.schema.js';

@Injectable()
export class NotificationsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async create(row: NewNotificationRow): Promise<NotificationRow> {
    const [{ id }] = await this.db.insert(notifications).values(row).$returningId();
    const [saved] = await this.db.select().from(notifications).where(eq(notifications.id, id!));
    return saved!;
  }

  /** The newest first: ids grow with time, and the (user_id, id) index serves this. */
  list(userId: number, limit: number, before?: number): Promise<NotificationRow[]> {
    return this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), before ? lt(notifications.id, before) : undefined))
      .orderBy(desc(notifications.id))
      .limit(limit);
  }

  async countUnread(userId: number): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  }

  async markAllRead(userId: number): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  /** False when the notification is missing or someone else's. Reading it twice keeps the first time. */
  async markRead(userId: number, id: number): Promise<boolean> {
    const [row] = await this.db
      .select({ readAt: notifications.readAt })
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    if (!row) return false;
    if (!row.readAt) await this.db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, id));
    return true;
  }

  async tokens(userId: number): Promise<string[]> {
    const rows = await this.db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.userId, userId));
    return rows.map((r) => r.token);
  }

  /** The token is this phone's: if another account had it, it moves to this one. */
  async saveToken(userId: number, token: string, platform: 'ios' | 'android'): Promise<void> {
    await this.db.insert(pushTokens).values({ userId, token, platform }).onDuplicateKeyUpdate({ set: { userId, platform } });
  }

  async deleteToken(userId: number, token: string): Promise<void> {
    await this.db.delete(pushTokens).where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  }

  async deleteTokens(tokens: string[]): Promise<void> {
    if (tokens.length) await this.db.delete(pushTokens).where(inArray(pushTokens.token, tokens));
  }

  /** Which of these users already have a notification with this href (de-duplicating a fan-out). */
  async notifiedUsers(href: string, userIds: number[]): Promise<Set<number>> {
    if (!userIds.length) return new Set();
    const rows = await this.db
      .selectDistinct({ userId: notifications.userId })
      .from(notifications)
      .where(and(eq(notifications.href, href), inArray(notifications.userId, userIds)));
    return new Set(rows.map((r) => r.userId));
  }
}
