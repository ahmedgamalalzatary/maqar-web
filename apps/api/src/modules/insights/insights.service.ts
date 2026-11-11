import { Injectable, NotFoundException } from '@nestjs/common';
import { INTEREST_KINDS, type InterestedClient, lastDays, type ListingStats } from '@maqar/shared';
import { cairoClock } from '../viewings/slots.js';
import { type InterestRow, InsightsRepository } from './insights.repository.js';

const today = () => cairoClock(new Date()).date;

/** Records what clients do on a listing, for its insights. Used by the property page and saves. */
@Injectable()
export class ListingCounter {
  constructor(private readonly repo: InsightsRepository) {}

  view(propertyId: number): Promise<void> {
    return this.repo.bump(propertyId, today(), 'views');
  }

  save(propertyId: number): Promise<void> {
    return this.repo.bump(propertyId, today(), 'saves');
  }
}

/** Listing insights for admins (contract §11): the numbers to pass to the owner. */
@Injectable()
export class InsightsService {
  constructor(private readonly repo: InsightsRepository) {}

  async stats(propertyId: number, range: number): Promise<ListingStats> {
    await this.assertListing(propertyId);
    const days = lastDays(today(), range);
    const [rows, totals, interested] = await Promise.all([this.repo.days(propertyId, days[0]!, days[days.length - 1]!), this.repo.totals(propertyId), this.clients(propertyId)]);
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const firstDays = new Map<string, number>();
    for (const c of interested) {
      const d = cairoClock(new Date(c.firstAt)).date;
      firstDays.set(d, (firstDays.get(d) ?? 0) + 1);
    }
    return {
      days: days.map((day) => ({ day, views: byDay.get(day)?.views ?? 0, saves: byDay.get(day)?.saves ?? 0, interested: firstDays.get(day) ?? 0 })),
      totals: { ...totals, interested: interested.length },
    };
  }

  async interested(propertyId: number): Promise<InterestedClient[]> {
    await this.assertListing(propertyId);
    return this.clients(propertyId);
  }

  /** One entry per client with an account, the most recently active first. */
  private async clients(propertyId: number): Promise<InterestedClient[]> {
    const rows = await this.repo.interest(propertyId);
    const byClient = new Map<number, InterestRow[]>();
    for (const r of rows) byClient.set(r.clientId, [...(byClient.get(r.clientId) ?? []), r]);
    const people = await this.repo.clients([...byClient.keys()]);
    return people
      .map((p) => {
        const own = byClient.get(p.id)!;
        return {
          id: p.id,
          name: p.name,
          phone: p.phone,
          kinds: INTEREST_KINDS.filter((k) => own.some((r) => r.kind === k)),
          firstAt: new Date(Math.min(...own.map((r) => r.firstAt.getTime()))).toISOString(),
          lastAt: new Date(Math.max(...own.map((r) => r.lastAt.getTime()))).toISOString(),
        };
      })
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt) || b.id - a.id);
  }

  private async assertListing(propertyId: number): Promise<void> {
    if (!(await this.repo.exists(propertyId))) throw new NotFoundException('Listing not found');
  }
}
