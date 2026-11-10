import { Injectable } from '@nestjs/common';
import type { AdminAgentOption, Feature, PropertyStatus } from '@maqar/shared';
import { and, asc, count, desc, eq, inArray, like, or, type SQL, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { areas } from '../areas/areas.schema.js';
import { type NewPropertyRow, type PropertyRow, properties, propertyFeatures, propertyImages, tourRooms } from '../properties/properties.schema.js';

const areaColumns = { id: areas.id, nameAr: areas.nameAr, nameEn: areas.nameEn };
const agentColumns = { id: agents.userId, nameAr: agents.nameAr, nameEn: agents.nameEn, colour: agents.colour };

export type AreaName = { id: string; nameAr: string; nameEn: string };
export type ListingRow = { p: PropertyRow; area: AreaName; agent: { id: number; nameAr: string; nameEn: string; colour: string } | null };
export type ListingPageQuery = { status?: PropertyStatus; q?: string; offset: number; limit: number };

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Every search word must appear in the title, the compound, or the owner's name or phone. */
function searchWhere(q: string | undefined): SQL | undefined {
  const words = (q ?? '').split(/\s+/).filter(Boolean).slice(0, 6);
  const columns = [properties.titleAr, properties.titleEn, properties.compoundAr, properties.compoundEn, properties.ownerName, properties.ownerPhone];
  return and(...words.map((w) => or(...columns.map((c) => like(c, `%${escapeLike(w)}%`)))));
}

/** Listings in every status, for the admin tools (phase 17). Public reads stay in PropertiesRepository. */
@Injectable()
export class ListingsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async area(id: string): Promise<AreaName | undefined> {
    const [row] = await this.db.select(areaColumns).from(areas).where(eq(areas.id, id));
    return row;
  }

  /** Adds the listing with its photos (in order, the first is the cover) and amenities. */
  async insert(row: NewPropertyRow, images: string[], features: Feature[]): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [{ id }] = await tx.insert(properties).values(row).$returningId();
      await tx.insert(propertyImages).values(images.map((url, sort) => ({ propertyId: id, url, sort })));
      if (features.length) await tx.insert(propertyFeatures).values(features.map((feature) => ({ propertyId: id, feature })));
      return id;
    });
  }

  /** Changes the columns given, and replaces the photos or amenities when they are given. */
  async update(id: number, set: Partial<NewPropertyRow>, images?: string[], features?: Feature[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      if (Object.keys(set).length) await tx.update(properties).set(set).where(eq(properties.id, id));
      if (images) {
        await tx.delete(propertyImages).where(eq(propertyImages.propertyId, id));
        await tx.insert(propertyImages).values(images.map((url, sort) => ({ propertyId: id, url, sort })));
      }
      if (features) {
        await tx.delete(propertyFeatures).where(eq(propertyFeatures.propertyId, id));
        if (features.length) await tx.insert(propertyFeatures).values(features.map((feature) => ({ propertyId: id, feature })));
      }
    });
  }

  async find(id: number): Promise<ListingRow | undefined> {
    const [row] = await this.db
      .select({ p: properties, area: areaColumns, agent: agentColumns })
      .from(properties)
      .innerJoin(areas, eq(areas.id, properties.areaId))
      .leftJoin(agents, eq(agents.userId, properties.agentId))
      .where(eq(properties.id, id));
    return row;
  }

  /** One page, newest first, and how many listings each status has (for the same words, any status). */
  async page({ status, q, offset, limit }: ListingPageQuery) {
    const words = searchWhere(q);
    const where = and(words, status ? eq(properties.status, status) : undefined);
    const [rows, [{ total }], byStatus] = await Promise.all([
      this.db
        .select({ p: properties, area: areaColumns, agent: agentColumns })
        .from(properties)
        .innerJoin(areas, eq(areas.id, properties.areaId))
        .leftJoin(agents, eq(agents.userId, properties.agentId))
        .where(where)
        .orderBy(desc(properties.createdAt), desc(properties.id))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(properties).where(where),
      this.db.select({ status: properties.status, n: count() }).from(properties).where(words).groupBy(properties.status),
    ]);
    return { rows: rows as ListingRow[], total, byStatus };
  }

  async images(ids: number[]): Promise<Map<number, string[]>> {
    const map = new Map<number, string[]>(ids.map((id) => [id, []]));
    if (!ids.length) return map;
    const rows = await this.db
      .select({ propertyId: propertyImages.propertyId, url: propertyImages.url })
      .from(propertyImages)
      .where(inArray(propertyImages.propertyId, ids))
      .orderBy(asc(propertyImages.sort), asc(propertyImages.id));
    for (const r of rows) map.get(r.propertyId)?.push(r.url);
    return map;
  }

  async features(id: number): Promise<Feature[]> {
    const rows = await this.db.select({ f: propertyFeatures.feature }).from(propertyFeatures).where(eq(propertyFeatures.propertyId, id));
    return rows.map((r) => r.f);
  }

  async withTour(ids: number[]): Promise<Set<number>> {
    if (!ids.length) return new Set();
    const rows = await this.db.selectDistinct({ id: tourRooms.propertyId }).from(tourRooms).where(inArray(tourRooms.propertyId, ids));
    return new Set(rows.map((r) => r.id));
  }

  /** Active advisors with their live listings, fewest first (the default pick when publishing). */
  async agentOptions(): Promise<AdminAgentOption[]> {
    // The outer column with its table: on one table Drizzle leaves names bare.
    const live = sql<number>`(select count(*) from ${properties} where ${properties.agentId} = ${sql.raw('`agents`.`user_id`')} and ${properties.status} = 'approved')`;
    const rows = await this.db
      .select({ ...agentColumns, live })
      .from(agents)
      .where(eq(agents.active, true))
      .orderBy(asc(live), asc(agents.userId));
    return rows.map((r) => ({ ...r, live: Number(r.live) }));
  }

  async isActiveAgent(id: number): Promise<boolean> {
    const [row] = await this.db.select({ id: agents.userId }).from(agents).where(and(eq(agents.userId, id), eq(agents.active, true)));
    return row !== undefined;
  }
}
