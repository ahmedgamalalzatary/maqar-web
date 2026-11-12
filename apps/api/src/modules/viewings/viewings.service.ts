import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  type AdminViewingItem,
  type AdminViewingsPage,
  BOOKING_DAYS,
  type BookViewingBody,
  fmtDate,
  fmtTime,
  type Lang,
  type ListingAgent,
  type SlotsResponse,
  type UpdateViewingBody,
  VIEWING_MINUTES,
  type ViewingItem,
  type ViewingCanceller,
} from '@maqar/shared';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ListingCounter } from '../insights/insights.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { dueBatches } from './reminders.js';
import { buildSlotDays, cairoClock, cairoInstant, defaultDate, slotKey, slotStateOf } from './slots.js';
import { isDuplicate, ViewingsRepository } from './viewings.repository.js';
import type { ViewingRow } from './viewings.schema.js';
import type { AdminViewingsQueryDto, AdminViewingUpdateDto } from './dto/viewings.dto.js';

const DAY_MS = 86_400_000;
const TAKEN = 'That time was just booked. Please pick another.';
const ALREADY_BOOKING = 'You already have a viewing for this home. Reschedule it instead.';

/**
 * The right conflict for a refused booking: the one-active-viewing-per-home key says the client
 * already has this home, the agent-hour key says the hour went to someone else.
 */
export function conflictOf(err: unknown): ConflictException | undefined {
  if (!isDuplicate(err)) return undefined;
  const key = String((err as { message?: string }).message ?? '');
  return new ConflictException(key.includes('viewings_client_property_active_unique') ? ALREADY_BOOKING : TAKEN);
}

/** Viewing booking and My viewings (contract §8.7, §8.8). Clients book; agents see theirs. */
@Injectable()
export class ViewingsService {
  constructor(
    private readonly repo: ViewingsRepository,
    private readonly properties: PropertiesService,
    private readonly users: UsersRepository,
    private readonly notifications: NotificationsService,
    private readonly counter: ListingCounter,
  ) {}

  /**
   * The next 14 days with the agent's hours. `except` is the viewing being moved: its hour shows
   * free. Rescheduling a viewing uses that viewing's own agent, so the hours shown and the hours
   * validated belong to the same advisor even after the listing moved to someone else.
   */
  async slots(propertyId: number, except?: number, forReschedule = false): Promise<SlotsResponse> {
    if (forReschedule && except) {
      const v = await this.repo.findById(except);
      if (v) return this.slotsFor(v.agentId, except);
    }
    const home = await this.properties.bookingTarget(propertyId);
    return this.slotsFor(home.agent.id, except);
  }

  /** The next 14 days with one specific agent's hours (a thread's own advisor, not the listing's). */
  async slotsOfAgent(agentId: number): Promise<SlotsResponse> {
    return this.slotsFor(agentId);
  }

  /** The agent's weekly hours and days off around `date` (the chat's out-of-hours reply uses them). */
  agentSchedule(agentId: number, date: string) {
    return this.repo.schedule(agentId, date, date);
  }

  private async slotsFor(agentId: number, except?: number): Promise<SlotsResponse> {
    const now = cairoClock(new Date());
    const last = cairoClock(new Date(Date.now() + (BOOKING_DAYS + 1) * DAY_MS)).date;
    const [{ hours, daysOff }, taken] = await Promise.all([
      this.repo.schedule(agentId, now.date, last),
      this.repo.takenTimes(agentId, cairoInstant(now.date, '00:00'), cairoInstant(last, '00:00'), except),
    ]);
    const keys = new Set(taken.map((t) => slotKey(cairoClock(t).date, `${String(cairoClock(t).hour).padStart(2, '0')}:00`)));
    const days = buildSlotDays({ today: now.date, nowHour: now.hour, hours, daysOff, taken: keys });
    return { days, defaultDate: defaultDate(days, now.hour) };
  }

  /** The hour must be free now; the database's unique key settles two bookings at the same moment. */
  private async assertFree(agentId: number, date: string, time: string, except?: number): Promise<void> {
    const { days } = await this.slotsFor(agentId, except);
    const state = slotStateOf(days, date, time);
    if (state === undefined) throw new BadRequestException('That day or hour cannot be booked');
    if (state !== 'free') throw new ConflictException(state === 'taken' ? TAKEN : `That time is ${state}`);
  }

