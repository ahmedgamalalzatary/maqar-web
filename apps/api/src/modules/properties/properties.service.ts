import { Injectable, NotFoundException } from '@nestjs/common';
import type { Page, PropertyCard, PropertyDetail } from '@maqar/shared';
import type { AgentRow } from '../agents/agents.schema.js';
import type { PropertiesQueryDto } from './dto/properties-query.dto.js';
import { PropertiesRepository } from './properties.repository.js';
import type { PropertyRow } from './properties.schema.js';

type AreaName = PropertyCard['area'];

/** How many similar homes the property page shows. */
const SIMILAR_LIMIT = 6;

function toCard(p: PropertyRow, area: AreaName, cover: string | null): PropertyCard {
  return {
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
    cover,
    // Approved listings always have a publish time; created_at only guards bad rows.
    publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
  };
}

function toAgent(a: AgentRow): PropertyDetail['agent'] {
  return {
    id: a.userId,
    nameAr: a.nameAr,
    nameEn: a.nameEn,
    roleTitleAr: a.roleTitleAr,
    roleTitleEn: a.roleTitleEn,
    rating: a.rating,
    dealsCount: a.dealsCount,
    years: a.years,
    languagesAr: a.languagesAr,
    languagesEn: a.languagesEn,
    avgReplyMins: a.avgReplyMins,
    phone: a.phone,
    colour: a.colour,
  };
}

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
    return { items: await this.withCovers(rows), page, limit, total };
  }

  /** The property page. Each call counts as one view. Missing and unapproved listings are 404. */
  async detail(id: number): Promise<PropertyDetail> {
    const row = await this.repo.findApprovedById(id);
    if (!row) throw new NotFoundException('Listing not found');
    const { p, area, agent } = row;
    const [images, features] = await Promise.all([this.repo.findImages(id), this.repo.findFeatures(id)]);
    await this.repo.addView(id);
    return {
      ...toCard(p, area, images[0] ?? null),
      developerAr: p.developerAr,
      developerEn: p.developerEn,
      floor: p.floor,
      maintenanceFee: p.maintenanceFee,
      descAr: p.descAr,
      descEn: p.descEn,
      features,
      images,
      views: p.views + 1,
      location: p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null,
      agent: toAgent(agent),
    };
  }

  async similar(id: number): Promise<PropertyCard[]> {
    const row = await this.repo.findApprovedById(id);
    if (!row) throw new NotFoundException('Listing not found');
    return this.withCovers(await this.repo.findSimilar(row.p, SIMILAR_LIMIT));
  }

  private async withCovers(rows: { p: PropertyRow; area: AreaName }[]): Promise<PropertyCard[]> {
    const covers = await this.repo.findCovers(rows.map((r) => r.p.id));
    return rows.map(({ p, area }) => toCard(p, area, covers.get(p.id) ?? null));
  }
}
