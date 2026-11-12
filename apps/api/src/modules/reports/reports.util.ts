import type { Bi, Category, CellFormat, ReportKpi } from '@maqar/shared';
import { type SQL, and, eq } from 'drizzle-orm';
import { properties } from '../properties/properties.schema.js';
import { cairoClock } from '../viewings/slots.js';

/** A report's range: Cairo days and the UTC instants they cover (`to` is excluded: the start of the next day). */
export type Win = { fromDay: string; toDay: string; days: string[]; from: Date; to: Date };

/** What a report is narrowed by. */
export type Filters = { agentId?: number; areaId?: string; category?: Category };

/** The listing side of the filters, for queries that reach a listing. */
export function listingWhere(f: Filters): SQL | undefined {
  return and(
    f.agentId !== undefined ? eq(properties.agentId, f.agentId) : undefined,
    f.areaId !== undefined ? eq(properties.areaId, f.areaId) : undefined,
    f.category !== undefined ? eq(properties.category, f.category) : undefined,
  );
}

/** Whether a row's listing passes the filters (for rows aggregated in code). */
export const passes = (f: Filters, p: { agentId: number | null; areaId: string; category: Category } | null | undefined): boolean =>
  (f.agentId === undefined && f.areaId === undefined && f.category === undefined) ||
  (!!p && (f.agentId === undefined || p.agentId === f.agentId) && (f.areaId === undefined || p.areaId === f.areaId) && (f.category === undefined || p.category === f.category));

export const within = (t: Date | null | undefined, w: Pick<Win, 'from' | 'to'>): boolean => !!t && t >= w.from && t < w.to;
export const dayWithin = (day: string, w: Pick<Win, 'fromDay' | 'toDay'>): boolean => day >= w.fromDay && day <= w.toDay;

export const n = (v: unknown): number => Number(v ?? 0);

/** a ÷ b, or null when there is nothing to divide by. */
export const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export const average = (values: number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

export const daysBetween = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / 86_400_000;

export const kpi = (key: string, label: Bi, format: CellFormat, value: number | null, previous?: number | null, better?: 'up' | 'down'): ReportKpi => ({
  key,
  label,
  format,
  value,
  ...(previous !== undefined ? { previous } : {}),
  ...(better ? { better } : {}),
});

/** How many of these times fall on each Cairo day of the range; every day is present. */
export function perDay(times: Date[], days: string[]): { date: string; value: number }[] {
  const out = new Map(days.map((d) => [d, 0]));
  for (const t of times) {
    const day = cairoClock(t).date;
    if (out.has(day)) out.set(day, out.get(day)! + 1);
  }
  return days.map((date) => ({ date, value: out.get(date)! }));
}

/** Counts by key, in the order of `keys`. */
export function countBy<K extends string>(keys: readonly K[], values: K[]): Map<K, number> {
  const out = new Map(keys.map((k) => [k, 0]));
  for (const v of values) out.set(v, (out.get(v) ?? 0) + 1);
  return out;
}

/** Price bands per category: what a buyer, a tenant (per month) or a guest (per night) pays. */
export const PRICE_BANDS: Record<Category, { upTo: number; label: Bi }[]> = {
  sale: [
    { upTo: 2_000_000, label: { ar: 'أقل من ٢ مليون', en: 'Under 2M' } },
    { upTo: 5_000_000, label: { ar: '٢–٥ مليون', en: '2–5M' } },
    { upTo: 10_000_000, label: { ar: '٥–١٠ مليون', en: '5–10M' } },
    { upTo: 20_000_000, label: { ar: '١٠–٢٠ مليون', en: '10–20M' } },
    { upTo: Infinity, label: { ar: '٢٠ مليون أو أكتر', en: '20M or more' } },
  ],
  project: [
    { upTo: 2_000_000, label: { ar: 'أقل من ٢ مليون', en: 'Under 2M' } },
    { upTo: 5_000_000, label: { ar: '٢–٥ مليون', en: '2–5M' } },
    { upTo: 10_000_000, label: { ar: '٥–١٠ مليون', en: '5–10M' } },
    { upTo: 20_000_000, label: { ar: '١٠–٢٠ مليون', en: '10–20M' } },
    { upTo: Infinity, label: { ar: '٢٠ مليون أو أكتر', en: '20M or more' } },
  ],
  rent: [
    { upTo: 10_000, label: { ar: 'أقل من ١٠ آلاف في الشهر', en: 'Under 10K a month' } },
    { upTo: 25_000, label: { ar: '١٠–٢٥ ألف في الشهر', en: '10–25K a month' } },
    { upTo: 50_000, label: { ar: '٢٥–٥٠ ألف في الشهر', en: '25–50K a month' } },
    { upTo: Infinity, label: { ar: '٥٠ ألف أو أكتر في الشهر', en: '50K or more a month' } },
  ],
  stay: [
    { upTo: 2_000, label: { ar: 'أقل من ٢٠٠٠ في الليلة', en: 'Under 2,000 a night' } },
    { upTo: 5_000, label: { ar: '٢٠٠٠–٥٠٠٠ في الليلة', en: '2,000–5,000 a night' } },
    { upTo: Infinity, label: { ar: '٥٠٠٠ أو أكتر في الليلة', en: '5,000 or more a night' } },
  ],
};

export const bandOf = (category: Category, price: number): number => PRICE_BANDS[category].findIndex((b) => price < b.upTo);
