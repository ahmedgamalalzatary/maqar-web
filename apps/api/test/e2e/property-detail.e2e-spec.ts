import type { INestApplication } from '@nestjs/common';
import type { Page, PropertyCard, PropertyDetail } from '@maqar/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { properties } from '../../src/modules/properties/properties.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { resetDb } from '../utils/db.js';

// Phase 4: the property page (contract §8.5, §14).
describe('Property page (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  const ids = new Map<string, number>();
  let hiddenId: number;
  const get = (url: string) => request(app.getHttpServer()).get(url);

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    const page = (await get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>;
    for (const p of page.items) ids.set(p.titleEn, p.id);

    // A pending copy of the villa: same category, area and type, so it would rank first if leaked.
    const [villa] = await db.select().from(properties).where(eq(properties.id, ids.get('Standalone villa with private pool')!));
    const { id: _id, ...rest } = villa;
    [{ id: hiddenId }] = await db.insert(properties).values({ ...rest, titleEn: 'Pending villa', status: 'pending' }).$returningId();
  });
  afterAll(async () => {
    await app.close();
  });

  it('gives everything the page shows, without signing in', async () => {
    const id = ids.get('Standalone villa with private pool')!;
    const p = (await get(`/v1/properties/${id}`).expect(200)).body as PropertyDetail;
    expect(p).toMatchObject({
      id,
      category: 'sale',
      price: 24_500_000,
      oldPrice: 26_000_000,
      floor: null,
      maintenanceFee: 8,
      plan: { downPct: 20, years: 5 },
      delivery: 'ready',
      descEn: expect.stringContaining('corner villa'),
      area: { id: 'new-cairo', nameAr: 'التجمع الخامس' },
      cover: '/uploads/seed/p1.jpg',
      agent: { nameEn: 'Omar Hassan', roleTitleEn: 'Senior sales advisor', rating: 4.9, phone: '+201000000001' },
    });
    expect(p.images).toEqual(['p1', 'p3', 'p17', 'p14', 'p29'].map((f) => `/uploads/seed/${f}.jpg`));
    expect([...p.features].sort()).toEqual(['clubhouse', 'garden', 'parking', 'pool', 'security', 'smart']);
    expect(p.location).toEqual({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(p.developerEn).toBeNull();
  });

  it('counts each view', async () => {
    const id = ids.get('Furnished studio')!;
    const first = (await get(`/v1/properties/${id}`).expect(200)).body as PropertyDetail;
    const second = (await get(`/v1/properties/${id}`).expect(200)).body as PropertyDetail;
    expect(second.views).toBe(first.views + 1);
  });

  it.each([
    ['a listing that does not exist', () => 999_999],
    ['a listing that is not approved', () => hiddenId],
  ])('answers 404 for %s, and does not count the view', async (_name, id) => {
    await get(`/v1/properties/${id()}`).expect(404);
    await get(`/v1/properties/${id()}/similar`).expect(404);
    const [row] = await db.select({ views: properties.views }).from(properties).where(eq(properties.id, hiddenId));
    expect(row.views).toBe(2140);
  });

  it('refuses an id that is not a number', async () => {
    await get('/v1/properties/abc').expect(400);
  });

  it('suggests similar homes: same category, same area first, then same type, then the closest price', async () => {
    const id = ids.get('Standalone villa with private pool')!;
    const similar = (await get(`/v1/properties/${id}/similar`).expect(200)).body as PropertyCard[];
    expect(similar.map((p) => p.titleEn)).toEqual([
      'Garden duplex in New Cairo', // same area
      'Lagoon-front villa', // same type
      'Twin house with private garden', // then by the closest price
      'Penthouse with a wide terrace',
      'First-row sea-view chalet',
      '3-bed apartment overlooking landscape',
    ]);
  });

  it('never suggests the listing itself or another category', async () => {
    const id = ids.get('Furnished studio')!;
    const similar = (await get(`/v1/properties/${id}/similar`).expect(200)).body as PropertyCard[];
    expect(similar.map((p) => p.id)).not.toContain(id);
    expect(similar.every((p) => p.category === 'rent')).toBe(true);
    expect(similar).toHaveLength(2);
  });
});
