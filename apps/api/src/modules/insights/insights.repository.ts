import { Injectable } from '@nestjs/common';
import type { InterestKind } from '@maqar/shared';
import { and, between, count, eq, inArray, isNull, max, min, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { chatThreads } from '../chat/chat.schema.js';
import { favorites } from '../favorites/favorites.schema.js';
import { priceAlerts } from '../prices/prices.schema.js';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';
import { viewings } from '../viewings/viewings.schema.js';
import { listingStats } from './insights.schema.js';

/** One client's interest of one kind in a listing: when it started and when it last happened. */
export type InterestRow = { clientId: number; kind: InterestKind; firstAt: Date; lastAt: Date };

@Injectable()
export class InsightsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Adds one to the day's views or saves. */
  async bump(propertyId: number, day: string, field: 'views' | 'saves'): Promise<void> {
    await this.db
      .insert(listingStats)
      .values({ propertyId, day, [field]: 1 })
      .onDuplicateKeyUpdate({ set: { [field]: sql`${listingStats[field]} + 1` } });
  }

  async exists(propertyId: number): Promise<boolean> {
    const [row] = await this.db.select({ id: properties.id }).from(properties).where(eq(properties.id, propertyId));
    return !!row;
  }

  days(propertyId: number, from: string, to: string) {
    return this.db
      .select({ day: listingStats.day, views: listingStats.views, saves: listingStats.saves })
      .from(listingStats)
      .where(and(eq(listingStats.propertyId, propertyId), between(listingStats.day, from, to)));
  }

  /** All-time views, and how many clients have it saved or followed now, chats about it and viewings booked. */
  async totals(propertyId: number) {
    const n = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
    const [views, saves, followers, chats, booked] = await Promise.all([
      this.db.select({ views: properties.views }).from(properties).where(eq(properties.id, propertyId)),
      n(this.db.select({ n: count() }).from(favorites).where(eq(favorites.propertyId, propertyId))),
      n(this.db.select({ n: count() }).from(priceAlerts).where(eq(priceAlerts.propertyId, propertyId))),
      n(this.db.select({ n: count() }).from(chatThreads).where(eq(chatThreads.propertyId, propertyId))),
      n(this.db.select({ n: count() }).from(viewings).where(eq(viewings.propertyId, propertyId))),
    ]);
    return { views: views[0]?.views ?? 0, saves, followers, chats, viewings: booked };
  }

  /** Every client's saves, follows, chats and bookings of the listing. */
  async interest(propertyId: number): Promise<InterestRow[]> {
    const [saved, followed, chatted, booked] = await Promise.all([
      this.db.select({ clientId: favorites.userId, at: favorites.createdAt }).from(favorites).where(eq(favorites.propertyId, propertyId)),
      this.db.select({ clientId: priceAlerts.userId, at: priceAlerts.createdAt }).from(priceAlerts).where(eq(priceAlerts.propertyId, propertyId)),
      this.db
        .select({ clientId: chatThreads.clientId, firstAt: chatThreads.createdAt, lastAt: chatThreads.lastMessageAt })
        .from(chatThreads)
        .where(eq(chatThreads.propertyId, propertyId)),
      this.db
        .select({ clientId: viewings.clientId, firstAt: min(viewings.createdAt), lastAt: max(viewings.createdAt) })
        .from(viewings)
        .where(eq(viewings.propertyId, propertyId))
        .groupBy(viewings.clientId),
    ]);
    return [
      ...saved.map((r) => ({ clientId: r.clientId, kind: 'saved' as const, firstAt: r.at, lastAt: r.at })),
      ...followed.map((r) => ({ clientId: r.clientId, kind: 'followed' as const, firstAt: r.at, lastAt: r.at })),
      ...chatted.map((r) => ({ clientId: r.clientId, kind: 'chatted' as const, firstAt: r.firstAt, lastAt: r.lastAt ?? r.firstAt })),
      ...booked.map((r) => ({ clientId: r.clientId, kind: 'booked' as const, firstAt: r.firstAt!, lastAt: r.lastAt! })),
    ];
  }

  /** The clients among `ids` whose accounts still exist. */
  clients(ids: number[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.db
      .select({ id: users.id, name: users.name, phone: users.phone })
      .from(users)
      .where(and(inArray(users.id, ids), eq(users.role, 'client'), isNull(users.deletedAt)));
  }
}
