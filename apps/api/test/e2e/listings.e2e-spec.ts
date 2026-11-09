import type { INestApplication } from '@nestjs/common';
import type { AreaItem, Page, PropertyCard } from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { properties } from '../../src/modules/properties/properties.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { resetDb } from '../utils/db.js';

// Phase 3: browsing is public and shows approved listings only (contract §8.2, §14).
describe('Areas and listings (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  const get = (url: string) => request(app.getHttpServer()).get(url);

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    // Seeding twice must not duplicate anything.
    for (let i = 0; i < 2; i++) {
      await seedAreas(db);
      await seedProperties(db);
    }
    // Listings the public must never see.
    const [approved] = await db.select().from(properties).limit(1);
    const { id: _id, ...rest } = approved;
    for (const status of ['draft', 'pending', 'changes', 'sold', 'rented', 'unpublished'] as const) {
      await db.insert(properties).values({ ...rest, titleEn: `Hidden ${status}`, status, publishedAt: new Date() });
    }
  });
  afterAll(async () => {
    await app.close();
  });

  it('lists the 8 areas with both names and a photo, without signing in', async () => {
    const res = await get('/v1/areas').expect(200);
    const areas = res.body as AreaItem[];
    expect(areas).toHaveLength(8);
    expect(areas.find((a) => a.id === 'zayed')).toMatchObject({
      nameAr: 'الشيخ زايد',
      nameEn: 'Sheikh Zayed',
      cityEn: 'Giza',
      image: expect.stringMatching(/^\/uploads\/.+\.jpg$/),
    });
  });

  it('shows only approved listings, newest first', async () => {
    const res = await get('/v1/properties?limit=50').expect(200);
    const page = res.body as Page<PropertyCard>;
    expect(page.total).toBe(16);
    expect(page.items).toHaveLength(16);
    expect(page.items.some((p) => p.titleEn.startsWith('Hidden'))).toBe(false);
    const times = page.items.map((p) => Date.parse(p.publishedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('pages through the results without repeats', async () => {
    const first = (await get('/v1/properties?limit=5&page=1').expect(200)).body as Page<PropertyCard>;
    const second = (await get('/v1/properties?limit=5&page=2').expect(200)).body as Page<PropertyCard>;
    expect(first).toMatchObject({ page: 1, limit: 5, total: 16 });
    expect(first.items).toHaveLength(5);
    expect(second.items).toHaveLength(5);
    const ids = [...first.items, ...second.items].map((p) => p.id);
    expect(new Set(ids).size).toBe(10);

    const last = (await get('/v1/properties?limit=5&page=4').expect(200)).body as Page<PropertyCard>;
    expect(last.items).toHaveLength(1);
    const past = (await get('/v1/properties?limit=5&page=9').expect(200)).body as Page<PropertyCard>;
    expect(past.items).toEqual([]);
  });

  it.each([
    ['rent', 3],
    ['project', 4],
    ['stay', 2],
    ['sale', 7],
  ] as const)('filters by category: %s', async (category, count) => {
    const page = (await get(`/v1/properties?category=${category}`).expect(200)).body as Page<PropertyCard>;
    expect(page.total).toBe(count);
    expect(page.items.every((p) => p.category === category)).toBe(true);
  });

  it('filters by area', async () => {
    const page = (await get('/v1/properties?area=zayed').expect(200)).body as Page<PropertyCard>;
    expect(page.total).toBe(3);
    expect(page.items.every((p) => p.area.id === 'zayed')).toBe(true);
  });

  it('gives each card what it shows: cover photo, area, price, old price, plan and delivery', async () => {
    const page = (await get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>;
    const villa = page.items.find((p) => p.titleEn === 'Standalone villa with private pool')!;
    expect(villa).toMatchObject({
      category: 'sale',
      type: 'villa',
      price: 24_500_000,
      oldPrice: 26_000_000,
      beds: 5,
      baths: 5,
      sizeM2: 420,
      delivery: 'ready',
      plan: { downPct: 20, years: 5 },
      area: { id: 'new-cairo', nameEn: 'New Cairo' },
      cover: '/uploads/seed/p1.jpg',
    });
    const project = page.items.find((p) => p.titleEn === 'Townhouses in a new launch')!;
    expect(project).toMatchObject({ delivery: 2029, oldPrice: null, finishing: 'core' });
    const rent = page.items.find((p) => p.titleEn === 'Furnished studio')!;
    expect(rent.plan).toBeNull();
  });

  it.each([
    ['an unknown category', '?category=castle'],
    ['a page below 1', '?page=0'],
    ['more than 50 a page', '?limit=51'],
    ['an unknown filter', '?colour=red'],
  ])('refuses %s', async (_name, query) => {
    await get(`/v1/properties${query}`).expect(400);
  });
});
