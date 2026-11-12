import { Injectable } from '@nestjs/common';
import { type AdminOverview, LEAD_STAGES, type LeadStage, type OverviewRange, PROPERTY_STATUSES, type PropertyStatus } from '@maqar/shared';
import { OverviewRepository } from './overview.repository.js';
import { bucketByCairoDay, overviewWindow } from './overview.window.js';

/** The admin's overview (phase 25, contract §11): what happened in the last 7, 30 or 90 Cairo days. */
@Injectable()
export class OverviewService {
  constructor(private readonly repo: OverviewRepository) {}

  async get(days: OverviewRange, now = new Date()): Promise<AdminOverview> {
    const w = overviewWindow(now, days);
    const range = { from: w.from, to: w.to };
    const [listings, clients, leads, viewings, chats, agents, times] = await Promise.all([
      this.repo.listings(range),
      this.repo.clients(range),
      this.repo.leads(range),
      this.repo.viewings(range, now),
      this.repo.chats(range),
      this.repo.agents(range, w.monthStart),
      this.repo.createdTimes(range),
    ]);
    const byStatus = Object.fromEntries(PROPERTY_STATUSES.map((s) => [s, 0])) as Record<PropertyStatus, number>;
    for (const r of listings.byStatus) byStatus[r.status] = r.n;
    const byStage = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<LeadStage, number>;
    for (const r of leads.byStage) byStage[r.stage] = r.n;
    const [c, l, v] = [bucketByCairoDay(times.clients, w.days), bucketByCairoDay(times.leads, w.days), bucketByCairoDay(times.viewings, w.days)];
    return {
      days,
      from: w.days[0]!,
      to: w.days.at(-1)!,
      listings: { byStatus, published: listings.published, closed: listings.closed },
      clients,
      leads: { new: Object.values(byStage).reduce((a, b) => a + b, 0), byStage, won: leads.won },
      viewings,
      chats,
      agents,
      daily: w.days.map((date) => ({ date, clients: c.get(date)!, leads: l.get(date)!, viewings: v.get(date)! })),
    };
  }
}
