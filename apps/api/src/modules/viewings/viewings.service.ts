import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
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
} from '@maqar/shared';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PropertiesService } from '../properties/properties.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { buildSlotDays, cairoClock, cairoInstant, defaultDate, slotKey, slotStateOf } from './slots.js';
import { isDuplicate, ViewingsRepository } from './viewings.repository.js';
import type { ViewingRow } from './viewings.schema.js';

const DAY_MS = 86_400_000;
const TAKEN = 'That time was just booked. Please pick another.';

/** Viewing booking and My viewings (contract §8.7, §8.8). Clients book; agents see theirs. */
@Injectable()
export class ViewingsService {
  constructor(
    private readonly repo: ViewingsRepository,
    private readonly properties: PropertiesService,
    private readonly users: UsersRepository,
    private readonly notifications: NotificationsService,
  ) {}

  /** The next 14 days with the agent's hours. `except` is the viewing being moved: its hour shows free. */
  async slots(propertyId: number, except?: number): Promise<SlotsResponse> {
    const home = await this.properties.bookingTarget(propertyId);
    return this.slotsFor(home.agent.id, except);
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

  async book(user: AuthUser, body: BookViewingBody): Promise<ViewingItem> {
    const home = await this.properties.bookingTarget(body.propertyId);
    if (home.category === 'stay') throw new BadRequestException('Stays are not booked as viewings');
    if (await this.repo.activeFor(user.id, home.id)) {
      throw new ConflictException('You already have a viewing for this home. Reschedule it instead.');
    }
    await this.assertFree(home.agent.id, body.date, body.time);
    let id: number;
    try {
      id = await this.repo.book({
        propertyId: home.id,
        clientId: user.id,
        agentId: home.agent.id,
        startsAt: cairoInstant(body.date, body.time),
        reminders: body.reminders,
      });
    } catch (err) {
      if (isDuplicate(err)) throw new ConflictException(TAKEN);
      throw err;
    }
    const item = await this.item(id);
    await this.tell(item, 'booked');
    return item;
  }

  /** A client's own viewings, or an agent's, soonest first. */
  async list(user: AuthUser): Promise<ViewingItem[]> {
    const rows = await this.repo.list(user.role === 'agent' ? { agentId: user.id } : { clientId: user.id });
    return this.items(rows, user.role === 'agent');
  }

  async update(user: AuthUser, id: number, body: UpdateViewingBody): Promise<ViewingItem> {
    const v = await this.ownViewing(user, id);
    if (v.status !== 'confirmed' && v.status !== 'rescheduled') throw new ConflictException('This viewing is not active any more');
    if (v.startsAt.getTime() <= Date.now()) throw new ConflictException('This viewing has already started');
    if (body.action === 'cancel') {
      await this.repo.cancel(id);
      const item = await this.item(id);
      await this.tell(item, 'cancelled');
      return item;
    }
    const at = cairoInstant(body.date, body.time);
    if (at.getTime() === v.startsAt.getTime()) throw new BadRequestException('That is the time it already has');
    await this.assertFree(v.agentId, body.date, body.time, id);
    try {
      await this.repo.reschedule(id, v.startsAt, at, body.reminders);
    } catch (err) {
      if (isDuplicate(err)) throw new ConflictException(TAKEN);
      throw err;
    }
    const item = await this.item(id);
    await this.tell(item, 'rescheduled');
    return item;
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
  private async tell(v: ViewingItem, what: 'booked' | 'rescheduled' | 'cancelled'): Promise<void> {
    const row = (await this.repo.findById(v.id))!;
    const client = await this.users.findActiveById(row.clientId);
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
    await Promise.all([
      this.notifications.notify(row.clientId, {
        kind: 'booking',
        titleAr: forClient[0]!,
        titleEn: forClient[1]!,
        bodyAr: forClient[2]!,
        bodyEn: forClient[3]!,
        href: '/viewings',
      }),
      this.notifications.notify(row.agentId, {
        kind: 'lead',
        titleAr: forAgent[0]!,
        titleEn: forAgent[1]!,
        bodyAr: `${who} | ${home('ar')} | ${when('ar')}`,
        bodyEn: `${who} | ${home('en')} | ${when('en')}`,
        href: '/agent',
      }),
    ]);
  }
}

const hourText = (h: number) => `${String(h).padStart(2, '0')}:00`;

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
