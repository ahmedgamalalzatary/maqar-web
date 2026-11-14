import { Injectable } from '@nestjs/common';
import type { ReminderOffset, ViewingCanceller } from '@maqar/shared';
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, like, lt, lte, ne, or, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agentDaysOff, agentHours, agents } from '../agents/agents.schema.js';
import { properties } from '../properties/properties.schema.js';
import { leads } from '../leads/leads.schema.js';
import { clientPrefs, users } from '../users/users.schema.js';
import { alreadyDue, LONGEST_REMINDER_MS, type PendingReminder } from './reminders.js';

/** How long a reminder claim holds: after this, an unsent claimed reminder is retried. */
const LEASE_MS = 5 * 60_000;
import { DEFAULT_HOURS, type WeekHours } from './slots.js';
import { type ViewingRow, viewingReminders, viewings } from './viewings.schema.js';

/** MySQL's duplicate key error: here, the agent's hour was booked a moment earlier. */
export const isDuplicate = (err: unknown) =>
  (err as { cause?: { code?: string }; code?: string })?.cause?.code === 'ER_DUP_ENTRY' || (err as { code?: string })?.code === 'ER_DUP_ENTRY';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

@Injectable()
export class ViewingsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** The agent's weekly hours (the default when none are set) and days off in [from, to]. */
  async schedule(agentId: number, from: string, to: string): Promise<{ hours: WeekHours; daysOff: Set<string> }> {
    const [rows, off] = await Promise.all([
      this.db.select().from(agentHours).where(eq(agentHours.agentId, agentId)),
      this.db
        .select({ date: agentDaysOff.date })
        .from(agentDaysOff)
        .where(and(eq(agentDaysOff.agentId, agentId), gte(agentDaysOff.date, from), sql`${agentDaysOff.date} <= ${to}`)),
    ]);
    const hours: WeekHours = rows.length ? new Map(rows.map((r) => [r.weekday, { from: r.fromHour, to: r.toHour }])) : new Map(DEFAULT_HOURS);
    return { hours, daysOff: new Set(off.map((o) => o.date)) };
  }

  /** The agent's live viewings in [from, to), leaving out one being moved. */
  async takenTimes(agentId: number, from: Date, to: Date, except?: number): Promise<Date[]> {
    const rows = await this.db
      .select({ startsAt: viewings.startsAt })
      .from(viewings)
      .where(
        and(
          eq(viewings.agentId, agentId),
          isNotNull(viewings.active),
          gte(viewings.startsAt, from),
          lt(viewings.startsAt, to),
          except === undefined ? undefined : ne(viewings.id, except),
        ),
      );
    return rows.map((r) => r.startsAt);
  }

  /** The client's live viewing of this home, if any. A viewing whose time passed is not live. */
  async activeFor(clientId: number, propertyId: number): Promise<ViewingRow | undefined> {
    const [row] = await this.db
      .select()
      .from(viewings)
      .where(
        and(eq(viewings.clientId, clientId), eq(viewings.propertyId, propertyId), isNotNull(viewings.active), gt(viewings.startsAt, sql`now()`)),
      );
    return row;
  }

  /**
   * Marks past confirmed/rescheduled viewings completed (contract §8.7), so they free the home and
   * read truthfully. A request the advisor never answered (2026-11-14) is cancelled instead.
   */
  async completePastViewings(): Promise<number> {
    const [res] = await this.db
      .update(viewings)
      .set({ status: sql`if(${viewings.status} = 'pending', 'cancelled', 'completed')` })
      .where(and(inArray(viewings.status, ['confirmed', 'rescheduled', 'pending']), lt(viewings.startsAt, sql`now()`)));
    return res.affectedRows ?? 0;
  }

  /**
   * Books the hour, saves the reminders, and creates the client's lead with the agent or moves it
   * to `viewing` (a lead further on, at negotiation or won, keeps its stage). All or nothing; a
   * duplicate key means the hour was just taken.
   */
  async book(v: { propertyId: number; clientId: number; agentId: number; startsAt: Date; reminders: ReminderOffset[]; pending?: boolean }): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(viewings)
        .values({ propertyId: v.propertyId, clientId: v.clientId, agentId: v.agentId, startsAt: v.startsAt, status: v.pending ? 'pending' : 'confirmed' })
        .$returningId();
      await this.setReminders(tx, id!, v.reminders, v.startsAt);
      // The budget comes from the client's preferences, when they set them. The lead turns hot and
      // unseen, so the agent sees the booking as "New from app".
      const [prefs] = await tx.select({ budget: clientPrefs.budgetMax }).from(clientPrefs).where(eq(clientPrefs.userId, v.clientId));
      await tx
        .insert(leads)
        .values({ clientId: v.clientId, agentId: v.agentId, propertyId: v.propertyId, stage: 'viewing', source: 'booking', fromApp: true, hot: true, budget: prefs?.budget ?? null })
        .onDuplicateKeyUpdate({
          set: {
            stage: sql`if(${leads.stage} in ('new', 'contacted', 'lost'), 'viewing', ${leads.stage})`,
            propertyId: v.propertyId,
            hot: true,
            seenAt: null,
            budget: sql`coalesce(${leads.budget}, ${prefs?.budget ?? null})`,
            lastActivityAt: sql`now(3)`,
          },
        });
      return id!;
    });
  }

  /**
   * Moves a live viewing; its reminders (the new choices, or the old ones) count again from the new
   * time. Only while the viewing is still active; false when another change got there first. A
   * request still waiting for the advisor keeps waiting, unless the advisor is the one moving it.
   */
  async reschedule(id: number, from: Date, to: Date, reminders?: ReminderOffset[], confirm = false): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [res] = await tx
        .update(viewings)
        .set({ startsAt: to, rescheduledFrom: from, status: confirm ? 'rescheduled' : sql`if(${viewings.status} = 'pending', 'pending', 'rescheduled')` })
        // The advisor's answer moves only a request still waiting, so two answers cannot both win.
        .where(and(eq(viewings.id, id), confirm ? eq(viewings.status, 'pending') : inArray(viewings.status, ['confirmed', 'rescheduled', 'pending'])));
      if (res.affectedRows !== 1) return false;
      const keep = reminders ?? (await tx.select({ offset: viewingReminders.offset }).from(viewingReminders).where(eq(viewingReminders.viewingId, id))).map((r) => r.offset);
      await this.setReminders(tx, id, keep, to);
      await tx
        .update(leads)
        .set({ lastActivityAt: sql`now(3)` })
        .where(sql`(${leads.clientId}, ${leads.agentId}) = (select client_id, agent_id from viewings where id = ${id})`);
      return true;
    });
  }

  /**
   * Cancels only while the viewing is still active (or, for the advisor declining a request, still
   * waiting); false when another change got there first.
   */
  async cancel(id: number, by: ViewingCanceller, onlyPending = false): Promise<boolean> {
    const [res] = await this.db
      .update(viewings)
      .set({ status: 'cancelled', cancelledBy: by })
      .where(and(eq(viewings.id, id), inArray(viewings.status, onlyPending ? ['pending'] : ['confirmed', 'rescheduled', 'pending'])));
    return res.affectedRows === 1;
  }

  /** The advisor accepts a request (2026-11-14); false when it is no longer waiting. */
  async confirm(id: number): Promise<boolean> {
    const [res] = await this.db
      .update(viewings)
      .set({ status: 'confirmed' })
      .where(and(eq(viewings.id, id), eq(viewings.status, 'pending')));
    return res.affectedRows === 1;
  }

  /** Saves the choices. Those already due are stamped as sent, so they are never sent (see `alreadyDue`). */
  private async setReminders(tx: Tx, id: number, reminders: ReminderOffset[], startsAt: Date): Promise<void> {
    await tx.delete(viewingReminders).where(eq(viewingReminders.viewingId, id));
    const unique = [...new Set(reminders)];
    const now = new Date();
    const past = new Set(alreadyDue(startsAt, unique, now));
    if (unique.length) await tx.insert(viewingReminders).values(unique.map((offset) => ({ viewingId: id, offset, sentAt: past.has(offset) ? now : null, claimedAt: past.has(offset) ? now : null })));
  }

  /**
   * Unsent reminders of live viewings that have not started and are close enough for one to be due.
   * A reminder claimed more than a lease ago is still unsent: its run died, so it is retried.
   */
  pendingReminders(now: Date): Promise<PendingReminder[]> {
    return this.db
      .select({ viewingId: viewingReminders.viewingId, offset: viewingReminders.offset, startsAt: viewings.startsAt })
      .from(viewingReminders)
      .innerJoin(viewings, eq(viewings.id, viewingReminders.viewingId))
      .where(
        and(
          isNull(viewingReminders.sentAt),
          isNotNull(viewings.active),
          // Not before the advisor confirms a request.
          ne(viewings.status, 'pending'),
          gt(viewings.startsAt, now),
          lte(viewings.startsAt, new Date(now.getTime() + LONGEST_REMINDER_MS)),
          or(isNull(viewingReminders.claimedAt), lt(viewingReminders.claimedAt, new Date(now.getTime() - LEASE_MS))),
        ),
      );
  }

  /**
   * Takes the lease on unsent reminders that nobody holds (or whose lease ran out, so a crashed
   * run's are retried). True when this call took any: the caller then sends them. The row lock
   * makes the check and the stamp one step, so two servers running at once cannot both win.
   */
  async claimReminders(viewingId: number, offsets: ReminderOffset[], now: Date): Promise<boolean> {
    const [res] = await this.db
      .update(viewingReminders)
      .set({ claimedAt: now })
      .where(
        and(
          eq(viewingReminders.viewingId, viewingId),
          inArray(viewingReminders.offset, offsets),
          isNull(viewingReminders.sentAt),
          or(isNull(viewingReminders.claimedAt), lt(viewingReminders.claimedAt, new Date(now.getTime() - LEASE_MS))),
        ),
      );
    return res.affectedRows > 0;
  }

  /** Stamps delivery, which is the only thing that stops a reminder from being retried. */
  async markRemindersSent(viewingId: number, offsets: ReminderOffset[]): Promise<void> {
    await this.db
      .update(viewingReminders)
      .set({ sentAt: sql`now(3)` })
      .where(and(eq(viewingReminders.viewingId, viewingId), inArray(viewingReminders.offset, offsets), isNull(viewingReminders.sentAt)));
  }

  /** The client's lead with this agent (booking creates it). */
  async leadIdOf(clientId: number, agentId: number): Promise<number | undefined> {
    const [row] = await this.db.select({ id: leads.id }).from(leads).where(and(eq(leads.clientId, clientId), eq(leads.agentId, agentId)));
    return row?.id;
  }

  async findById(id: number): Promise<ViewingRow | undefined> {
    const [row] = await this.db.select().from(viewings).where(eq(viewings.id, id));
    return row;
  }

  /** A client's viewings, or an agent's, soonest first. */
  /**
   * Every viewing for the admin (phase 23): upcoming soonest first or past latest first, by status,
   * advisor, a Cairo day range (as UTC instants) and words in the client or the home.
   */
  async adminList(q: { when: 'upcoming' | 'past'; status?: ViewingRow['status']; agentId?: number; from?: Date; to?: Date; q?: string; page: number; limit: number }) {
    const now = new Date();
    const words = q.q ? `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : undefined;
    const where = and(
      q.when === 'upcoming' ? gt(viewings.startsAt, now) : lte(viewings.startsAt, now),
      q.status ? eq(viewings.status, q.status) : undefined,
      q.agentId ? eq(viewings.agentId, q.agentId) : undefined,
      q.from ? gte(viewings.startsAt, q.from) : undefined,
      q.to ? lt(viewings.startsAt, q.to) : undefined,
      words ? or(like(users.name, words), like(users.phone, words), like(users.email, words), like(properties.titleAr, words), like(properties.titleEn, words)) : undefined,
    );
    const base = () =>
      this.db
        .select({
          v: viewings,
          property: { id: properties.id, titleAr: properties.titleAr, titleEn: properties.titleEn },
          agent: { id: agents.userId, nameAr: agents.nameAr, nameEn: agents.nameEn, colour: agents.colour },
          client: { id: users.id, name: users.name, phone: users.phone, email: users.email, deletedAt: users.deletedAt },
        })
        .from(viewings)
        .innerJoin(properties, eq(properties.id, viewings.propertyId))
        .innerJoin(agents, eq(agents.userId, viewings.agentId))
        .innerJoin(users, eq(users.id, viewings.clientId));
    const order = q.when === 'upcoming' ? [asc(viewings.startsAt), asc(viewings.id)] : [desc(viewings.startsAt), desc(viewings.id)];
    const [rows, [{ total }]] = await Promise.all([
      base()
        .where(where)
        .orderBy(...order)
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.db
        .select({ total: count() })
        .from(viewings)
        .innerJoin(properties, eq(properties.id, viewings.propertyId))
        .innerJoin(users, eq(users.id, viewings.clientId))
        .where(where),
    ]);
    return { rows, total: Number(total) };
  }

  /** One viewing as the admin list shows it. */
  async adminOne(id: number) {
    const [row] = await this.db
      .select({
        v: viewings,
        property: { id: properties.id, titleAr: properties.titleAr, titleEn: properties.titleEn },
        agent: { id: agents.userId, nameAr: agents.nameAr, nameEn: agents.nameEn, colour: agents.colour },
        client: { id: users.id, name: users.name, phone: users.phone, email: users.email, deletedAt: users.deletedAt },
      })
      .from(viewings)
      .innerJoin(properties, eq(properties.id, viewings.propertyId))
      .innerJoin(agents, eq(agents.userId, viewings.agentId))
      .innerJoin(users, eq(users.id, viewings.clientId))
      .where(eq(viewings.id, id));
    return row;
  }

  list(by: { clientId: number } | { agentId: number }): Promise<ViewingRow[]> {
    const where = 'clientId' in by ? eq(viewings.clientId, by.clientId) : eq(viewings.agentId, by.agentId);
    return this.db.select().from(viewings).where(where).orderBy(asc(viewings.startsAt), asc(viewings.id));
  }

  async remindersOf(ids: number[]): Promise<Map<number, ReminderOffset[]>> {
    const out = new Map<number, ReminderOffset[]>();
    if (!ids.length) return out;
    const rows = await this.db.select().from(viewingReminders).where(inArray(viewingReminders.viewingId, ids));
    const order = { '1d': 0, '2h': 1, '30m': 2 } as const;
    for (const r of rows.sort((a, b) => order[a.offset] - order[b.offset])) out.set(r.viewingId, [...(out.get(r.viewingId) ?? []), r.offset]);
    return out;
  }

  async clients(ids: number[]): Promise<Map<number, { name: string; phone: string | null }>> {
    if (!ids.length) return new Map();
    const rows = await this.db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(inArray(users.id, ids));
    return new Map(rows.map((r) => [r.id, { name: r.name, phone: r.phone }]));
  }
}
