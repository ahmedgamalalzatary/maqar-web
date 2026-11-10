import type { INestApplication } from '@nestjs/common';
import type {
  AdminAgentOption,
  AdminListing,
  AdminListingsPage,
  ListingBody,
  Page,
  PropertyCard,
  UploadResponse,
} from '@maqar/shared';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { agents } from '../../src/modules/agents/agents.schema.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { priceHistory } from '../../src/modules/prices/prices.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 17: admins create, edit, publish and close listings (no owner accounts, no review step).
describe('Admin listings (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let admin: string;
  let agent: string;
  let client: string;
  let photo: string;
  const http = () => request(app.getHttpServer());

  const jpeg = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: { r: 180, g: 140, b: 90 } } }).jpeg().toBuffer();
  const upload = async (buf: Buffer, token = admin, type = 'image/jpeg') =>
    http().post('/v1/uploads').set(bearer(token)).attach('photo', buf, { filename: 'p.jpg', contentType: type });

  const body = (over: Partial<ListingBody> = {}): ListingBody => ({
    category: 'sale',
    type: 'apartment',
    areaId: 'new-cairo',
    price: 7_250_000,
    beds: 3,
    baths: 2,
    sizeM2: 165,
    finishing: 'full',
    delivery: 'ready',
    features: ['garden', 'security'],
    images: [photo],
    ownerName: 'Hany Adel',
    ownerPhone: '+201001234567',
    ...over,
  });
  const create = (over: Partial<ListingBody> = {}, token = admin) => http().post('/v1/admin/listings').set(bearer(token)).send(body(over));
  const created = async (over: Partial<ListingBody> = {}) => (await create(over).expect(201)).body as AdminListing;
  const list = async (q = '') => (await http().get(`/v1/admin/listings${q}`).set(bearer(admin)).expect(200)).body as AdminListingsPage;
  const act = (id: number, action: string, send: object = {}) => http().post(`/v1/admin/listings/${id}/${action}`).set(bearer(admin)).send(send);
  const publicIds = async () => ((await http().get('/v1/properties?limit=50&sort=newest').expect(200)).body as Page<PropertyCard>).items.map((c) => c.id);

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    agent = await signInSeeded(app, 'omar@maqar.app');
    client = (await signUp(app)).accessToken;
    photo = ((await upload(await jpeg(800, 600))).body as UploadResponse).url;
  });
  afterAll(async () => {
    await app.close();
  });

  it('is for admins only', async () => {
    await http().get('/v1/admin/listings').expect(401);
    for (const token of [client, agent]) {
      await http().get('/v1/admin/listings').set(bearer(token)).expect(403);
      await http().get('/v1/admin/agents').set(bearer(token)).expect(403);
      await create({}, token).expect(403);
      expect((await upload(await jpeg(10, 10), token)).status).toBe(403);
    }
    await http().post('/v1/uploads').expect(401);
  });

  describe('POST /uploads', () => {
    it('stores a photo as JPEG, at most 2000 px on the longest side, and serves it', async () => {
      const res = await upload(await jpeg(3000, 2000));
      expect(res.status).toBe(201);
      const { url } = res.body as UploadResponse;
      expect(url).toMatch(/^\/uploads\/listings\/[0-9a-f-]+\.jpg$/);
      const served = await http().get(url).buffer(true).expect(200);
      const meta = await sharp(served.body as Buffer).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 2000, 1333]);
    });

    it('refuses no file, a file that is not a photo, and one over 10 MB', async () => {
      await http().post('/v1/uploads').set(bearer(admin)).expect(400);
      expect((await upload(Buffer.from('%PDF-1.4'), admin, 'application/pdf')).status).toBe(400);
      expect((await upload(Buffer.from('not really a jpeg'))).status).toBe(400);
      expect((await upload(Buffer.alloc(10 * 1024 * 1024 + 1, 1))).status).toBe(413);
    });
  });

  describe('creating', () => {
    it('makes a draft with the default title, kept out of public search until published', async () => {
      const l = await created();
      expect(l).toMatchObject({
        status: 'draft',
        titleAr: 'شقة ٣ غرف | التجمع الخامس',
        titleEn: 'Apartment, 3 beds | New Cairo',
        images: [photo],
        cover: photo,
        features: ['garden', 'security'],
        ownerName: 'Hany Adel',
        ownerPhone: '+201001234567',
        agent: null,
        publishedAt: null,
      });
      expect(await publicIds()).not.toContain(l.id);
      await http().get(`/v1/properties/${l.id}`).expect(404);
    });

    it('keeps the titles the admin wrote', async () => {
      const l = await created({ titleAr: 'شقة على الحديقة', titleEn: 'Garden flat' });
      expect([l.titleAr, l.titleEn]).toEqual(['شقة على الحديقة', 'Garden flat']);
    });

    it('needs at least one photo, and only photos uploaded here', async () => {
      await create({ images: [] }).expect(400);
      await create({ images: ['https://evil.example/x.jpg'] }).expect(400);
      await create({ images: ['/uploads/../.env'] }).expect(400);
    });

    it('checks the fields: area, numbers, plan, features', async () => {
      await create({ areaId: 'atlantis' }).expect(400);
      await create({ price: 0 }).expect(400);
      await create({ beds: -1 }).expect(400);
      await create({ category: 'castle' as never }).expect(400);
      await create({ features: ['moat' as never] }).expect(400);
      await create({ plan: { downPct: 150, years: 5 } }).expect(400);
      await create({ delivery: 1999 }).expect(400);
    });
  });

  describe('publishing', () => {
    it('lists active advisors with their live listings, fewest first', async () => {
      const options = (await http().get('/v1/admin/agents').set(bearer(admin)).expect(200)).body as AdminAgentOption[];
      expect(options.length).toBeGreaterThan(1);
      const live = options.map((o) => o.live);
      expect(live).toEqual([...live].sort((a, b) => a - b));
    });

    it('goes live with the advisor that has the fewest live listings, and shows in Explore', async () => {
      const options = (await http().get('/v1/admin/agents').set(bearer(admin)).expect(200)).body as AdminAgentOption[];
      const l = await created();
      const res = (await act(l.id, 'publish').expect(200)).body as AdminListing;
      expect(res.status).toBe('approved');
      expect(res.agent?.id).toBe(options[0]!.id);
      expect(res.publishedAt).not.toBeNull();
      expect((await publicIds())[0]).toBe(l.id);
      const detail = (await http().get(`/v1/properties/${l.id}`).expect(200)).body as Record<string, unknown>;
      // The owner stays private.
      expect(detail).not.toHaveProperty('ownerName');
      expect(detail).not.toHaveProperty('ownerPhone');
    });

    it('takes the advisor the admin picks, but not an unknown or inactive one', async () => {
      const options = (await http().get('/v1/admin/agents').set(bearer(admin)).expect(200)).body as AdminAgentOption[];
      const pick = options[options.length - 1]!;
      const l = await created();
      await act(l.id, 'publish', { agentId: 999999 }).expect(400);
      await db.update(agents).set({ active: false }).where(eq(agents.userId, pick.id));
      await act(l.id, 'publish', { agentId: pick.id }).expect(400);
      await db.update(agents).set({ active: true }).where(eq(agents.userId, pick.id));
      expect(((await act(l.id, 'publish', { agentId: pick.id }).expect(200)).body as AdminListing).agent?.id).toBe(pick.id);
    });

    it('unpublishes, publishes again, then closes as sold; wrong moves are refused', async () => {
      const l = await created();
      await act(l.id, 'unpublish').expect(409);
      await act(l.id, 'close').expect(409);
      await act(l.id, 'publish').expect(200);
      await act(l.id, 'publish').expect(409);
      expect(((await act(l.id, 'unpublish').expect(200)).body as AdminListing).status).toBe('unpublished');
      expect(await publicIds()).not.toContain(l.id);
      await act(l.id, 'publish').expect(200);
      expect(((await act(l.id, 'close').expect(200)).body as AdminListing).status).toBe('sold');
      expect(await publicIds()).not.toContain(l.id);
      await act(l.id, 'close').expect(409);
      await act(999999, 'publish').expect(404);
    });

    it('closes a home to rent as rented', async () => {
      const l = await created({ category: 'rent', price: 45_000 });
      await act(l.id, 'publish').expect(200);
      expect(((await act(l.id, 'close').expect(200)).body as AdminListing).status).toBe('rented');
    });
  });

  describe('editing', () => {
    it('changes fields, replaces the photos and amenities, and keeps the rest', async () => {
      const second = ((await upload(await jpeg(640, 480))).body as UploadResponse).url;
      const l = await created();
      const res = await http()
        .patch(`/v1/admin/listings/${l.id}`)
        .set(bearer(admin))
        .send({ baths: 3, images: [second, photo], features: ['pool'], plan: { downPct: 15, years: 6 }, location: { lat: 30.01, lng: 31.47 } })
        .expect(200);
      expect(res.body as AdminListing).toMatchObject({
        baths: 3,
        beds: 3,
        images: [second, photo],
        cover: second,
        features: ['pool'],
        plan: { downPct: 15, years: 6 },
        location: { lat: 30.01, lng: 31.47 },
        ownerName: 'Hany Adel',
      });
      await http().patch(`/v1/admin/listings/${l.id}`).set(bearer(admin)).send({ images: [] }).expect(400);
      await http().patch('/v1/admin/listings/999999').set(bearer(admin)).send({ baths: 1 }).expect(404);
    });

    it('a new price goes through the price history (and its drop alerts)', async () => {
      const l = await created();
      await act(l.id, 'publish').expect(200);
      const res = await http().patch(`/v1/admin/listings/${l.id}`).set(bearer(admin)).send({ price: 6_900_000 }).expect(200);
      expect(res.body as AdminListing).toMatchObject({ price: 6_900_000, oldPrice: 7_250_000 });
      const history = await db.select().from(priceHistory).where(eq(priceHistory.propertyId, l.id));
      expect(history.map((h) => [h.oldPrice, h.newPrice])).toEqual([[7_250_000, 6_900_000]]);
    });

    it('opens one listing with everything the form edits', async () => {
      const l = await created({ descAr: 'وصف', descEn: 'About', floor: 4 });
      const got = (await http().get(`/v1/admin/listings/${l.id}`).set(bearer(admin)).expect(200)).body as AdminListing;
      expect(got).toMatchObject({ id: l.id, descAr: 'وصف', descEn: 'About', floor: 4, status: 'draft' });
      await http().get('/v1/admin/listings/999999').set(bearer(admin)).expect(404);
    });
  });

  describe('the list', () => {
    it('has every status, newest first, with counts per status, and filters by status and words', async () => {
      const l = await created({ titleEn: 'Searchable penthouse', titleAr: 'بنتهاوس للبحث' });
      const all = await list('?limit=100');
      expect(all.items[0]!.id).toBe(l.id);
      expect(all.counts.draft).toBeGreaterThan(0);
      expect(all.counts.approved).toBeGreaterThan(0);
      expect(all.total).toBe(Object.values(all.counts).reduce((a, b) => a + b, 0));
      const drafts = await list('?status=draft&limit=100');
      expect(drafts.items.every((i) => i.status === 'draft')).toBe(true);
      expect(drafts.total).toBe(all.counts.draft);
      // The counts stay for every status, so the chips keep their numbers when one is picked.
      expect(drafts.counts).toEqual(all.counts);
      expect((await list('?q=Searchable')).items.map((i) => i.id)).toEqual([l.id]);
      await http().get('/v1/admin/listings?status=pending').set(bearer(admin)).expect(400);
    });
  });
});
