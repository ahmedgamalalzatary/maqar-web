import { Injectable } from '@nestjs/common';
import {
  BATHS_OPTIONS,
  BEDS_OPTIONS,
  type Category,
  type Feature,
  HISTOGRAM_BINS,
  type ListingFilters,
  MATCH_MAX,
  MATCH_MIN,
  MATCH_POINTS,
  NEAR_BUDGET_PCT,
  PRICE_FACTOR,
  type Prefs,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPES,
  priceCategories,
  type Scale,
  type Sort,
} from '@maqar/shared';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lte,
  ne,
  not,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type { MySqlColumn } from 'drizzle-orm/mysql-core';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { areas } from '../areas/areas.schema.js';
import { type PropertyRow, properties, propertyFeatures, propertyImages, tourRooms } from './properties.schema.js';

export type BrowseFilter = ListingFilters & { sort: Sort; offset: number; limit: number; prefs?: Prefs };

const areaColumns = { id: areas.id, nameAr: areas.nameAr, nameEn: areas.nameEn };
const approved = eq(properties.status, 'approved');

/** Search words beyond this are ignored. */
const MAX_WORDS = 6;
const BEDS_TOP = BEDS_OPTIONS[BEDS_OPTIONS.length - 1];
const BATHS_TOP = BATHS_OPTIONS[BATHS_OPTIONS.length - 1];

const NEWEST = [desc(properties.publishedAt), desc(properties.id)];

const ORDER: Record<Exclude<Sort, 'match'>, SQL[]> = {
  newest: NEWEST,
  low: [asc(properties.price), asc(properties.id)],
  high: [desc(properties.price), desc(properties.id)],
};

/** The listing has at least one 360° tour room. */
const hasTour = sql`exists (select 1 from ${tourRooms} where ${tourRooms.propertyId} = ${properties.id})`;

/** A whole number, inlined: only our own constants, never user input. */
const int = (n: number) => sql.raw(String(Math.trunc(n)));

/**
 * The match score in SQL (contract §8.3), so lists can be sorted by it and paged. It must give
 * the same numbers as the shared `matchScore`; the e2e tests compare the two on every listing.
 */
export function matchScoreSql(prefs: Prefs): SQL<number> {
  const P = MATCH_POINTS;
  const f = prefs.purpose[0] === 'rent' ? PRICE_FACTOR.rentBudget : PRICE_FACTOR.buyBudget;
  const price = sql`(case ${properties.category} when 'rent' then ${properties.price} * ${int(f.rent)} when 'stay' then ${properties.price} * ${int(f.stay)} else ${properties.price} end)`;
  const parts: SQL[] = [
    sql`case when ${inArray(properties.category, prefs.purpose)} then ${int(P.purpose)} else 0 end`,
    sql`case when ${price} <= ${prefs.budgetMax} then ${int(P.withinBudget)} when ${price} * 100 <= ${prefs.budgetMax * NEAR_BUDGET_PCT} then ${int(P.nearBudget)} else ${int(P.overBudget)} end`,
    prefs.areas.length
      ? sql`case when ${inArray(properties.areaId, prefs.areas)} then ${int(P.area)} else 0 end`
      : sql`${int(P.anyArea)}`,
  ];
  if (prefs.types.length) parts.push(sql`case when ${inArray(properties.type, prefs.types)} then ${int(P.type)} else 0 end`);
  if (prefs.beds > 0) parts.push(sql`case when ${properties.beds} >= ${prefs.beds} then ${int(P.beds)} else 0 end`);
  if (prefs.interests.length) {
    parts.push(
      sql`least(${int(P.interestsMax)}, ${int(P.perInterest)} * (select count(*) from ${propertyFeatures} where ${propertyFeatures.propertyId} = ${properties.id} and ${inArray(propertyFeatures.feature, prefs.interests)}))`,
      sql`case when ${isNotNull(properties.planDownPct)} then ${int(P.plan)} else 0 end`,
    );
  }
  parts.push(sql`case when ${hasTour} then ${int(P.tour)} else 0 end`);
  const total = sql.join([sql`${int(P.start)}`, ...parts], sql` + `);
  return sql<number>`least(${int(MATCH_MAX)}, greatest(${int(MATCH_MIN)}, ${total}))`;
}

