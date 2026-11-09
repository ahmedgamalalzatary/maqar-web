// Viewing slots (contract §8.7): which hours of the next 14 days can be booked with an agent.
// Days and hours are Cairo time; Egypt has summer time, so instants go through @date-fns/tz.

import { TZDate } from '@date-fns/tz';
import { BOOKING_DAYS, type Slot, type SlotDay, type SlotState } from '@maqar/shared';

export const ZONE = 'Africa/Cairo';

/** Bookable hours per weekday (0 = Sunday): the first and last hour a viewing can start, inclusive. */
export type WeekHours = Map<number, { from: number; to: number }>;

/** Every day 10:00–20:00, Friday from 14:00 (contract §8.7). Used for an agent with no hours set. */
export const DEFAULT_HOURS: WeekHours = new Map([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { from: d === 5 ? 14 : 10, to: 20 }]));

const pad = (n: number) => String(n).padStart(2, '0');
export const hhmm = (hour: number) => `${pad(hour)}:00`;
/** The key of a booked hour in `taken`: "2026-11-12 16:00". */
export const slotKey = (date: string, time: string) => `${date} ${time}`;

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The Cairo day and hour of an instant. */
export function cairoClock(at: Date): { date: string; hour: number } {
  const c = new TZDate(at, ZONE);
  return { date: `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`, hour: c.getHours() };
}

/** The instant a Cairo day and hour stand for. */
export function cairoInstant(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, Number(time.slice(0, 2)), 0, 0, ZONE).getTime());
}

export type SlotInput = {
  /** Cairo's today and current hour. */
  today: string;
  nowHour: number;
  hours: WeekHours;
  /** The agent's days off and holidays. */
  daysOff: Set<string>;
  /** Hours already booked with the agent (`slotKey`). */
  taken: Set<string>;
};

/**
 * The next 14 days and their hours. A slot is `past` (today, up to the current hour), `closed`
 * (a day off, or outside the agent's hours for that weekday), `taken`, or `free`, in that order.
 * Every day shows the same hours: from the earliest to the latest the agent ever works.
 */
export function buildSlotDays({ today, nowHour, hours, daysOff, taken }: SlotInput): SlotDay[] {
  const all = [...hours.values()];
  const first = all.length ? Math.min(...all.map((h) => h.from)) : 10;
  const last = all.length ? Math.max(...all.map((h) => h.to)) : 20;
  return Array.from({ length: BOOKING_DAYS }, (_, i) => {
    const date = addDays(today, i);
    const open = daysOff.has(date) ? undefined : hours.get(weekday(date));
    const slots: Slot[] = [];
    for (let h = first; h <= last; h++) {
      const time = hhmm(h);
      let state: SlotState = 'free';
      if (date === today && h <= nowHour) state = 'past';
      else if (!open || h < open.from || h > open.to) state = 'closed';
      else if (taken.has(slotKey(date, time))) state = 'taken';
      slots.push({ time, state });
    }
    return { date, slots };
  });
}

/** Today, or tomorrow from 19:00 (contract §8.7), moved on to the first day that has a free hour. */
export function defaultDate(days: SlotDay[], nowHour: number): string {
  const start = nowHour >= 19 ? 1 : 0;
  const free = days.slice(start).find((d) => d.slots.some((s) => s.state === 'free'));
  return (free ?? days[start] ?? days[0]!).date;
}

/** Whether one hour can be booked: the same rules, for a single slot. */
export function slotStateOf(days: SlotDay[], date: string, time: string): SlotState | undefined {
  return days.find((d) => d.date === date)?.slots.find((s) => s.time === time)?.state;
}
