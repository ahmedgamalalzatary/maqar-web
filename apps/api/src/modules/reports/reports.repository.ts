import { Injectable } from '@nestjs/common';
import type { Category, ChatReportReason, LeadSource, LeadStage, PropertyStatus, PropertyType, PushPlatform, ReportOutcome, ViewingCanceller, ViewingStatus } from '@maqar/shared';
import { and, asc, count, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { areas } from '../areas/areas.schema.js';
import { chatMessages, chatReports, chatThreads } from '../chat/chat.schema.js';
import { favorites } from '../favorites/favorites.schema.js';
import { interestFirst, listingStats } from '../insights/insights.schema.js';
import { leads } from '../leads/leads.schema.js';
import { pushTokens } from '../notifications/notifications.schema.js';
import { priceAlerts, priceHistory } from '../prices/prices.schema.js';
import { properties, propertyImages, propertyVideos, tourRooms } from '../properties/properties.schema.js';
import { clientPrefs, users } from '../users/users.schema.js';
import { viewings } from '../viewings/viewings.schema.js';
import { n } from './reports.util.js';

export type ListingFact = {
  id: number;
  titleAr: string;
  titleEn: string;
  category: Category;
  type: PropertyType;
  status: PropertyStatus;
  areaId: string;
  agentId: number | null;
  price: number;
  sizeM2: number;
  publishedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  hasPin: boolean;
  descAr: string;
  descEn: string;
  ownerPhone: string | null;
};

export type LeadFact = {
  id: number;
  clientId: number | null;
  name: string | null;
  phone: string | null;
  propertyId: number | null;
  agentId: number;
  source: LeadSource;
  stage: LeadStage;
  hot: boolean;
  lastActivityAt: Date;
  wonAt: Date | null;
  lostAt: Date | null;
  createdAt: Date;
};

export type ViewingFact = {
  id: number;
  propertyId: number;
  clientId: number;
  agentId: number;
  status: ViewingStatus;
  startsAt: Date;
  createdAt: Date;
  updatedAt: Date;
  cancelledBy: ViewingCanceller | null;
  rescheduled: boolean;
};

export type ThreadFact = { id: number; clientId: number; agentId: number; propertyId: number; createdAt: Date; blockedAt: Date | null; blockedBy: string | null };
/** `auto`: the out-of-hours reply the chat sends by itself; it is not the advisor answering. */
export type MessageFact = { threadId: number; sender: 'client' | 'agent'; createdAt: Date; auto?: boolean };

/** True for the chat's automatic out-of-hours reply (`body.auto`). */
const isAuto = sql<number>`coalesce(${chatMessages.body}->>'$.auto', '') = 'true'`;

/**
 * The rows behind the admin's reports (phase 27). Each loader takes what the range and the
 * previous period need (`since` is the start of the previous period); the reports add up in code.
 */
@Injectable()
export class ReportsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listings(): Promise<ListingFact[]> {
    const rows = await this.db
      .select({
        id: properties.id,
        titleAr: properties.titleAr,
        titleEn: properties.titleEn,
        category: properties.category,
        type: properties.type,
        status: properties.status,
        areaId: properties.areaId,
        agentId: properties.agentId,
        price: properties.price,
        sizeM2: properties.sizeM2,
        publishedAt: properties.publishedAt,
        closedAt: properties.closedAt,
        createdAt: properties.createdAt,
        lat: properties.lat,
        descAr: properties.descAr,
        descEn: properties.descEn,
        ownerPhone: properties.ownerPhone,
      })
      .from(properties)
      .orderBy(asc(properties.id));
    return rows.map(({ lat, ...r }) => ({ ...r, hasPin: lat !== null }));
  }

  areas() {
    return this.db.select({ id: areas.id, nameAr: areas.nameAr, nameEn: areas.nameEn }).from(areas).orderBy(asc(areas.nameEn));
  }

  agents() {
    return this.db
      .select({ id: agents.userId, nameAr: agents.nameAr, nameEn: agents.nameEn, colour: agents.colour, monthlyTarget: agents.monthlyTarget, active: agents.active })
      .from(agents)
      .orderBy(asc(agents.nameEn));
  }

  /** Leads made, won or lost since `since`, and every open lead. */
  async leads(since: Date): Promise<LeadFact[]> {
    const rows = await this.db
      .select({
        id: leads.id,
        clientId: leads.clientId,
        name: leads.name,
        phone: leads.phone,
        propertyId: leads.propertyId,
        agentId: leads.agentId,
        source: leads.source,
        stage: leads.stage,
        hot: leads.hot,
        lastActivityAt: leads.lastActivityAt,
        wonAt: leads.wonAt,
        lostAt: leads.lostAt,
        createdAt: leads.createdAt,
        clientName: users.name,
        clientPhone: users.phone,
      })
      .from(leads)
      .leftJoin(users, eq(users.id, leads.clientId))
      .where(or(gte(leads.createdAt, since), gte(leads.wonAt, since), gte(leads.lostAt, since), sql`${leads.stage} not in ('won', 'lost')`));
    return rows.map(({ clientName, clientPhone, ...r }) => ({ ...r, source: r.source as LeadSource, name: r.name ?? clientName, phone: r.phone ?? clientPhone }));
  }

  /** Viewings booked, held or changed since `since`. */
  async viewings(since: Date): Promise<ViewingFact[]> {
    const rows = await this.db
      .select({
        id: viewings.id,
        propertyId: viewings.propertyId,
        clientId: viewings.clientId,
        agentId: viewings.agentId,
        status: viewings.status,
        startsAt: viewings.startsAt,
        createdAt: viewings.createdAt,
        updatedAt: viewings.updatedAt,
        cancelledBy: viewings.cancelledBy,
        rescheduledFrom: viewings.rescheduledFrom,
      })
      .from(viewings)
      .where(or(gte(viewings.createdAt, since), gte(viewings.startsAt, since), gte(viewings.updatedAt, since)));
    return rows.map(({ rescheduledFrom, ...r }) => ({ ...r, rescheduled: rescheduledFrom !== null }));
  }

  /** Conversations with messages, started since `since`, and their messages. */
  async threads(since: Date): Promise<{ threads: ThreadFact[]; messages: MessageFact[] }> {
    const threads = await this.db
      .select({
        id: chatThreads.id,
        clientId: chatThreads.clientId,
        agentId: chatThreads.agentId,
        propertyId: chatThreads.propertyId,
        createdAt: chatThreads.createdAt,
        blockedAt: chatThreads.blockedAt,
        blockedBy: chatThreads.blockedBy,
      })
      .from(chatThreads)
      .where(and(isNotNull(chatThreads.lastMessageAt), gte(chatThreads.createdAt, since)));
    const ids = threads.map((t) => t.id);
    const messages = ids.length
      ? await this.db
          .select({ threadId: chatMessages.threadId, sender: chatMessages.sender, createdAt: chatMessages.createdAt, auto: isAuto })
          .from(chatMessages)
          .where(inArray(chatMessages.threadId, ids))
          .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
      : [];
    return { threads, messages: messages.map((m) => ({ ...m, auto: Number(m.auto) === 1 })) };
  }

  /** Messages sent since `since` (any conversation), by sender. */
  messagesSince(since: Date) {
    return this.db
      .select({ threadId: chatMessages.threadId, sender: chatMessages.sender, createdAt: chatMessages.createdAt, clientId: chatThreads.clientId, agentId: chatThreads.agentId })
      .from(chatMessages)
      .innerJoin(chatThreads, eq(chatThreads.id, chatMessages.threadId))
      .where(gte(chatMessages.createdAt, since));
  }

  /**
   * Open conversations whose last message is the client's: they wait for a reply. The automatic
   * out-of-hours reply does not count as one, so its time and sender are skipped.
   */
  async waiting() {
    const human = sql.raw(`coalesce(m.body->>'$.auto', '') <> 'true'`);
    const last = sql<string>`(select m.sender from ${chatMessages} m where m.thread_id = ${chatThreads.id} and ${human} order by m.created_at desc, m.id desc limit 1)`;
    // Decoded like the column itself (UTC), not as local time.
    const lastAt = sql`(select m.created_at from ${chatMessages} m where m.thread_id = ${chatThreads.id} and ${human} order by m.created_at desc, m.id desc limit 1)`.mapWith(chatMessages.createdAt);
    const rows = await this.db
      .select({
        id: chatThreads.id,
        clientId: chatThreads.clientId,
        agentId: chatThreads.agentId,
        propertyId: chatThreads.propertyId,
        lastMessageAt: chatThreads.lastMessageAt,
        lastHumanAt: lastAt,
        last,
        clientName: users.name,
      })
      .from(chatThreads)
      .innerJoin(users, eq(users.id, chatThreads.clientId))
      .where(and(isNotNull(chatThreads.lastMessageAt), isNull(chatThreads.blockedAt), isNull(users.deletedAt)));
    return rows
      .filter((r) => r.last === 'client')
      .map(({ last: _l, lastHumanAt, ...r }) => ({ ...r, lastMessageAt: lastHumanAt ?? r.lastMessageAt! }));
  }

  chatReports(since: Date) {
    return this.db
      .select({ id: chatReports.id, threadId: chatReports.threadId, reason: chatReports.reason, outcome: chatReports.outcome, createdAt: chatReports.createdAt, agentId: chatThreads.agentId })
      .from(chatReports)
      .innerJoin(chatThreads, eq(chatThreads.id, chatReports.threadId))
      .where(gte(chatReports.createdAt, since)) as Promise<{ id: number; threadId: number; reason: ChatReportReason; outcome: ReportOutcome | null; createdAt: Date; agentId: number }[]>;
  }

  /** Per listing and Cairo day since `sinceDay`: views and saves. */
  stats(sinceDay: string) {
    return this.db.select({ propertyId: listingStats.propertyId, day: listingStats.day, views: listingStats.views, saves: listingStats.saves }).from(listingStats).where(gte(listingStats.day, sinceDay));
  }

  /** The first time each client showed each kind of interest in each listing, since `sinceDay`. */
  interest(sinceDay: string) {
    return this.db.select({ propertyId: interestFirst.propertyId, clientId: interestFirst.clientId, kind: interestFirst.kind, day: interestFirst.day }).from(interestFirst).where(gte(interestFirst.day, sinceDay));
  }

  priceChanges(since: Date) {
    return this.db
      .select({ id: priceHistory.id, propertyId: priceHistory.propertyId, oldPrice: priceHistory.oldPrice, newPrice: priceHistory.newPrice, at: priceHistory.at, byName: users.name, byRole: users.role })
      .from(priceHistory)
      .leftJoin(users, eq(users.id, priceHistory.changedBy))
      .where(gte(priceHistory.at, since))
      .orderBy(asc(priceHistory.at));
  }

  /** How many clients follow each listing's price now. */
  async followers(): Promise<Map<number, number>> {
    const rows = await this.db.select({ id: priceAlerts.propertyId, n: count() }).from(priceAlerts).groupBy(priceAlerts.propertyId);
    return new Map(rows.map((r) => [r.id, n(r.n)]));
  }

  favoritesSince(since: Date) {
    return this.db.select({ userId: favorites.userId, propertyId: favorites.propertyId, createdAt: favorites.createdAt }).from(favorites).where(gte(favorites.createdAt, since));
  }

  alertsSince(since: Date) {
    return this.db.select({ userId: priceAlerts.userId, propertyId: priceAlerts.propertyId, createdAt: priceAlerts.createdAt }).from(priceAlerts).where(gte(priceAlerts.createdAt, since));
  }

  /** Every client account, deleted ones included (they count as deleted in their range). */
  clients() {
    return this.db
      .select({ id: users.id, name: users.name, email: users.email, phone: users.phone, lang: users.lang, createdAt: users.createdAt, deletedAt: users.deletedAt, suspendedAt: users.suspendedAt })
      .from(users)
      .where(eq(users.role, 'client'));
  }

  prefs() {
    return this.db.select({ userId: clientPrefs.userId, purposes: clientPrefs.purposes, budgetMax: clientPrefs.budgetMax, areaIds: clientPrefs.areaIds }).from(clientPrefs);
  }

  pushPlatforms() {
    return this.db.selectDistinct({ userId: pushTokens.userId, platform: pushTokens.platform }).from(pushTokens) as Promise<{ userId: number; platform: PushPlatform }[]>;
  }

  /** Per listing: photos, whether it has a tour, how many videos. */
  async media(): Promise<{ photos: Map<number, number>; tours: Set<number>; videos: Map<number, number> }> {
    const [photos, tours, vids] = await Promise.all([
      this.db.select({ id: propertyImages.propertyId, n: count() }).from(propertyImages).groupBy(propertyImages.propertyId),
      this.db.selectDistinct({ id: tourRooms.propertyId }).from(tourRooms),
      this.db.select({ id: propertyVideos.propertyId, n: count() }).from(propertyVideos).groupBy(propertyVideos.propertyId),
    ]);
    return { photos: new Map(photos.map((r) => [r.id, n(r.n)])), tours: new Set(tours.map((r) => r.id)), videos: new Map(vids.map((r) => [r.id, n(r.n)])) };
  }
}