  /**
   * Books with the listing's advisor, or — from a conversation that kept its own advisor after the
   * listing moved — with the agent the client is actually talking to (`agentId`).
   */
  async book(user: AuthUser, body: BookViewingBody, agentId?: number): Promise<ViewingItem> {
    const home = await this.properties.bookingTarget(body.propertyId);
    if (home.category === 'stay') throw new BadRequestException('Stays are not booked as viewings');
    if (await this.repo.activeFor(user.id, home.id)) {
      throw new ConflictException(ALREADY_BOOKING);
    }
    const withAgent = agentId ?? home.agent.id;
    await this.assertFree(withAgent, body.date, body.time);
    let id: number;
    try {
      id = await this.repo.book({
        propertyId: home.id,
        clientId: user.id,
        agentId: withAgent,
        startsAt: cairoInstant(body.date, body.time),
        reminders: body.reminders,
      });
    } catch (err) {
      const conflict = conflictOf(err);
      if (conflict) throw conflict;
      throw err;
    }
    const item = await this.item(id);
    await this.counter.interest(home.id, user.id, 'booked');
    await this.tell(item, 'booked');
    return item;
  }

  /** A client's own viewings, or an agent's, soonest first. */
  async list(user: AuthUser): Promise<ViewingItem[]> {
    const rows = await this.repo.list(user.role === 'agent' ? { agentId: user.id } : { clientId: user.id });
    return this.items(rows, user.role === 'agent');
  }

  async update(user: AuthUser, id: number, body: UpdateViewingBody): Promise<ViewingItem> {
    return this.change(await this.ownViewing(user, id), body, undefined, user.role === 'agent' ? 'agent' : 'client');
  }

  /**
   * Every viewing for the admin (phase 23), with the client, the home and the advisor. `from` and
   * `to` are Cairo days, both included.
   */
  async adminList(q: AdminViewingsQueryDto): Promise<AdminViewingsPage> {
    const { rows, total } = await this.repo.adminList({
      ...q,
      from: q.from ? cairoInstant(q.from, '00:00') : undefined,
      to: q.to ? new Date(cairoInstant(q.to, '00:00').getTime() + DAY_MS) : undefined,
    });
    return { items: rows.map(adminItem), page: q.page, limit: q.limit, total };
  }

  /** The admin moves a viewing to a free hour of the same advisor, or cancels it; the reason is told to both sides. */
  async adminUpdate(id: number, body: AdminViewingUpdateDto): Promise<AdminViewingItem> {
    const v = await this.repo.findById(id);
    if (!v) throw new NotFoundException('Viewing not found');
    await this.change(v, body.action === 'cancel' ? { action: 'cancel' } : { action: 'reschedule', date: body.date!, time: body.time! }, body.reason, 'admin');
    return adminItem((await this.repo.adminOne(id))!);
  }

  /** Cancel or reschedule one active, future viewing; `note` (an admin's reason) goes in the notices. */
  private async change(v: ViewingRow, body: UpdateViewingBody, note: string | undefined, by: ViewingCanceller): Promise<ViewingItem> {
    const id = v.id;
    if (v.status !== 'confirmed' && v.status !== 'rescheduled') throw new ConflictException('This viewing is not active any more');
    if (v.startsAt.getTime() <= Date.now()) throw new ConflictException('This viewing has already started');
    if (body.action === 'cancel') {
      // The write itself carries the expected state, so a cancel racing a reschedule has one winner.
      if (!(await this.repo.cancel(id, by))) throw new ConflictException('This viewing is not active any more');
      const item = await this.item(id);
      await this.tell(item, 'cancelled', true, note);
      return item;
    }
    const at = cairoInstant(body.date, body.time);
    if (at.getTime() === v.startsAt.getTime()) throw new BadRequestException('That is the time it already has');
    await this.assertFree(v.agentId, body.date, body.time, id);
    try {
      if (!(await this.repo.reschedule(id, v.startsAt, at, 'reminders' in body ? body.reminders : undefined))) throw new ConflictException('This viewing is not active any more');
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      if (isDuplicate(err)) throw new ConflictException(TAKEN);
      throw err;
    }
    const item = await this.item(id);
    await this.tell(item, 'rescheduled', true, note);
    return item;
  }

  /**
   * Cancels a client's upcoming viewings when an admin suspends the account (phase 22), so the
   * advisors' hours are free again. Only the advisors are told: the client is being signed out.
   * Call it before the suspension, while the client's name can still be read. Returns how many.
   */
  async cancelUpcomingOf(clientId: number): Promise<number> {
    const now = Date.now();
    const upcoming = (await this.repo.list({ clientId })).filter((v) => (v.status === 'confirmed' || v.status === 'rescheduled') && v.startsAt.getTime() > now);
    let cancelled = 0;
    for (const v of upcoming) {
      if (!(await this.repo.cancel(v.id, 'admin'))) continue;
      cancelled++;
      await this.tell(await this.item(v.id), 'cancelled', false);
    }
    return cancelled;
  }

