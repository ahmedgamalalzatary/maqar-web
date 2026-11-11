import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GOOD_MATCH, matchScore, type MatchListing, type NotificationItem, type NotificationKind, NOTIFICATIONS_LIMIT, type NotificationsResponse, type PushPlatform } from '@maqar/shared';
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

/** The most clients one listing's publish may notify (OPS-08): a bounded fan-out. */
const MATCH_NOTIFY_CAP = 200;

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
   * Null for a deleted account: nothing is saved or sent. Delivery is secondary to the caller's
   * committed action (a booking, a message, a price change): any failure here — the account
   * lookup, the inbox write, or the push — is logged, never thrown, so the caller's request
   * reports what actually happened to its own write.
   */
  async notify(userId: number, n: NewNotification): Promise<NotificationItem | null> {
    try {
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
    } catch (err) {
      this.log.error(`Notification to user ${userId} was not delivered: ${(err as Error).message}`);
      return null;
    }
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

  async list(userId: number, limit = NOTIFICATIONS_LIMIT, before?: number): Promise<NotificationsResponse> {
    const [rows, unread] = await Promise.all([this.repo.list(userId, limit, before), this.repo.countUnread(userId)]);
    return { items: rows.map(toItem), unread };
  }

  markAllRead(userId: number): Promise<void> {
    return this.repo.markAllRead(userId);
  }

  async markRead(userId: number, id: number): Promise<void> {
    if (!(await this.repo.markRead(userId, id))) throw new NotFoundException('Notification not found');
  }

  /**
   * A listing was published (or republished): tell the clients whose saved preferences score a good
   * match (§8.3). Bounded to 200 per listing, and a client is told about a listing once, however
   * often it is published. Delivery is secondary, like `notify`.
   */
  async notifyMatches(l: MatchListing & { id: number }): Promise<number> {
    try {
      const href = `/property/${l.id}`;
      const clients = await this.users.clientsWithPrefs();
      const matching = clients.filter((c) => matchScore(l, c.prefs).score >= GOOD_MATCH);
      const already = await this.repo.notifiedUsers(href, matching.map((c) => c.userId));
      const fresh = matching.filter((c) => !already.has(c.userId)).slice(0, MATCH_NOTIFY_CAP);
      let sent = 0;
      for (const c of fresh) {
        const score = matchScore(l, c.prefs);
        const item = await this.notify(c.userId, {
          kind: 'match',
          titleAr: 'بيت جديد يناسبك',
          titleEn: 'A new home to see',
          bodyAr: `${l.area.nameAr} — تطابق ${score.score}٪`,
          bodyEn: `${l.area.nameEn} — ${score.score}% match`,
          href,
        });
        if (item) sent += 1;
      }
      return sent;
    } catch (err) {
      this.log.error(`Match notifications for listing ${l.id} failed: ${(err as Error).message}`);
      return 0;
    }
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
