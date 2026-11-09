import { Injectable } from '@nestjs/common';
import type { Category } from '@maqar/shared';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { areas } from '../areas/areas.schema.js';
import { properties, propertyImages } from './properties.schema.js';

export type BrowseFilter = { category?: Category; area?: string; offset: number; limit: number };

/** All database access for listings. Public reads only ever see approved listings. */
@Injectable()
export class PropertiesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** One page of approved listings, newest first, with their area names. */
  async findPublicPage(f: BrowseFilter) {
    const where = and(
      eq(properties.status, 'approved'),
      f.category ? eq(properties.category, f.category) : undefined,
      f.area ? eq(properties.areaId, f.area) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ p: properties, area: { id: areas.id, nameAr: areas.nameAr, nameEn: areas.nameEn } })
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
