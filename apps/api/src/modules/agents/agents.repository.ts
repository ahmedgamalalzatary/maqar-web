import { Injectable } from '@nestjs/common';
import type { DayHours } from '@maqar/shared';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { refreshTokens } from '../auth/auth.schema.js';
import { leads } from '../leads/leads.schema.js';
import { properties } from '../properties/properties.schema.js';
import { type NewUserRow, users } from '../users/users.schema.js';
import { viewings } from '../viewings/viewings.schema.js';
import { type AgentRow, agentDaysOff, agentHours, agents } from './agents.schema.js';

type NewAgentRow = typeof agents.$inferInsert;

// Outer columns are written with their table, so the subqueries never read their own table's column.
const outer = sql.raw('`agents`.`user_id`');
const live = sql<number>`(select count(*) from ${properties} where ${properties.agentId} = ${outer} and ${properties.status} = 'approved')`;
const openLeads = sql<number>`(select count(*) from ${leads} where ${leads.agentId} = ${outer} and ${leads.stage} not in ('won', 'lost'))`;

/** Agents for the admin tools (phase 18): profiles, accounts, weekly hours and days off. */
@Injectable()
export class AgentsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  private rows(where?: ReturnType<typeof eq>) {
    return this.db
      .select({ a: agents, email: users.email, live, openLeads })
      .from(agents)
      .innerJoin(users, eq(users.id, agents.userId))
      .where(and(isNull(users.deletedAt), where))
      .orderBy(desc(agents.active), asc(live), asc(agents.userId));
  }

  async list(activeOnly: boolean): Promise<(AgentRow & { email: string | null; live: number; openLeads: number })[]> {
    const rows = await this.rows(activeOnly ? eq(agents.active, true) : undefined);
    return rows.map((r) => ({ ...r.a, email: r.email, live: Number(r.live), openLeads: Number(r.openLeads) }));
  }

  async find(id: number) {
    const [r] = await this.rows(eq(agents.userId, id));
    return r && { ...r.a, email: r.email, live: Number(r.live), openLeads: Number(r.openLeads) };
  }

  async emailTaken(email: string): Promise<boolean> {
    const [row] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return row !== undefined;
  }

  /** The account and the profile together, so an agent never lacks one. */
  async create(user: NewUserRow, profile: Omit<NewAgentRow, 'userId'>): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [{ id }] = await tx.insert(users).values(user).$returningId();
      await tx.insert(agents).values({ ...profile, userId: id });
      return id;
    });
  }

  async update(id: number, user: Partial<NewUserRow>, profile: Partial<NewAgentRow>): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (Object.keys(user).length) await tx.update(users).set(user).where(eq(users.id, id));
      if (Object.keys(profile).length) await tx.update(agents).set(profile).where(eq(agents.userId, id));
    });
  }

  /** Ends every session: a turned-off agent or a new password signs them out everywhere. */
  async endSessions(userId: number): Promise<void> {
    await this.db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  /** How many of these ids are agents. */
  async countExisting(ids: number[]): Promise<number> {
    const [{ n }] = await this.db.select({ n: count() }).from(agents).where(inArray(agents.userId, ids));
    return n;
  }

  async hours(id: number): Promise<DayHours[]> {
    const rows = await this.db.select().from(agentHours).where(eq(agentHours.agentId, id)).orderBy(asc(agentHours.weekday));
    return rows.map((r) => ({ weekday: r.weekday, from: r.fromHour, to: r.toHour }));
  }

  /** The same week for each agent, replacing what they had. */
  async setHours(ids: number[], week: DayHours[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(agentHours).where(inArray(agentHours.agentId, ids));
      await tx.insert(agentHours).values(ids.flatMap((agentId) => week.map((d) => ({ agentId, weekday: d.weekday, fromHour: d.from, toHour: d.to }))));
    });
  }

  async daysOffFrom(id: number, from: string): Promise<{ date: string; reason: string | null }[]> {
    return this.db
      .select({ date: agentDaysOff.date, reason: agentDaysOff.reason })
      .from(agentDaysOff)
      .where(and(eq(agentDaysOff.agentId, id), gte(agentDaysOff.date, from)))
      .orderBy(asc(agentDaysOff.date));
  }

  /** Adding a day that is already off keeps it, with the new reason when one is given. */
  async addDaysOff(ids: number[], dates: string[], reason: string | null): Promise<void> {
    const values = ids.flatMap((agentId) => dates.map((date) => ({ agentId, date, reason })));
    await this.db
      .insert(agentDaysOff)
      .values(values)
      .onDuplicateKeyUpdate({ set: { reason: sql`coalesce(values(${agentDaysOff.reason}), ${agentDaysOff.reason})` } });
  }

  async removeDayOff(id: number, date: string): Promise<boolean> {
    const [res] = await this.db.delete(agentDaysOff).where(and(eq(agentDaysOff.agentId, id), eq(agentDaysOff.date, date)));
    return res.affectedRows > 0;
  }

  /** Live viewings each agent has in [from, to). */
  async bookedBetween(ids: number[], from: Date, to: Date): Promise<Map<number, number>> {
    const rows = await this.db
      .select({ agentId: viewings.agentId, n: count() })
      .from(viewings)
      .where(and(inArray(viewings.agentId, ids), isNotNull(viewings.active), gte(viewings.startsAt, from), lt(viewings.startsAt, to)))
      .groupBy(viewings.agentId);
    return new Map(rows.map((r) => [r.agentId, r.n]));
  }
}
