// Phase 19: listing insights for admins to pass to the owner (contract §11).
import type { Lang } from './enums.js';
import { fmtNum } from './format.js';

/** The chart ranges the screens offer, in days. */
export const INSIGHT_RANGES = [7, 30, 90] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];

/** One Cairo day of a listing: views and saves made that day, and clients interested for the first time. */
export interface ListingDay {
  day: string;
  views: number;
  saves: number;
  interested: number;
}

/** `GET /admin/listings/:id/stats?days=30`. */
export interface ListingStats {
  days: ListingDay[];
  /** All time: views since the listing went up; saves, followers, chats and viewings as they are now. */
  totals: { views: number; saves: number; followers: number; interested: number; chats: number; viewings: number };
}

export const INTEREST_KINDS = ['saved', 'followed', 'chatted', 'booked'] as const;
export type InterestKind = (typeof INTEREST_KINDS)[number];

export const INTEREST_LABEL: Record<InterestKind, { ar: string; en: string }> = {
  saved: { ar: 'حفظه', en: 'Saved' },
  followed: { ar: 'متابع السعر', en: 'Follows the price' },
  chatted: { ar: 'كلّم المسؤول', en: 'Chatted' },
  booked: { ar: 'حجز معاينة', en: 'Booked a viewing' },
};

/** `GET /admin/listings/:id/interested`: a client who saved, followed, chatted about or booked the listing. */
export interface InterestedClient {
  id: number;
  name: string;
  phone: string | null;
  kinds: InterestKind[];
  firstAt: string;
  lastAt: string;
}

const DAY_MS = 86_400_000;

/** The last `n` days ending on `today` (YYYY-MM-DD), oldest first. */
export function lastDays(today: string, n: number): string[] {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const end = Date.UTC(y, m - 1, d);
  return Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

export function rangeTotals(days: ListingDay[]): Omit<ListingDay, 'day'> {
  return days.reduce((t, d) => ({ views: t.views + d.views, saves: t.saves + d.saves, interested: t.interested + d.interested }), { views: 0, saves: 0, interested: 0 });
}

/** A short message with the numbers, for the admin to send the owner. */
export function insightsSummary(s: ListingStats, title: string, lang: Lang): string {
  const r = rangeTotals(s.days);
  const n = (v: number) => fmtNum(v, lang);
  const t = s.totals;
  if (lang === 'ar')
    return [
      `أرقام عقارك على مقر: ${title}`,
      `آخر ${n(s.days.length)} يوم: ${n(r.views)} مشاهدة، ${n(r.saves)} حفظ، ${n(r.interested)} عميل مهتم جديد.`,
      `من أول ما اتنشر: ${n(t.views)} مشاهدة، ${n(t.interested)} عميل مهتم، ${n(t.saves)} حافظينه دلوقتي، ${n(t.chats)} محادثة، ${n(t.viewings)} معاينة.`,
    ].join('\n');
  return [
    `Your listing on Maqar: ${title}`,
    `In the last ${n(s.days.length)} days: ${n(r.views)} views, ${n(r.saves)} saves, ${n(r.interested)} new interested clients.`,
    `Since it went up: ${n(t.views)} views, ${n(t.interested)} interested clients, ${n(t.saves)} saved now, ${n(t.chats)} chats, ${n(t.viewings)} viewings.`,
  ].join('\n');
}