/** `%` and `_` in a search are plain text. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** One search word matches a text column, or names a unit type ("شاليه", "villa"). */
function wordMatches(word: string): SQL | undefined {
  const pattern = `%${escapeLike(word)}%`;
  const lower = word.toLowerCase();
  const types = PROPERTY_TYPES.filter((t) => {
    const { ar, en } = PROPERTY_TYPE_LABEL[t];
    return ar.includes(word) || en.toLowerCase().includes(lower) || t.includes(lower);
  });
  const columns = [
    properties.titleAr,
    properties.titleEn,
    properties.compoundAr,
    properties.compoundEn,
    properties.developerAr,
    properties.developerEn,
    areas.nameAr,
    areas.nameEn,
  ];
  return or(...columns.map((c) => like(c, pattern)), types.length ? inArray(properties.type, types) : undefined);
}

/** Exact counts, plus "N or more" when the top choice is picked. */
function countIn(column: MySqlColumn, picked: number[] | undefined, top: number): SQL | undefined {
  if (!picked?.length) return undefined;
  const exact = picked.filter((n) => n < top);
  return or(exact.length ? inArray(column, exact) : undefined, picked.includes(top) ? gte(column, top) : undefined);
}

/**
 * The WHERE for the public list (contract §8.4). Every filter must match; a list matches any
 * of its values, except amenities, which must all be there. `omit` leaves out one range, so its
 * own histogram is not cut by it.
 */
function filterWhere(f: ListingFilters, omit?: 'price' | 'size'): SQL | undefined {
  const words = (f.q ?? '').split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);
  const years = f.delivery?.filter((d): d is number => d !== 'ready') ?? [];
  const hasPrice = omit !== 'price' && (f.minPrice !== undefined || f.maxPrice !== undefined);
  const hasSize = omit !== 'size';
  return and(
    approved,
    f.category ? eq(properties.category, f.category) : undefined,
    ...words.map(wordMatches),
    // With All, a price applies to sale and project listings only.
    hasPrice ? inArray(properties.category, priceCategories(f.category)) : undefined,
    hasPrice && f.minPrice !== undefined ? gte(properties.price, f.minPrice) : undefined,
    hasPrice && f.maxPrice !== undefined ? lte(properties.price, f.maxPrice) : undefined,
    hasSize && f.minSize !== undefined ? gte(properties.sizeM2, f.minSize) : undefined,
    hasSize && f.maxSize !== undefined ? lte(properties.sizeM2, f.maxSize) : undefined,
    f.types?.length ? inArray(properties.type, f.types) : undefined,
    countIn(properties.beds, f.beds, BEDS_TOP),
    countIn(properties.baths, f.baths, BATHS_TOP),
    f.areas?.length ? inArray(properties.areaId, f.areas) : undefined,
    f.delivery?.length
      ? or(f.delivery.includes('ready') ? isNull(properties.deliveryYear) : undefined, years.length ? inArray(properties.deliveryYear, years) : undefined)
      : undefined,
    f.finishing?.length ? inArray(properties.finishing, f.finishing) : undefined,
    ...(f.features ?? []).map(
      (feature) =>
        sql`exists (select 1 from ${propertyFeatures} where ${propertyFeatures.propertyId} = ${properties.id} and ${propertyFeatures.feature} = ${feature})`,
    ),
    f.plan === true ? isNotNull(properties.planDownPct) : f.plan === false ? isNull(properties.planDownPct) : undefined,
    f.ready === true ? isNull(properties.deliveryYear) : f.ready === false ? isNotNull(properties.deliveryYear) : undefined,
    f.dropped === true ? gt(properties.oldPrice, properties.price) : undefined,
    f.tour === true ? hasTour : f.tour === false ? not(hasTour) : undefined,
  );
}

