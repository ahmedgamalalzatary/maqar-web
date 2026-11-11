import { Injectable } from '@nestjs/common';
import { type AdminAgentOption, applyPriceChange, type Feature, type PropertyStatus } from '@maqar/shared';
import { and, asc, count, desc, eq, inArray, like, ne, or, type SQL, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { areas } from '../areas/areas.schema.js';
import { type ChangedListing } from '../prices/prices.repository.js';
import { priceHistory } from '../prices/prices.schema.js';
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

  /**
   * The edit and its price change are all or nothing: a price step that failed used to leave the
   * fields saved with the old price. Returns the price change when one was made.
   */
  async update(
    id: number,
    set: Partial<NewPropertyRow>,
    images?: string[],
    features?: Feature[],
    price?: { next: number; by: number; reset?: boolean },
  ): Promise<ChangedListing | undefined> {
    return this.db.transaction(async (tx) => {
      if (Object.keys(set).length) await tx.update(properties).set(set).where(eq(properties.id, id));
      if (images) {
        await tx.delete(propertyImages).where(eq(propertyImages.propertyId, id));
        await tx.insert(propertyImages).values(images.map((url, sort) => ({ propertyId: id, url, sort })));
      }
      if (features) {
        await tx.delete(propertyFeatures).where(eq(propertyFeatures.propertyId, id));
        if (features.length) await tx.insert(propertyFeatures).values(features.map((feature) => ({ propertyId: id, feature })));
      }
      if (!price) return undefined;
      const [cur] = await tx
        .select({ price: properties.price, oldPrice: properties.oldPrice, status: properties.status, titleAr: properties.titleAr, titleEn: properties.titleEn })
        .from(properties)
        .where(eq(properties.id, id))
        .for('update');
      if (!cur || cur.price === price.next) return undefined;
      if (price.reset) {
        // A new category's price has no common unit with the old one: clear the old price and plan,
        // and write the new price plainly — no drop alert, no misleading history.
        const cleared = { ...set };
        delete cleared.price;
        delete cleared.oldPrice;
        await tx.update(properties).set({ ...cleared, price: price.next, oldPrice: null }).where(eq(properties.id, id));
        return undefined;
      }
      const change = applyPriceChange(cur, price.next);
      await tx.update(properties).set({ price: change.price, oldPrice: change.oldPrice }).where(eq(properties.id, id));
      await tx.insert(priceHistory).values({ propertyId: id, oldPrice: cur.price, newPrice: price.next, changedBy: price.by });
      return { was: cur.price, status: cur.status, titleAr: cur.titleAr, titleEn: cur.titleEn, ...change, changed: true };
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

  /** Which of these photo urls any other listing still shows, so a removed photo is not deleted. */
  async imagesUsedElsewhere(urls: string[], exceptId: number): Promise<Set<string>> {
    if (!urls.length) return new Set();
    const rows = await this.db
      .select({ url: propertyImages.url })
      .from(propertyImages)
      .where(and(inArray(propertyImages.url, urls), ne(propertyImages.propertyId, exceptId)));
    return new Set(rows.map((r) => r.url));
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

  /**
   * Applies a status change only from the states it is allowed to come from, so a concurrent
   * publish/unpublish/close cannot be overwritten. With `agentActive`, the write also fails when
   * that advisor was deactivated in the meantime: a live listing never gets an inactive advisor.
   */
  async move(id: number, from: PropertyStatus[], set: Partial<NewPropertyRow>, agentActive?: number): Promise<boolean> {
    const clean = Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return true;
    const [res] = await this.db
      .update(properties)
      .set(clean)
      .where(
        and(
          eq(properties.id, id),
          inArray(properties.status, from),
          agentActive !== undefined ? sql`exists (select 1 from agents a where a.user_id = ${agentActive} and a.active = true)` : undefined,
        ),
      );
    return res.affectedRows === 1;
  }
}
