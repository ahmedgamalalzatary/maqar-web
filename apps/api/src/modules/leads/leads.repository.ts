import { Injectable } from '@nestjs/common';
import type { LeadStage } from '@maqar/shared';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { users } from '../users/users.schema.js';
import { isDuplicate } from '../viewings/viewings.repository.js';
import { viewings } from '../viewings/viewings.schema.js';
import { type LeadRow, leadNotes, leads } from './leads.schema.js';

/** A lead with its client's account, when it has one (deleted accounts keep an empty name). */
export type LeadWithClient = { lead: LeadRow; clientName: string | null; clientPhone: string | null };

/** A live viewing with the lead it belongs to. */
export type ViewingWithLead = {
  id: number;
  propertyId: number;
  startsAt: Date;
  mode: 'visit' | 'video';
  createdAt: Date;
  clientName: string | null;
  leadId: number | null;
  leadName: string | null;
  seenAt: Date | null;
};

@Injectable()
export class LeadsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  private selectLeads() {
    return this.db
      .select({ lead: leads, clientName: users.name, clientPhone: users.phone })
      .from(leads)
      .leftJoin(users, eq(users.id, leads.clientId));
  }

  /** The agent's leads, the latest activity first. */
  listFor(agentId: number, stage?: LeadStage): Promise<LeadWithClient[]> {
    return this.selectLeads()
      .where(and(eq(leads.agentId, agentId), stage ? eq(leads.stage, stage) : undefined))
      .orderBy(desc(leads.lastActivityAt), desc(leads.id));
  }

  /** Every agent's leads for the admin tools (phase 18), the latest activity first. */
  listAll(f: { agentId?: number; stage?: LeadStage }): Promise<LeadWithClient[]> {
    return this.selectLeads()
      .where(and(f.agentId ? eq(leads.agentId, f.agentId) : undefined, f.stage ? eq(leads.stage, f.stage) : undefined))
      .orderBy(desc(leads.lastActivityAt), desc(leads.id))
      .limit(500);
  }

  async findById(id: number): Promise<LeadWithClient | undefined> {
    const [row] = await this.selectLeads().where(eq(leads.id, id));
    return row;
  }

  /** Gives the lead to another agent, who sees it as new. False when the client already has a lead with them. */
  async assign(id: number, agentId: number): Promise<boolean> {
    try {
      await this.db.update(leads).set({ agentId, seenAt: null }).where(eq(leads.id, id));
      return true;
    } catch (err) {
      if (isDuplicate(err)) return false;
      throw err;
    }
  }

  /** Names and colours of these agents, and whether each is active. */
  async agentsOf(ids: number[]): Promise<Map<number, { id: number; nameAr: string; nameEn: string; colour: string; active: boolean }>> {
    if (!ids.length) return new Map();
    const rows = await this.db
      .select({ id: agents.userId, nameAr: agents.nameAr, nameEn: agents.nameEn, colour: agents.colour, active: agents.active })
      .from(agents)
      .where(inArray(agents.userId, [...new Set(ids)]));
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** The lead, only when it is this agent's. */
  async findOwn(agentId: number, id: number): Promise<LeadWithClient | undefined> {
    const [row] = await this.selectLeads().where(and(eq(leads.id, id), eq(leads.agentId, agentId)));
    return row;
  }

  async markSeen(id: number): Promise<void> {
    await this.db.update(leads).set({ seenAt: new Date() }).where(eq(leads.id, id));
  }

  /** A new stage dates the lead's activity; Won is stamped once and cleared if the lead moves back. */
  async update(id: number, change: { stage?: LeadStage; hot?: boolean }): Promise<void> {
    await this.db
      .update(leads)
      .set({
        ...(change.hot === undefined ? {} : { hot: change.hot }),
        ...(change.stage === undefined
          ? {}
          : {
              stage: change.stage,
              wonAt: change.stage === 'won' ? sql`coalesce(${leads.wonAt}, now())` : null,
              lastActivityAt: sql`now(3)`,
            }),
      })
      .where(eq(leads.id, id));
  }

  notesOf(leadId: number) {
    return this.db.select().from(leadNotes).where(eq(leadNotes.leadId, leadId)).orderBy(desc(leadNotes.createdAt), desc(leadNotes.id));
  }

  async addNote(leadId: number, agentId: number, text: string): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [{ id }] = await tx.insert(leadNotes).values({ leadId, agentId, text }).$returningId();
      await tx.update(leads).set({ lastActivityAt: sql`now(3)` }).where(eq(leads.id, leadId));
      return id!;
    });
  }

  async findNote(id: number) {
    const [row] = await this.db.select().from(leadNotes).where(eq(leadNotes.id, id));
    return row;
  }

  /** How many of the agent's leads are at each stage. */
  async pipeline(agentId: number): Promise<{ stage: LeadStage; n: number }[]> {
    return this.db.select({ stage: leads.stage, n: count() }).from(leads).where(eq(leads.agentId, agentId)).groupBy(leads.stage);
  }

  /** Deals each active agent moved to Won since `from`, for the target card and the team average. */
  async wonSince(from: Date): Promise<{ agentId: number; target: number; won: number }[]> {
    const rows = await this.db
      .select({
        agentId: agents.userId,
        target: agents.monthlyTarget,
        won: sql<number>`count(${leads.id})`.mapWith(Number),
      })
      .from(agents)
      .leftJoin(leads, and(eq(leads.agentId, agents.userId), eq(leads.stage, 'won'), gte(leads.wonAt, from)))
      .where(eq(agents.active, true))
      .groupBy(agents.userId, agents.monthlyTarget);
    return rows;
  }

  /** The agent's live viewings in [from, to), soonest first, with their leads. */
  viewingsBetween(agentId: number, from: Date, to?: Date, limit?: number): Promise<ViewingWithLead[]> {
    const q = this.db
      .select({
        id: viewings.id,
        propertyId: viewings.propertyId,
        startsAt: viewings.startsAt,
        mode: viewings.mode,
        createdAt: viewings.createdAt,
        clientName: users.name,
        leadId: leads.id,
        leadName: leads.name,
        seenAt: leads.seenAt,
      })
      .from(viewings)
      .leftJoin(users, eq(users.id, viewings.clientId))
      .leftJoin(leads, and(eq(leads.clientId, viewings.clientId), eq(leads.agentId, viewings.agentId)))
      .where(and(eq(viewings.agentId, agentId), isNotNull(viewings.active), gte(viewings.startsAt, from), to ? lt(viewings.startsAt, to) : undefined))
      .orderBy(asc(viewings.startsAt), asc(viewings.id));
    return limit ? q.limit(limit) : q;
  }

  /** The lead's next live viewing with its agent (until an hour after it starts), or else the latest one. */
  async viewingOf(lead: LeadRow, now: Date): Promise<(ViewingWithLead & { status: string }) | undefined> {
    if (!lead.clientId) return undefined;
    const base = () =>
      this.db
        .select({
          id: viewings.id,
          propertyId: viewings.propertyId,
          startsAt: viewings.startsAt,
          mode: viewings.mode,
          createdAt: viewings.createdAt,
          status: viewings.status,
          clientName: users.name,
        })
        .from(viewings)
        .leftJoin(users, eq(users.id, viewings.clientId));
    const mine = and(eq(viewings.clientId, lead.clientId), eq(viewings.agentId, lead.agentId));
    const [next] = await base()
      .where(and(mine, isNotNull(viewings.active), gte(viewings.startsAt, new Date(now.getTime() - 3_600_000))))
      .orderBy(asc(viewings.startsAt))
      .limit(1);
    const row = next ?? (await base().where(mine).orderBy(desc(viewings.startsAt)).limit(1))[0];
    return row ? { ...row, leadId: lead.id, leadName: lead.name, seenAt: lead.seenAt } : undefined;
  }

  async agentNames(agentId: number): Promise<{ nameAr: string; nameEn: string } | undefined> {
    const [row] = await this.db.select({ nameAr: agents.nameAr, nameEn: agents.nameEn }).from(agents).where(eq(agents.userId, agentId));
    return row;
  }
}
