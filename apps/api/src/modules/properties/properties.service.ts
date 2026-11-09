import { Injectable } from '@nestjs/common';
import type { Page, PropertyCard } from '@maqar/shared';
import type { PropertiesQueryDto } from './dto/properties-query.dto.js';
import { PropertiesRepository } from './properties.repository.js';

@Injectable()
export class PropertiesService {
  constructor(private readonly repo: PropertiesRepository) {}

  async browse(q: PropertiesQueryDto): Promise<Page<PropertyCard>> {
    const { page, limit } = q;
    const { rows, total } = await this.repo.findPublicPage({
      category: q.category,
      area: q.area,
      offset: (page - 1) * limit,
      limit,
    });
    const covers = await this.repo.findCovers(rows.map((r) => r.p.id));
    const items = rows.map(
      ({ p, area }): PropertyCard => ({
        id: p.id,
        category: p.category,
        type: p.type,
        titleAr: p.titleAr,
        titleEn: p.titleEn,
        area,
        compoundAr: p.compoundAr,
        compoundEn: p.compoundEn,
        price: p.price,
        oldPrice: p.oldPrice,
        beds: p.beds,
        baths: p.baths,
        sizeM2: p.sizeM2,
        finishing: p.finishing,
        delivery: p.deliveryYear ?? 'ready',
        plan: p.planDownPct != null && p.planYears != null ? { downPct: p.planDownPct, years: p.planYears } : null,
        cover: covers.get(p.id) ?? null,
        // Approved listings always have a publish time; created_at only guards bad rows.
        publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
      }),
    );
    return { items, page, limit, total };
  }
}
