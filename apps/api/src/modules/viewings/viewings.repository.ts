import { Injectable } from '@nestjs/common';
import type { ReminderOffset } from '@maqar/shared';
import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agentDaysOff, agentHours } from '../agents/agents.schema.js';
import { leads } from '../leads/leads.schema.js';
import { users } from '../users/users.schema.js';
import { alreadyDue, LONGEST_REMINDER_MS, type PendingReminder } from './reminders.js';
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

  /** The client's live viewing of this home, if any. */
  async activeFor(clientId: number, propertyId: number): Promise<ViewingRow | undefined> {
    const [row] = await this.db
      .select()
      .from(viewings)
      .where(and(eq(viewings.clientId, clientId), eq(viewings.propertyId, propertyId), isNotNull(viewings.active)));
    return row;
  }

  /**
   * Books the hour, saves the reminders, and creates the client's lead with the agent or moves it
   * to `viewing` (a lead further on, at negotiation or won, keeps its stage). All or nothing; a
   * duplicate key means the hour was just taken.
   */
  async book(v: { propertyId: number; clientId: number; agentId: number; startsAt: Date; reminders: ReminderOffset[] }): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [{ id }] = await tx
        .insert(viewings)
        .values({ propertyId: v.propertyId, clientId: v.clientId, agentId: v.agentId, startsAt: v.startsAt })
        .$returningId();
      await this.setReminders(tx, id!, v.reminders, v.startsAt);
      await tx
        .insert(leads)
        .values({ clientId: v.clientId, agentId: v.agentId, propertyId: v.propertyId, stage: 'viewing', source: 'app', fromApp: true })
        .onDuplicateKeyUpdate({
          set: {
            stage: sql`if(${leads.stage} in ('new', 'contacted', 'lost'), 'viewing', ${leads.stage})`,
            propertyId: v.propertyId,
            lastActivityAt: sql`now()`,
          },
        });
      return id!;
    });
  }

  /** Moves a live viewing; its reminders (the new choices, or the old ones) count again from the new time. */
  async reschedule(id: number, from: Date, to: Date, reminders?: ReminderOffset[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(viewings).set({ startsAt: to, rescheduledFrom: from, status: 'rescheduled' }).where(eq(viewings.id, id));
      const keep = reminders ?? (await tx.select({ offset: viewingReminders.offset }).from(viewingReminders).where(eq(viewingReminders.viewingId, id))).map((r) => r.offset);
      await this.setReminders(tx, id, keep, to);
      await tx
        .update(leads)
        .set({ lastActivityAt: sql`now()` })
        .where(sql`(${leads.clientId}, ${leads.agentId}) = (select client_id, agent_id from viewings where id = ${id})`);
    });
  }

  async cancel(id: number): Promise<void> {
    await this.db.update(viewings).set({ status: 'cancelled' }).where(eq(viewings.id, id));
  }

  /** Saves the choices. Those already due are stamped as sent, so they are never sent (see `alreadyDue`). */
  private async setReminders(tx: Tx, id: number, reminders: ReminderOffset[], startsAt: Date): Promise<void> {
    await tx.delete(viewingReminders).where(eq(viewingReminders.viewingId, id));
    const unique = [...new Set(reminders)];
    const now = new Date();
    const past = new Set(alreadyDue(startsAt, unique, now));
    if (unique.length) await tx.insert(viewingReminders).values(unique.map((offset) => ({ viewingId: id, offset, sentAt: past.has(offset) ? now : null })));
  }

  /** Unsent reminders of live viewings that have not started and are close enough for one to be due. */
  pendingReminders(now: Date): Promise<PendingReminder[]> {
    return this.db
      .select({ viewingId: viewingReminders.viewingId, offset: viewingReminders.offset, startsAt: viewings.startsAt })
      .from(viewingReminders)
      .innerJoin(viewings, eq(viewings.id, viewingReminders.viewingId))
      .where(
        and(
          isNull(viewingReminders.sentAt),
          isNotNull(viewings.active),
          gt(viewings.startsAt, now),
          lte(viewings.startsAt, new Date(now.getTime() + LONGEST_REMINDER_MS)),
        ),
      );
  }

  /**
   * Stamps these reminders as sent, if they still are not. True when this call stamped any: the
   * caller then sends them. Two servers running the job at once cannot both win the same row.
   */
  async claimReminders(viewingId: number, offsets: ReminderOffset[], now: Date): Promise<boolean> {
    const [res] = await this.db
      .update(viewingReminders)
      .set({ sentAt: now })
      .where(and(eq(viewingReminders.viewingId, viewingId), inArray(viewingReminders.offset, offsets), isNull(viewingReminders.sentAt)));
    return res.affectedRows > 0;
  }

  async findById(id: number): Promise<ViewingRow | undefined> {
    const [row] = await this.db.select().from(viewings).where(eq(viewings.id, id));
    return row;
  }

  /** A client's viewings, or an agent's, soonest first. */
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
