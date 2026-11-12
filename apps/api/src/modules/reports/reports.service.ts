import { BadRequestException, Injectable } from '@nestjs/common';
import { daysOf, previousRange, rangeDays, type ReportFilter, type ReportId, type ReportResult, reportPresetRange, reportRangeProblem, reportSpec } from '@maqar/shared';
import { cairoClock, cairoInstant } from '../viewings/slots.js';
import type { Built, Ctx } from './reports.context.js';
import type { ReportQueryDto } from './reports.dto.js';
import { ListingReports } from './reports.listings.js';
import { OpsReports } from './reports.ops.js';
import { PeopleReports } from './reports.people.js';
import { SalesReports } from './reports.sales.js';
import type { Filters, Win } from './reports.util.js';

const nextDay = (date: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
};

/** A range of Cairo days as the UTC instants it covers. */
export const windowOf = (fromDay: string, toDay: string): Win => ({
  fromDay,
  toDay,
  days: daysOf(fromDay, toDay),
  from: cairoInstant(fromDay, '00:00'),
  to: cairoInstant(nextDay(toDay), '00:00'),
});

const PROBLEM: Record<'format' | 'order' | 'future' | 'long', string> = {
  format: 'from and to must be real dates, YYYY-MM-DD',
  order: 'from must not be after to',
  future: 'The range cannot end after today (Cairo)',
  long: 'A range covers at most 366 days',
};

const FILTER_NAME: Record<ReportFilter, string> = { agent: 'advisor', area: 'area', category: 'category' };

/** The admin's reports (phase 27): checks the range and the filters, then builds the report. */
@Injectable()
export class ReportsService {
  constructor(
    private readonly sales: SalesReports,
    private readonly listings: ListingReports,
    private readonly people: PeopleReports,
    private readonly ops: OpsReports,
  ) {}

  async get(id: ReportId, q: ReportQueryDto, now = new Date()): Promise<ReportResult> {
    const spec = reportSpec(id);
    const today = cairoClock(now).date;
    if ((q.from === undefined) !== (q.to === undefined)) throw new BadRequestException('Send both from and to, or neither');
    const range = q.from && q.to ? { from: q.from, to: q.to } : reportPresetRange('30d', today);
    if (spec.ranged) {
      const problem = reportRangeProblem(range.from, range.to, today);
      if (problem) throw new BadRequestException(PROBLEM[problem]);
    }
    const asked: [ReportFilter, unknown][] = [
      ['agent', q.agentId],
      ['area', q.areaId],
      ['category', q.category],
    ];
    for (const [filter, value] of asked) {
      if (value !== undefined && !spec.filters.includes(filter)) throw new BadRequestException(`This report cannot be narrowed by ${FILTER_NAME[filter]}`);
    }
    const f: Filters = { agentId: q.agentId, areaId: q.areaId, category: q.category };
    const prev = spec.ranged ? previousRange(range.from, range.to) : null;
    const ctx: Ctx = { cur: windowOf(range.from, range.to), prev: prev ? windowOf(prev.from, prev.to) : null, f, now };
    const built = await this.build(id, ctx);
    return {
      id,
      generatedAt: now.toISOString(),
      range: spec.ranged ? { ...range, days: rangeDays(range.from, range.to) } : null,
      previous: prev,
      ...built,
    };
  }

  private build(id: ReportId, c: Ctx): Promise<Built> {
    switch (id) {
      case 'deals':
        return this.sales.deals(c);
      case 'advisors':
        return this.sales.advisors(c);
      case 'leads':
        return this.sales.leads(c);
      case 'inventory':
        return this.listings.inventory(c);
      case 'listings':
        return this.listings.listings(c);
      case 'prices':
        return this.listings.prices(c);
      case 'quality':
        return this.listings.quality(c);
      case 'clients':
        return this.people.clients(c);
      case 'areas':
        return this.people.areas(c);
      case 'viewings':
        return this.ops.viewings(c);
      case 'chats':
        return this.ops.chats(c);
    }
  }
}
