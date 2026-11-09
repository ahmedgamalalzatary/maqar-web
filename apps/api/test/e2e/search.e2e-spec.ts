import type { INestApplication } from '@nestjs/common';
import { HISTOGRAM_BINS, type ListingFacets, type Page, type PropertyCard } from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { properties } from '../../src/modules/properties/properties.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { resetDb } from '../utils/db.js';

// Phase 5: search, filters, sort and the filter sheet's counts (contract §8.4).
// Expected counts come from the 16 seed listings (properties.seed.ts).
describe('Search, filters and sort (e2e)', () => {
  let app: INestApplication<App>;
  const get = (url: string) => request(app.getHttpServer()).get(url);
  const list = async (query: string) => (await get(`/v1/properties?limit=50&${query}`).expect(200)).body as Page<PropertyCard>;
  const titles = async (query: string) => (await list(query)).items.map((p) => p.titleEn).sort();
  const facets = async (query = '') => (await get(`/v1/properties/facets?${query}`).expect(200)).body as ListingFacets;
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    // A hidden copy of each listing must never be found, counted or charted.
    const rows = await db.select().from(properties);
    for (const { id: _id, ...rest } of rows) {
      await db.insert(properties).values({ ...rest, titleEn: `Hidden ${rest.titleEn}`, status: 'pending' });
    }
  });
  afterAll(async () => {
    await app.close();
  });

  describe('free-text search', () => {
    it.each([
      ['a compound', 'q=azure', ['First-row sea-view chalet', 'Lagoon-view chalet']],
      ['a developer', 'q=arkan', ['Apartments, 10% down over 8 years', 'Smart apartments, New Capital']],
      ['an area, every word', 'q=new%20cairo', ['Furnished flat near the AUC', 'Garden duplex in New Cairo', 'Standalone villa with private pool']],
      ['an area in Arabic', `q=${encodeURIComponent('التجمع')}`, ['Furnished flat near the AUC', 'Garden duplex in New Cairo', 'Standalone villa with private pool']],
      ['a unit type in Arabic', `q=${encodeURIComponent('شاليه')}`, ['First-row sea-view chalet', 'Lagoon-view chalet', 'New Alamein chalets on installments']],
      ['upper or lower case alike', 'q=PENTHOUSE', ['Penthouse with a wide terrace']],
    ])('finds by %s', async (_name, query, expected) => {
      expect(await titles(query)).toEqual(expected);
    });

    it('treats % and _ as plain text', async () => {
      // Only the one title with a real "%" in it, not every listing.
      expect(await titles('q=%25')).toEqual(['Apartments, 10% down over 8 years']);
      expect((await list('q=_')).total).toBe(0);
      expect(await titles('q=10%25')).toEqual(['Apartments, 10% down over 8 years']);
    });

    it('ignores a blank search', async () => {
      expect((await list('q=%20%20')).total).toBe(16);
    });
  });

  describe('price', () => {
    it('applies to sale and project listings only when the category is All', async () => {
      expect((await list('minPrice=0')).total).toBe(11);
      expect(await titles('minPrice=10000000&maxPrice=20000000')).toEqual([
        'First-row sea-view chalet',
        'Garden duplex in New Cairo',
        'Lagoon-front villa',
        'Penthouse with a wide terrace',
        'Twin house with private garden',
      ]);
    });

    it('is monthly rent for Rent and the nightly price for Stays', async () => {
      expect(await titles('category=rent&maxPrice=50000')).toEqual(['Furnished flat near the AUC', 'Furnished studio']);
      expect(await titles('category=stay&minPrice=7000')).toEqual(['Holiday villa with pool']);
    });
  });

  it.each([
    ['size', 'minSize=200&maxSize=300', 4],
    ['several unit types', 'type=villa,chalet', 7],
    ['bedrooms, where 5 means 5 or more', 'beds=5', 2],
    ['several bedroom counts', 'beds=1,2', 6],
    ['bathrooms, where 4 means 4 or more', 'baths=4', 4],
    ['several areas', 'area=zayed,maadi', 5],
    ['ready to move in, as a delivery choice', 'delivery=ready', 12],
    ['a handover year', 'delivery=2027', 2],
    ['ready or a year', 'delivery=ready,2029', 13],
    ['finishing', 'finishing=furnished', 5],
    ['amenities, which must all be there', 'feature=pool,sea', 5],
    ['the installments quick filter', 'plan=true', 10],
    ['the ready quick filter', 'ready=true', 12],
    ['the price dropped quick filter', 'dropped=true', 3],
    ['repeated parameters as well as commas', 'type=villa&type=chalet', 7],
  ])('filters by %s', async (_name, query, count) => {
    expect((await list(query)).total).toBe(count);
  });

  it('combines filters: every one must match', async () => {
    expect(await titles('category=sale&plan=true&dropped=true')).toEqual([
      'First-row sea-view chalet',
      'Standalone villa with private pool',
    ]);
    expect(await titles('area=north-coast&type=chalet&feature=pool&maxSize=120')).toEqual(['Lagoon-view chalet']);
    expect(await titles('q=villa&beds=4&category=sale')).toEqual(['Lagoon-front villa']);
    expect((await list('category=rent&delivery=2027')).total).toBe(0);
  });

  describe('sort', () => {
    it('by lowest and highest price', async () => {
      const low = (await list('category=sale&sort=low')).items.map((p) => p.price);
      expect(low).toEqual([...low].sort((a, b) => a - b));
      expect(low[0]).toBe(7_850_000);
      const high = (await list('category=sale&sort=high')).items.map((p) => p.price);
      expect(high).toEqual([...high].sort((a, b) => b - a));
      expect(high[0]).toBe(24_500_000);
    });

    it('newest first by default, and pages stay in the sort order', async () => {
      const all = (await list('')).items.map((p) => Date.parse(p.publishedAt));
      expect(all).toEqual([...all].sort((a, b) => b - a));
      const first = (await get('/v1/properties?sort=low&limit=5&page=1').expect(200)).body as Page<PropertyCard>;
      const second = (await get('/v1/properties?sort=low&limit=5&page=2').expect(200)).body as Page<PropertyCard>;
      const prices = [...first.items, ...second.items].map((p) => p.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });
  });

  describe('facets for the filter sheet', () => {
    it('counts the matches and charts price and size on the category scale', async () => {
      const f = await facets('category=rent');
      expect(f.total).toBe(3);
      expect(f.price).toMatchObject({ min: 0, max: 200_000, step: 5_000 });
      expect(f.price.counts).toHaveLength(HISTOGRAM_BINS);
      // 18,000, 45,000 and 140,000 a month.
      expect(f.price.counts[2]).toBe(1);
      expect(f.price.counts[6]).toBe(1);
      expect(f.price.counts[19]).toBe(1);
      expect(sum(f.price.counts)).toBe(3);
      // 65, 140 and 450 m².
      expect(f.size).toMatchObject({ min: 50, max: 500, step: 10 });
      expect([f.size.counts[0], f.size.counts[5], f.size.counts[24]]).toEqual([1, 1, 1]);
      expect(sum(f.size.counts)).toBe(3);
    });

    it('charts price for sale and project listings only on All', async () => {
      const f = await facets();
      expect(f.total).toBe(16);
      expect(f.price.max).toBe(30_000_000);
      expect(sum(f.price.counts)).toBe(11);
      expect(sum(f.size.counts)).toBe(16);
      expect((await facets('category=stay')).price).toMatchObject({ max: 15_000, step: 500 });
    });

    it('leaves each range out of its own chart, so the bars stay while a thumb moves', async () => {
      const f = await facets('category=rent&maxPrice=50000&maxSize=100');
      expect(f.total).toBe(1);
      expect(sum(f.price.counts)).toBe(1); // by size only: the studio
      expect(sum(f.size.counts)).toBe(2); // by price only: the studio and the flat
    });

    it('lists the handover years of the category', async () => {
      expect((await facets()).deliveryYears).toEqual([2027, 2028, 2029]);
      expect((await facets('category=project')).deliveryYears).toEqual([2027, 2028, 2029]);
      expect((await facets('category=sale')).deliveryYears).toEqual([]);
    });
  });

  it.each([
    ['an unknown sort', '?sort=best'],
    ['an unknown unit type', '?type=castle'],
    ['a bedroom count past the last choice', '?beds=6'],
    ['a bathroom count of 0', '?baths=0'],
    ['an unknown delivery', '?delivery=soon'],
    ['an unknown amenity', '?feature=helipad'],
    ['an unknown finishing', '?finishing=gold'],
    ['a negative price', '?minPrice=-1'],
    ['a minimum price above the maximum', '?minPrice=500&maxPrice=100'],
    ['a minimum size above the maximum', '?minSize=300&maxSize=200'],
    ['a quick filter that is not true or false', '?plan=maybe'],
    ['a search longer than 100 characters', `?q=${'a'.repeat(101)}`],
  ])('refuses %s', async (_name, query) => {
    await get(`/v1/properties${query}`).expect(400);
    await get(`/v1/properties/facets${query}`).expect(400);
  });
});