/** All database access for listings. Public reads only ever see approved listings. */
@Injectable()
export class PropertiesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** One page of approved listings that match the filters, in the chosen order, with their area names. */
  async findPublicPage(f: BrowseFilter) {
    const where = filterWhere(f);
    const [rows, total] = await Promise.all([
      this.db
        .select({ p: properties, area: areaColumns })
        .from(properties)
        .innerJoin(areas, eq(areas.id, properties.areaId))
        .where(where)
        .orderBy(...(f.sort === 'match' ? [desc(matchScoreSql(f.prefs!)), ...NEWEST] : ORDER[f.sort]))
        .limit(f.limit)
        .offset(f.offset),
      this.countWhere(where),
    ]);
    return { rows, total };
  }

  /** Approved listings that match the filters. */
  countMatching(f: ListingFilters) {
    return this.countWhere(filterWhere(f));
  }

  /** Approved listings that fit the preferences at least `min` (onboarding's live count). */
  countGoodMatches(prefs: Prefs, min: number) {
    return this.countWhere(and(approved, sql`${matchScoreSql(prefs)} >= ${min}`));
  }

  /** The amenities of each listing. */
  async findFeaturesOf(ids: number[]): Promise<Map<number, Feature[]>> {
    const map = new Map<number, Feature[]>(ids.map((id) => [id, []]));
    if (!ids.length) return map;
    const rows = await this.db
      .select({ propertyId: propertyFeatures.propertyId, feature: propertyFeatures.feature })
      .from(propertyFeatures)
      .where(inArray(propertyFeatures.propertyId, ids));
    for (const r of rows) map.get(r.propertyId)?.push(r.feature);
    return map;
  }

  /** Bars of the price histogram: listings that match every filter but the price range. */
  priceHistogram(f: ListingFilters, scale: Scale) {
    // The bars only chart the categories a price filter would apply to.
    const where = and(filterWhere(f, 'price'), inArray(properties.category, priceCategories(f.category)));
    return this.histogram(properties.price, scale, where);
  }

  /** Bars of the size histogram: listings that match every filter but the size range. */
  sizeHistogram(f: ListingFilters, scale: Scale) {
    return this.histogram(properties.sizeM2, scale, filterWhere(f, 'size'));
  }

  /** Handover years of approved listings in a category, oldest first. */
  async deliveryYears(category: Category | undefined): Promise<number[]> {
    const rows = await this.db
      .selectDistinct({ year: properties.deliveryYear })
      .from(properties)
      .where(and(approved, isNotNull(properties.deliveryYear), category ? eq(properties.category, category) : undefined))
      .orderBy(asc(properties.deliveryYear));
    return rows.map((r) => r.year!);
  }

  private async countWhere(where: SQL | undefined): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(properties)
      .innerJoin(areas, eq(areas.id, properties.areaId))
      .where(where);
    return total;
  }

  /** Counts per bar over the scale; values past either end go to the first or last bar (as histogramBin). */
  private async histogram(column: MySqlColumn, { min, max }: Scale, where: SQL | undefined): Promise<number[]> {
    const n = HISTOGRAM_BINS;
    // Inlined, not bound: the GROUP BY must repeat the SELECT expression exactly. All are our own numbers.
    const num = (x: number) => sql.raw(String(Math.trunc(x)));
    const bin = sql<number>`least(${num(n - 1)}, greatest(0, floor((cast(${column} as signed) - ${num(min)}) * ${num(n)} / ${num(max - min)})))`;
    const rows = await this.db
      .select({ bin, count: count() })
      .from(properties)
      .innerJoin(areas, eq(areas.id, properties.areaId))
      .where(where)
      .groupBy(bin);
    const counts = Array.from({ length: n }, () => 0);
    for (const r of rows) counts[Number(r.bin)] = r.count;
    return counts;
  }

  /** Whether the listing exists and is approved. */
  async isApproved(id: number): Promise<boolean> {
    return (await this.countWhere(and(eq(properties.id, id), approved))) > 0;
  }

  /** These listings with their area names, where approved. In no particular order. */
  async findApprovedByIds(ids: number[]) {
    if (!ids.length) return [];
    return this.db
      .select({ p: properties, area: areaColumns })
      .from(properties)
      .innerJoin(areas, eq(areas.id, properties.areaId))
      .where(and(inArray(properties.id, ids), approved));
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
  /** Which of these listings have a 360° tour. */
  async findWithTour(ids: number[]): Promise<Set<number>> {
    if (!ids.length) return new Set();
    const rows = await this.db
      .selectDistinct({ propertyId: tourRooms.propertyId })
      .from(tourRooms)
      .where(inArray(tourRooms.propertyId, ids));
    return new Set(rows.map((r) => r.propertyId));
  }

  /** A listing's tour rooms, in tour order. */
  async findTourRooms(id: number) {
    return this.db
      .select({ id: tourRooms.id, nameAr: tourRooms.nameAr, nameEn: tourRooms.nameEn, pano: tourRooms.pano })
      .from(tourRooms)
      .where(eq(tourRooms.propertyId, id))
      .orderBy(asc(tourRooms.sort), asc(tourRooms.id));
  }

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
