import { Injectable } from '@nestjs/common';
import type { Category } from '@maqar/shared';
import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { areas } from '../areas/areas.schema.js';
import { type PropertyRow, properties, propertyFeatures, propertyImages } from './properties.schema.js';

export type BrowseFilter = { category?: Category; area?: string; offset: number; limit: number };

const areaColumns = { id: areas.id, nameAr: areas.nameAr, nameEn: areas.nameEn };
const approved = eq(properties.status, 'approved');

/** All database access for listings. Public reads only ever see approved listings. */
@Injectable()
export class PropertiesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** One page of approved listings, newest first, with their area names. */
  async findPublicPage(f: BrowseFilter) {
    const where = and(
      approved,
      f.category ? eq(properties.category, f.category) : undefined,
      f.area ? eq(properties.areaId, f.area) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ p: properties, area: areaColumns })
        .from(properties)
        .innerJoin(areas, eq(areas.id, properties.areaId))
        .where(where)
        .orderBy(desc(properties.publishedAt), desc(properties.id))
        .limit(f.limit)
        .offset(f.offset),
      this.db.select({ total: count() }).from(properties).where(where),
    ]);
    return { rows, total };
  }

  /** An approved listing with its area and sales advisor, or undefined. */
  async findApprovedById(id: number) {
    const [row] = await this.db
      .select({ p: properties, area: areaColumns, agent: agents })
      .from(properties)
      .innerJoin(areas, eq(areas.id, properties.areaId))
      .innerJoin(agents, eq(agents.userId, properties.agentId))
      .where(and(eq(properties.id, id), approved));
    return row;
  }

  async findImages(id: number): Promise<string[]> {
    const rows = await this.db
      .select({ url: propertyImages.url })
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, id))
      .orderBy(asc(propertyImages.sort), asc(propertyImages.id));
    return rows.map((r) => r.url);
  }

  async findFeatures(id: number) {
    const rows = await this.db
      .select({ feature: propertyFeatures.feature })
      .from(propertyFeatures)
      .where(eq(propertyFeatures.propertyId, id));
    return rows.map((r) => r.feature);
  }

  async addView(id: number): Promise<void> {
    await this.db
      .update(properties)
      .set({ views: sql`${properties.views} + 1` })
      .where(eq(properties.id, id));
  }

  /**
   * Approved listings like `p` (contract §8.5): the same category, the same area first,
   * then the same type, then the closest price.
   */
  findSimilar(p: Pick<PropertyRow, 'id' | 'category' | 'areaId' | 'type' | 'price'>, limit: number) {
    return this.db
      .select({ p: properties, area: areaColumns })
      .from(properties)
      .innerJoin(areas, eq(areas.id, properties.areaId))
      .where(and(approved, eq(properties.category, p.category), ne(properties.id, p.id)))
      .orderBy(
        sql`${properties.areaId} = ${p.areaId} desc`,
        sql`${properties.type} = ${p.type} desc`,
        // price is unsigned: subtract as signed numbers, or MySQL refuses a negative result.
        sql`abs(cast(${properties.price} as signed) - ${p.price})`,
        asc(properties.id),
      )
      .limit(limit);
  }

  /** The cover (first) photo of each listing. */
  async findCovers(ids: number[]): Promise<Map<number, string>> {
    if (!ids.length) return new Map();
    const rows = await this.db
      .select({ propertyId: propertyImages.propertyId, url: propertyImages.url })
      .from(propertyImages)
      .where(inArray(propertyImages.propertyId, ids))
      .orderBy(asc(propertyImages.sort));
    const covers = new Map<number, string>();
    for (const r of rows) if (!covers.has(r.propertyId)) covers.set(r.propertyId, r.url);
    return covers;
  }
}
