import type { Bi, ReportResult } from '@maqar/shared';
import type { ListingFact } from './reports.repository.js';
import type { Filters, Win } from './reports.util.js';

/** What every report builder gets: the range, the previous period (ranged reports), the filters and now. */
export type Ctx = { cur: Win; prev: Win | null; f: Filters; now: Date };

/** What a builder returns; the service adds the id, the range and the time. */
export type Built = Pick<ReportResult, 'kpis' | 'charts' | 'tables' | 'notes'>;

/** The earliest moment a report reads: the start of the previous period, or of the range. */
export const since = (c: Ctx): Date => (c.prev ?? c.cur).from;
export const sinceDay = (c: Ctx): string => (c.prev ?? c.cur).fromDay;

export const bi = (r: { nameAr: string; nameEn: string }): Bi => ({ ar: r.nameAr, en: r.nameEn });
export const titleOf = (l: Pick<ListingFact, 'titleAr' | 'titleEn'>): Bi => ({ ar: l.titleAr, en: l.titleEn });

export const NO_ADVISOR: Bi = { ar: 'من غير مسؤول', en: 'No advisor' };
export const UNKNOWN: Bi = { ar: 'مش معروف', en: 'Unknown' };
