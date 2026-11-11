import { Injectable } from '@nestjs/common';
import type { InterestKind } from '@maqar/shared';
import { and, between, count, eq, inArray, isNull, max, min, ne, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { chatMessages, chatThreads } from '../chat/chat.schema.js';
import { favorites } from '../favorites/favorites.schema.js';
import { priceAlerts } from '../prices/prices.schema.js';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';
import { viewings } from '../viewings/viewings.schema.js';
import { interestFirst, listingStats } from './insights.schema.js';

/** One client's interest of one kind in a listing: when it started and when it last happened. */
export type InterestRow = { clientId: number; kind: InterestKind; firstAt: Date; lastAt: Date };

@Injectable()
export class InsightsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Records a kind of interest the first time it happens; later occurrences keep the first day. */
  async recordInterest(propertyId: number, clientId: number, kind: InterestKind, day: string): Promise<void> {
    await this.db
      .insert(interestFirst)
      .values({ propertyId, clientId, kind, day })
      .onDuplicateKeyUpdate({ set: { day: sql`${interestFirst.day}` } });
  }

  /** Per Cairo day, how many clients became interested for the first time that day. */
  async firstInterestDays(propertyId: number): Promise<{ day: string; clients: number }[]> {
    const rows = await this.db
      .select({ clientId: interestFirst.clientId, day: min(interestFirst.day) })
      .from(interestFirst)
      .where(eq(interestFirst.propertyId, propertyId))
      .groupBy(interestFirst.clientId);
    const perDay = new Map<string, number>();
    for (const r of rows) perDay.set(r.day!, (perDay.get(r.day!) ?? 0) + 1);
    return [...perDay].map(([day, clients]) => ({ day, clients }));
  }

  /** The first Cairo day with recorded daily numbers, or null before any. */
  async firstTrackedDay(propertyId: number): Promise<string | null> {
    const [row] = await this.db
      .select({ day: min(listingStats.day) })
      .from(listingStats)
      .where(eq(listingStats.propertyId, propertyId));
    return row?.day ?? null;
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
      // Booked means it was never cancelled; rescheduled and past appointments are still demand.
      n(this.db.select({ n: count() }).from(viewings).where(and(eq(viewings.propertyId, propertyId), ne(viewings.status, 'cancelled')))),
    ]);
    return { views: views[0]?.views ?? 0, saves, followers, chats, viewings: booked };
  }

  /** Every client's saves, follows, chats and bookings of the listing. */
  async interest(propertyId: number): Promise<InterestRow[]> {
    const [saved, followed, chatted, booked] = await Promise.all([
      this.db.select({ clientId: favorites.userId, at: favorites.createdAt }).from(favorites).where(eq(favorites.propertyId, propertyId)),
      this.db.select({ clientId: priceAlerts.userId, at: priceAlerts.createdAt }).from(priceAlerts).where(eq(priceAlerts.propertyId, propertyId)),
      // Chatted means the client sent a message: an advisor's reply or the automatic away
      // reply does not make the client active, and opening an empty thread is not interest.
      this.db
        .select({ clientId: chatThreads.clientId, firstAt: min(chatMessages.createdAt), lastAt: max(chatMessages.createdAt) })
        .from(chatThreads)
        .innerJoin(chatMessages, and(eq(chatMessages.threadId, chatThreads.id), eq(chatMessages.sender, 'client')))
        .where(eq(chatThreads.propertyId, propertyId))
        .groupBy(chatThreads.clientId),
      this.db
        .select({ clientId: viewings.clientId, firstAt: min(viewings.createdAt), lastAt: max(viewings.createdAt) })
        .from(viewings)
        .where(eq(viewings.propertyId, propertyId))
        .groupBy(viewings.clientId),
    ]);
    return [
      ...saved.map((r) => ({ clientId: r.clientId, kind: 'saved' as const, firstAt: r.at, lastAt: r.at })),
      ...followed.map((r) => ({ clientId: r.clientId, kind: 'followed' as const, firstAt: r.at, lastAt: r.at })),
      ...chatted.map((r) => ({ clientId: r.clientId, kind: 'chatted' as const, firstAt: r.firstAt!, lastAt: r.lastAt! })),
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
