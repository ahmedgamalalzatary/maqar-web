import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type NotificationItem, type NotificationKind, NOTIFICATIONS_LIMIT, type NotificationsResponse, type PushPlatform } from '@maqar/shared';
import { UsersRepository } from '../users/users.repository.js';
import type { UserRow } from '../users/users.schema.js';
import { NotificationsRepository } from './notifications.repository.js';
import type { NotificationRow } from './notifications.schema.js';
import { PushSender } from './push.sender.js';

/** What another module passes to `notify`: the text in both languages and the screen to open. */
export type NewNotification = {
  kind: NotificationKind;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  href?: string | null;
};

const toItem = (r: NotificationRow): NotificationItem => ({
  id: r.id,
  kind: r.kind,
  titleAr: r.titleAr,
  titleEn: r.titleEn,
  bodyAr: r.bodyAr,
  bodyEn: r.bodyEn,
  href: r.href,
  read: r.readAt !== null,
  createdAt: r.createdAt.toISOString(),
});

/**
 * The one way to tell a user something (contract §8.13). Other modules call `notify`: it saves the
 * inbox entry, then pushes it to the user's phones unless they turned phone notifications off.
 */
@Injectable()
export class NotificationsService {
  private readonly log = new Logger('Notifications');

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly users: UsersRepository,
    private readonly push: PushSender,
  ) {}

  /**
   * Null for a deleted account: nothing is saved or sent. A push that fails is logged, never
   * thrown: the inbox entry is already saved.
   */
  async notify(userId: number, n: NewNotification): Promise<NotificationItem | null> {
    const user = await this.users.findActiveById(userId);
    if (!user) return null;
    const row = await this.repo.create({ userId, ...n, href: n.href ?? null });
    if (user.pushEnabled) {
      try {
        await this.pushToPhones(user, row);
      } catch (err) {
        this.log.warn(`Push for notification ${row.id} failed: ${(err as Error).message}`);
      }
    }
    return toItem(row);
  }

  private async pushToPhones(user: UserRow, row: NotificationRow): Promise<void> {
    const userId = user.id;
    const tokens = await this.repo.tokens(userId);
    if (!tokens.length) return;
    const ar = user.lang === 'ar';
    const badge = await this.repo.countUnread(userId);
    const outcomes = await this.push.send(
      tokens.map((to) => ({
        to,
        title: ar ? row.titleAr : row.titleEn,
        body: ar ? row.bodyAr : row.bodyEn,
        data: { id: row.id, href: row.href },
        badge,
      })),
    );
    await this.repo.deleteTokens(tokens.filter((_, k) => outcomes[k] === 'gone'));
  }

  async list(userId: number, limit = NOTIFICATIONS_LIMIT): Promise<NotificationsResponse> {
    const [rows, unread] = await Promise.all([this.repo.list(userId, limit), this.repo.countUnread(userId)]);
    return { items: rows.map(toItem), unread };
  }

  markAllRead(userId: number): Promise<void> {
    return this.repo.markAllRead(userId);
  }

  async markRead(userId: number, id: number): Promise<void> {
    if (!(await this.repo.markRead(userId, id))) throw new NotFoundException('Notification not found');
  }

  /** Sent when phone notifications are turned on, so the user sees at once that they work. */
  sendTest(userId: number): Promise<NotificationItem | null> {
    return this.notify(userId, {
      kind: 'system',
      titleAr: 'الإشعارات شغالة',
      titleEn: 'Notifications are on',
      bodyAr: 'هيوصلك تذكير المعاينات ونزول الأسعار.',
      bodyEn: 'You’ll get viewing reminders and price drops.',
      href: '/notifications',
    });
  }

  saveToken(userId: number, token: string, platform: PushPlatform): Promise<void> {
    return this.repo.saveToken(userId, token, platform);
  }

  deleteToken(userId: number, token: string): Promise<void> {
    return this.repo.deleteToken(userId, token);
  }
}
