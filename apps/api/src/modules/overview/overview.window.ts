import { lastDays } from '@maqar/shared';
import { cairoClock, cairoInstant } from '../viewings/slots.js';

const nextDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/**
 * The overview's range (phase 25): the last `n` Cairo days, today included, as the UTC instants
 * where they start and end (`to` is the start of tomorrow), and the start of this Cairo month.
 */
export function overviewWindow(now: Date, n: number): { days: string[]; from: Date; to: Date; monthStart: Date } {
  const today = cairoClock(now).date;
  const days = lastDays(today, n);
  return {
    days,
    from: cairoInstant(days[0]!, '00:00'),
    to: cairoInstant(nextDay(today), '00:00'),
    monthStart: cairoInstant(`${today.slice(0, 8)}01`, '00:00'),
  };
}

/** How many of these times fall on each Cairo day; every day is present. */
export function bucketByCairoDay(times: Date[], days: string[]): Map<string, number> {
  const out = new Map(days.map((d) => [d, 0]));
  for (const t of times) {
    const day = cairoClock(t).date;
    if (out.has(day)) out.set(day, out.get(day)! + 1);
  }
  return out;
}
