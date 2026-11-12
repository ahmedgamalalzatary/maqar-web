import { Injectable } from '@nestjs/common';
import { type LeadStage, type PropertyStatus } from '@maqar/shared';
import { and, count, eq, gte, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { chatMessages, chatReports, chatThreads } from '../chat/chat.schema.js';
import { leads } from '../leads/leads.schema.js';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';
import { viewings } from '../viewings/viewings.schema.js';

type Range = { from: Date; to: Date };
const n = (v: unknown) => Number(v ?? 0);

/** The counts behind the admin's overview (phase 25). `from` is included, `to` is not. */
@Injectable()
export class OverviewRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async listings({ from, to }: Range) {
    const [byStatus, [published], [closed]] = await Promise.all([
      this.db.select({ status: properties.status, n: count() }).from(properties).groupBy(properties.status),
      this.db.select({ n: count() }).from(properties).where(and(gte(properties.publishedAt, from), lt(properties.publishedAt, to))),
      this.db.select({ n: count() }).from(properties).where(and(gte(properties.closedAt, from), lt(properties.closedAt, to))),
    ]);
    return { byStatus: byStatus.map((r) => ({ status: r.status as PropertyStatus, n: n(r.n) })), published: n(published?.n), closed: n(closed?.n) };
  }

  async clients({ from, to }: Range) {
    const client = and(eq(users.role, 'client'), isNull(users.deletedAt));
    const [[total], [fresh]] = await Promise.all([
      this.db.select({ n: count() }).from(users).where(client),
      this.db.select({ n: count() }).from(users).where(and(client, gte(users.createdAt, from), lt(users.createdAt, to))),
    ]);
    return { total: n(total?.n), new: n(fresh?.n) };
  }

  async leads({ from, to }: Range) {
    const inRange = and(gte(leads.createdAt, from), lt(leads.createdAt, to));
    const [byStage, [won]] = await Promise.all([
      this.db.select({ stage: leads.stage, n: count() }).from(leads).where(inRange).groupBy(leads.stage),
      this.db.select({ n: count() }).from(leads).where(and(gte(leads.wonAt, from), lt(leads.wonAt, to))),
    ]);
    return { byStage: byStage.map((r) => ({ stage: r.stage as LeadStage, n: n(r.n) })), won: n(won?.n) };
  }

  async viewings({ from, to }: Range, now: Date) {
    const week = new Date(now.getTime() + 7 * 86_400_000);
    const [[booked], [completed], [cancelled], [next]] = await Promise.all([
      this.db.select({ n: count() }).from(viewings).where(and(gte(viewings.createdAt, from), lt(viewings.createdAt, to))),
      this.db
        .select({ n: count() })
        .from(viewings)
        .where(and(eq(viewings.status, 'completed'), gte(viewings.startsAt, from), lt(viewings.startsAt, to))),
      this.db
        .select({ n: count() })
        .from(viewings)
        .where(and(eq(viewings.status, 'cancelled'), gte(viewings.updatedAt, from), lt(viewings.updatedAt, to))),
      this.db
        .select({ n: count() })
        .from(viewings)
        .where(and(isNotNull(viewings.active), gte(viewings.startsAt, now), lt(viewings.startsAt, week))),
    ]);
    return { booked: n(booked?.n), completed: n(completed?.n), cancelled: n(cancelled?.n), next7Days: n(next?.n) };
  }

  async chats({ from, to }: Range) {
    const [[fresh], [messages], [reports]] = await Promise.all([
      this.db
        .select({ n: count() })
        .from(chatThreads)
        .where(and(isNotNull(chatThreads.lastMessageAt), gte(chatThreads.createdAt, from), lt(chatThreads.createdAt, to))),
      this.db.select({ n: count() }).from(chatMessages).where(and(gte(chatMessages.createdAt, from), lt(chatMessages.createdAt, to))),
      this.db.select({ n: count() }).from(chatReports).where(isNull(chatReports.resolvedAt)),
    ]);
    return { new: n(fresh?.n), messages: n(messages?.n), openReports: n(reports?.n) };
  }

  /**
   * Active advisors: live listings and open leads now, viewings booked in the range and not
   * cancelled, and leads won since `monthStart` (the Cairo month).
   */
  async agents({ from, to }: Range, monthStart: Date) {
    const id = sql.raw('`agents`.`user_id`');
    const live = sql<number>`(select count(*) from ${properties} where ${properties.agentId} = ${id} and ${properties.status} = 'approved')`;
    const open = sql<number>`(select count(*) from ${leads} where ${leads.agentId} = ${id} and ${leads.stage} not in ('won', 'lost'))`;
    const booked = sql<number>`(select count(*) from ${viewings} where ${viewings.agentId} = ${id} and ${viewings.status} <> 'cancelled' and ${viewings.createdAt} >= ${from} and ${viewings.createdAt} < ${to})`;
    const won = sql<number>`(select count(*) from ${leads} where ${leads.agentId} = ${id} and ${leads.wonAt} >= ${monthStart})`;
    const rows = await this.db
      .select({ id: agents.userId, nameAr: agents.nameAr, nameEn: agents.nameEn, colour: agents.colour, monthlyTarget: agents.monthlyTarget, live, open, booked, won })
      .from(agents)
      .where(eq(agents.active, true))
      .orderBy(agents.nameEn);
    return rows.map((r) => ({ id: r.id, nameAr: r.nameAr, nameEn: r.nameEn, colour: r.colour, monthlyTarget: r.monthlyTarget, live: n(r.live), openLeads: n(r.open), viewings: n(r.booked), wonThisMonth: n(r.won) }));
  }

  /** When each new client, lead and booked viewing in the range was made, for the daily chart. */
  async createdTimes({ from, to }: Range) {
    const [clients, newLeads, booked] = await Promise.all([
      this.db
        .select({ at: users.createdAt })
        .from(users)
        .where(and(eq(users.role, 'client'), isNull(users.deletedAt), gte(users.createdAt, from), lt(users.createdAt, to))),
      this.db.select({ at: leads.createdAt }).from(leads).where(and(gte(leads.createdAt, from), lt(leads.createdAt, to))),
      this.db.select({ at: viewings.createdAt }).from(viewings).where(and(gte(viewings.createdAt, from), lt(viewings.createdAt, to))),
    ]);
    return { clients: clients.map((r) => r.at), leads: newLeads.map((r) => r.at), viewings: booked.map((r) => r.at) };
  }
}