  /** Past confirmed/rescheduled viewings become completed, so the client can book the home again. */
  async completePastViewings(): Promise<number> {
    return this.repo.completePastViewings();
  }

  /** The client's live viewing of this home, for idempotent retries of a booking. */
  async activeOf(clientId: number, propertyId: number): Promise<ViewingItem | undefined> {
    const row = await this.repo.activeFor(clientId, propertyId);
    const [item] = row ? await this.items([row], false) : [];
    return item;
  }

  /**
   * Sends the reminders that are due (contract §8.7): one message per viewing, to the client, opening
   * My viewings. Each reminder is claimed before it is sent, so it goes out once even with two servers.
   * Returns how many messages went out.
   */
  async sendDueReminders(now = new Date()): Promise<number> {
    let sent = 0;
    for (const { viewingId, offsets } of dueBatches(await this.repo.pendingReminders(now), now)) {
      if (!(await this.repo.claimReminders(viewingId, offsets, now))) continue;
      const row = await this.repo.findById(viewingId);
      const [v] = row ? await this.items([row], false) : [];
      if (!row || !v) continue;
      const when = (lang: Lang) => `${fmtDate(v.date, lang, 'long')} ${lang === 'ar' ? 'الساعة' : 'at'} ${fmtTime(v.time, lang)}`;
      try {
        await this.notifications.notify(row.clientId, {
          kind: 'reminder',
          titleAr: 'تذكير بمعاينتك',
          titleEn: 'Viewing reminder',
          bodyAr: `${v.property.titleAr} | ${when('ar')} مع ${v.agent.nameAr}`,
          bodyEn: `${v.property.titleEn} | ${when('en')} with ${v.agent.nameEn}`,
          href: '/viewings',
        });
        // Only delivery stops the reminder; a failure (or a crash before this line) is retried.
        await this.repo.markRemindersSent(viewingId, offsets);
      } catch (err) {
        new Logger('Reminders').warn(`Reminder to viewing ${viewingId} failed: ${(err as Error).message}`);
      }
      sent++;
    }
    return sent;
  }

  /** The `.ics` calendar file: a 45-minute event with an alarm 2 hours before (contract §8.7). */
  async ics(user: AuthUser, id: number): Promise<string> {
    const v = await this.ownViewing(user, id, true);
    const [item] = await this.items([v], false);
    const me = await this.users.findActiveById(user.id);
    return icsFor(item!, me?.lang ?? 'ar');
  }

  /** The client's own viewing, or (when `agentToo`) one the agent meets. Anyone else gets 404. */
  private async ownViewing(user: AuthUser, id: number, agentToo = false): Promise<ViewingRow> {
    const v = await this.repo.findById(id);
    const mine = v && (v.clientId === user.id || (agentToo && user.role === 'agent' && v.agentId === user.id));
    if (!v || !mine) throw new NotFoundException('Viewing not found');
    return v;
  }

  private async item(id: number): Promise<ViewingItem> {
    const [item] = await this.items([(await this.repo.findById(id))!], false);
    return item!;
  }

