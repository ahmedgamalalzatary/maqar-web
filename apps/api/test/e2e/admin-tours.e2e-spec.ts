import type { INestApplication } from '@nestjs/common';
import type { AdminListing, ListingBody, PropertyDetail, TourRoomBody, UploadResponse } from '@maqar/shared';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 21: admins upload a listing's 360° tour, one panorama per room.
describe('Admin 360° tours (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let agent: string;
  let client: string;
  let photo: string;
  const http = () => request(app.getHttpServer());

  const jpeg = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: { r: 120, g: 150, b: 170 } } }).jpeg().toBuffer();
  const uploadPano = (buf: Buffer, token = admin, type = 'image/jpeg') =>
    http().post('/v1/uploads/panoramas').set(bearer(token)).attach('pano', buf, { filename: 'room.jpg', contentType: type });
  const pano = async () => ((await uploadPano(await jpeg(4096, 2048)).expect(201)).body as UploadResponse).url;

  const body = (over: Partial<ListingBody> = {}): ListingBody => ({
    category: 'sale',
    type: 'apartment',
    areaId: 'new-cairo',
    price: 5_000_000,
    beds: 2,
    baths: 1,
    sizeM2: 120,
    finishing: 'full',
    delivery: 'ready',
    features: [],
    images: [photo],
    ...over,
  });
  const created = async (over: Partial<ListingBody> = {}) =>
    (await http().post('/v1/admin/listings').set(bearer(admin)).send(body(over)).expect(201)).body as AdminListing;
  const setTour = (id: number, tour: unknown) => http().patch(`/v1/admin/listings/${id}`).set(bearer(admin)).send({ tour });
  const room = (pano: string, n: number): TourRoomBody => ({ nameAr: `غرفة ${n}`, nameEn: `Room ${n}`, pano });

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    agent = await signInSeeded(app, 'omar@maqar.app');
    client = (await signUp(app)).accessToken;
    const up = await http().post('/v1/uploads').set(bearer(admin)).attach('photo', await jpeg(800, 600), { filename: 'p.jpg', contentType: 'image/jpeg' });
    photo = (up.body as UploadResponse).url;
  });
  afterAll(async () => {
    await app.close();
  });

  describe('POST /uploads/panoramas', () => {
    it('is for admins only', async () => {
      const buf = await jpeg(4096, 2048);
      await http().post('/v1/uploads/panoramas').attach('pano', buf, { filename: 'room.jpg', contentType: 'image/jpeg' }).expect(401);
      for (const token of [client, agent]) expect((await uploadPano(buf, token)).status).toBe(403);
    });

    it('stores a 2:1 panorama as a 4096×2048 JPEG, scaling a sharper one down, and serves it', async () => {
      for (const [w, h] of [
        [4096, 2048],
        [8192, 4096],
        [4100, 2049],
      ] as const) {
        const res = await uploadPano(await jpeg(w, h));
        expect(res.status).toBe(201);
        const { url } = res.body as UploadResponse;
        expect(url).toMatch(/^\/uploads\/tours\/[0-9a-f-]+\.jpg$/);
        const served = await http().get(url).buffer(true).expect(200);
        const meta = await sharp(served.body as Buffer).metadata();
        expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 4096, 2048]);
      }
    });

    it('refuses no file, a non-JPEG, a photo that is not 2:1, one smaller than 4096×2048, and one over 30 MB', async () => {
      await http().post('/v1/uploads/panoramas').set(bearer(admin)).expect(400);
      const png = await sharp({ create: { width: 4096, height: 2048, channels: 3, background: '#888' } }).png().toBuffer();
      expect((await uploadPano(png, admin, 'image/png')).status).toBe(400);
      expect((await uploadPano(await jpeg(4096, 3072))).status).toBe(400);
      expect((await uploadPano(await jpeg(2048, 1024))).status).toBe(400);
      expect((await uploadPano(Buffer.from('not really a jpeg'))).status).toBe(400);
      expect((await uploadPano(Buffer.alloc(30 * 1024 * 1024 + 1, 1))).status).toBe(413);
    });
  });

  describe('the listing tour', () => {
    it('is saved with the listing in order, and clients see it', async () => {
      const [a, b] = [await pano(), await pano()];
      const l = await created({ tour: [room(a, 1), room(b, 2)] });
      expect(l.tour).toBe(true);
      expect(l.tourRooms.map((r) => [r.nameEn, r.pano])).toEqual([
        ['Room 1', a],
        ['Room 2', b],
      ]);
      await http().post(`/v1/admin/listings/${l.id}/publish`).set(bearer(admin)).expect(200);
      const pub = (await http().get(`/v1/properties/${l.id}`).expect(200)).body as PropertyDetail;
      expect(pub.tour).toBe(true);
      expect(pub.tourRooms.map((r) => r.nameAr)).toEqual(['غرفة 1', 'غرفة 2']);
    });

    it('is replaced as sent, deleting panoramas no room uses any more', async () => {
      const [a, b, c] = [await pano(), await pano(), await pano()];
      const l = await created({ tour: [room(a, 1), room(b, 2)] });
      const res = await setTour(l.id, [room(c, 3), room(a, 1)]).expect(200);
      expect((res.body as AdminListing).tourRooms.map((r) => r.pano)).toEqual([c, a]);
      await http().get(b).expect(404);
      await http().get(a).expect(200);
      // An edit that leaves the tour out keeps it.
      const kept = await http().patch(`/v1/admin/listings/${l.id}`).set(bearer(admin)).send({ price: 5_100_000 }).expect(200);
      expect((kept.body as AdminListing).tourRooms).toHaveLength(2);
    });

    it('an empty list removes the tour', async () => {
      const a = await pano();
      const l = await created({ tour: [room(a, 1)] });
      const res = await setTour(l.id, []).expect(200);
      expect((res.body as AdminListing).tour).toBe(false);
      expect((res.body as AdminListing).tourRooms).toEqual([]);
      await http().get(a).expect(404);
    });

    it('keeps a panorama another listing still uses', async () => {
      const a = await pano();
      const one = await created({ tour: [room(a, 1)] });
      await created({ tour: [room(a, 1)] });
      await setTour(one.id, []).expect(200);
      await http().get(a).expect(200);
    });

    it('takes only panoramas uploaded here (or the seed ones), both names, and at most 12 rooms', async () => {
      const a = await pano();
      const l = await created();
      for (const bad of [
        [room(photo, 1)],
        [room('https://example.com/pano.jpg', 1)],
        [room('/uploads/tours/../listings/x.jpg', 1)],
        [room('/uploads/tours/00000000-0000-0000-0000-000000000000.jpg', 1)],
        [{ nameAr: '', nameEn: 'Room', pano: a }],
        [{ nameAr: 'غرفة', pano: a }],
        Array.from({ length: 13 }, (_, i) => room(a, i)),
        null,
      ]) {
        expect((await setTour(l.id, bad)).status).toBe(400);
      }
      await setTour(l.id, [room('/uploads/seed/pano/hotel_room.jpg', 1)]).expect(200);
    });
  });
});