  private async items(rows: ViewingRow[], forAgent: boolean): Promise<ViewingItem[]> {
    const [cards, agents, reminders, clients] = await Promise.all([
      this.properties.cardsById(rows.map((r) => r.propertyId)),
      this.properties.agentsById(rows.map((r) => r.agentId)),
      this.repo.remindersOf(rows.map((r) => r.id)),
      forAgent ? this.repo.clients(rows.map((r) => r.clientId)) : undefined,
    ]);
    return rows.flatMap((r) => {
      const found = cards.get(r.propertyId);
      const agent = agents.get(r.agentId);
      if (!found || !agent) return [];
      const { location, ...property } = found;
      const at = cairoClock(r.startsAt);
      const was = r.rescheduledFrom ? cairoClock(r.rescheduledFrom) : null;
      return {
        id: r.id,
        status: r.status,
        mode: r.mode,
        date: at.date,
        time: hourText(at.hour),
        startsAt: r.startsAt.toISOString(),
        rescheduledFrom: was ? { date: was.date, time: hourText(was.hour) } : null,
        reminders: reminders.get(r.id) ?? [],
        property,
        location,
        agent,
        client: clients?.get(r.clientId) ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  /** The client and the agent each hear about a booking, a new time and a cancellation (contract §8.7). */
  private async tell(v: ViewingItem, what: 'booked' | 'rescheduled' | 'cancelled', clientToo = true, note?: string): Promise<void> {
    const row = (await this.repo.findById(v.id))!;
    const client = await this.users.findActiveById(row.clientId);
    const leadId = await this.repo.leadIdOf(row.clientId, row.agentId);
    const when = (lang: Lang) => `${fmtDate(v.date, lang, 'long')} ${lang === 'ar' ? 'الساعة' : 'at'} ${fmtTime(v.time, lang)}`;
    const agentName = (a: ListingAgent, lang: Lang) => (lang === 'ar' ? a.nameAr : a.nameEn);
    const home = (lang: Lang) => (lang === 'ar' ? v.property.titleAr : v.property.titleEn);
    const forClient = {
      booked: ['تم تأكيد المعاينة', 'Viewing confirmed', `${when('ar')} مع ${agentName(v.agent, 'ar')}`, `${when('en')} with ${agentName(v.agent, 'en')}`],
      rescheduled: ['تم تغيير الموعد', 'Viewing rescheduled', `${when('ar')} مع ${agentName(v.agent, 'ar')}`, `${when('en')} with ${agentName(v.agent, 'en')}`],
      cancelled: ['تم إلغاء المعاينة', 'Viewing cancelled', 'تقدر تحجز ميعاد تاني في أي وقت.', 'You can book another time whenever you like.'],
    }[what];
    const who = client?.name ?? '';
    const forAgent = {
      booked: ['حجز جديد من التطبيق', 'New booking from the app'],
      rescheduled: ['معاينة اتغير ميعادها', 'A viewing was moved'],
      cancelled: ['معاينة اتلغت', 'A viewing was cancelled'],
    }[what];
    // An admin's reason, under the usual line.
    const withNote = (text: string, lang: Lang) => (note ? `${text}
${lang === 'ar' ? 'من مقر' : 'From Maqar'}: ${note}` : text);
    forClient[2] = withNote(forClient[2]!, 'ar');
    forClient[3] = withNote(forClient[3]!, 'en');
    await Promise.all([
      clientToo
        ? this.notifications.notify(row.clientId, {
            kind: 'booking',
            titleAr: forClient[0]!,
            titleEn: forClient[1]!,
            bodyAr: forClient[2]!,
            bodyEn: forClient[3]!,
            href: '/viewings',
          })
        : null,
      this.notifications.notify(row.agentId, {
        kind: 'lead',
        titleAr: forAgent[0]!,
        titleEn: forAgent[1]!,
        bodyAr: withNote(`${who} | ${home('ar')} | ${when('ar')}`, 'ar'),
        bodyEn: withNote(`${who} | ${home('en')} | ${when('en')}`, 'en'),
        // The lead page: it shows the viewing, the client and "New from app".
        href: leadId ? `/agent/lead/${leadId}` : '/agent',
      }),
    ]);
  }
}

const hourText = (h: number) => `${String(h).padStart(2, '0')}:00`;

type AdminRow = NonNullable<Awaited<ReturnType<ViewingsRepository['adminOne']>>>;

function adminItem({ v, property, agent, client }: AdminRow): AdminViewingItem {
  const at = cairoClock(v.startsAt);
  const was = v.rescheduledFrom ? cairoClock(v.rescheduledFrom) : null;
  return {
    id: v.id,
    status: v.status,
    date: at.date,
    time: hourText(at.hour),
    startsAt: v.startsAt.toISOString(),
    rescheduledFrom: was ? { date: was.date, time: hourText(was.hour) } : null,
    property,
    agent,
    client: client.deletedAt ? null : { id: client.id, name: client.name, phone: client.phone, email: client.email },
    createdAt: v.createdAt.toISOString(),
  };
}

/** Commas, semicolons, backslashes and line breaks are escaped in iCalendar text. */
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function icsFor(v: ViewingItem, lang: Lang): string {
  const ar = lang === 'ar';
  const start = new Date(v.startsAt);
  const end = new Date(start.getTime() + VIEWING_MINUTES * 60_000);
  const p = v.property;
  const title = `${ar ? 'معاينة' : 'Viewing'}: ${ar ? p.titleAr : p.titleEn}`;
  const place = `${ar ? p.compoundAr : p.compoundEn}, ${ar ? p.area.nameAr : p.area.nameEn}`;
  const who = `${ar ? 'مسؤول المبيعات' : 'Sales advisor'}: ${ar ? v.agent.nameAr : v.agent.nameEn} ${v.agent.phone}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maqar//Viewings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:viewing-${v.id}@maqar.app`,
    `DTSTAMP:${icsTime(new Date())}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(title)}`,
    `LOCATION:${icsText(place)}`,
    `DESCRIPTION:${icsText(who)}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsText(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
