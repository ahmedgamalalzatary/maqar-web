import type { INestApplication } from '@nestjs/common';
import type { AuthResponse, NotificationsResponse, Page, PropertyCard, PropertyDetail } from '@maqar/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { type MemoryPushSender, PushSender } from '../../src/modules/notifications/push.sender.js';
import { priceAlerts, priceHistory } from '../../src/modules/prices/prices.schema.js';
import { properties } from '../../src/modules/properties/properties.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 12: following a home's price, and telling followers when it drops (contract §8.9).
describe('Price drop alerts (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let push: MemoryPushSender;
  let admin: string;
  let home: PropertyCard;
  let client: AuthResponse;
  const http = () => request(app.getHttpServer());

  const follow = (token: string, id: number | string) => http().put(`/v1/alerts/${id}`).set(bearer(token));
  const unfollow = (token: string, id: number | string) => http().delete(`/v1/alerts/${id}`).set(bearer(token));
  const followed = async (token: string) => ((await http().get('/v1/alerts').set(bearer(token)).expect(200)).body as PropertyCard[]).map((c) => c.id);
  const setPrice = (id: number, price: number, token = admin) => http().patch(`/v1/admin/listings/${id}/price`).set(bearer(token)).send({ price });
  const inbox = async (token: string) =>
    (await http().get('/v1/notifications').set(bearer(token)).expect(200)).body as NotificationsResponse;
  const card = async (id: number) => (await http().get(`/v1/properties/${id}`).expect(200)).body as PropertyDetail;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    push = app.get(PushSender) as MemoryPushSender;
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items;
    // A home with no old price yet, not a stay (stays are priced per night).
    home = all.find((c) => c.oldPrice === null && c.category === 'sale')!;
  });
  beforeEach(async () => {
    client = await signUp(app);
    push.sent.length = 0;
    // Each test starts from the seeded price.
    await db.update(properties).set({ price: home.price, oldPrice: null }).where(eq(properties.id, home.id));
  });
  afterAll(async () => {
    await app.close();
  });

  it('refuses guests, and is for clients only', async () => {
    await http().get('/v1/alerts').expect(401);
    await http().put(`/v1/alerts/${home.id}`).expect(401);
    const agent = await signInSeeded(app, 'omar@maqar.app');
    await http().get('/v1/alerts').set(bearer(agent)).expect(403);
    await follow(agent, home.id).expect(403);
  });

  it('follows, lists the newest first, and unfollows; twice changes nothing', async () => {
    const other = (await http().get('/v1/properties?limit=50').expect(200)).body.items[1] as PropertyCard;
    expect(await followed(client.accessToken)).toEqual([]);
    await follow(client.accessToken, home.id).expect(204);
    await follow(client.accessToken, other.id).expect(204);
    await follow(client.accessToken, home.id).expect(204);
    expect(await followed(client.accessToken)).toEqual([other.id, home.id]);
    await unfollow(client.accessToken, home.id).expect(204);
    await unfollow(client.accessToken, home.id).expect(204);
    expect(await followed(client.accessToken)).toEqual([other.id]);
  });

  it('will not follow a missing home, or a stay (priced per night)', async () => {
    await follow(client.accessToken, 999999).expect(404);
    await follow(client.accessToken, 'abc').expect(400);
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items;
    const stay = all.find((c) => c.category === 'stay')!;
    await follow(client.accessToken, stay.id).expect(400);
    expect(await followed(client.accessToken)).toEqual([]);
  });

  it('a drop notifies everyone following the home, in the app and on the phone', async () => {
    const other = await signUp(app);
    const notFollowing = await signUp(app);
    await follow(client.accessToken, home.id).expect(204);
    await follow(other.accessToken, home.id).expect(204);
    await http()
      .post('/v1/me/push-tokens')
      .set(bearer(client.accessToken))
      .send({ token: 'ExponentPushToken[prices-phone-1234]', platform: 'android' })
      .expect(204);

    const newPrice = Math.round(home.price * 0.95);
    const res = await setPrice(home.id, newPrice).expect(200);
    expect(res.body).toEqual({ price: newPrice, oldPrice: home.price });

    for (const who of [client, other]) {
      const { items } = await inbox(who.accessToken);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ kind: 'price', titleEn: 'Price dropped 5%', href: `/property/${home.id}`, read: false });
      expect(items[0]!.bodyEn).toContain(home.titleEn);
    }
    expect((await inbox(notFollowing.accessToken)).items).toEqual([]);
    expect(push.sent.map((m) => m.title)).toEqual(['السعر نزل ٥٪']);
  });

  it('shows the old price and finds the home under "price dropped"', async () => {
    await setPrice(home.id, home.price - 500_000).expect(200);
    const p = await card(home.id);
    expect([p.price, p.oldPrice]).toEqual([home.price - 500_000, home.price]);
    const dropped = ((await http().get('/v1/properties?dropped=true&limit=50').expect(200)).body as Page<PropertyCard>).items;
    expect(dropped.map((c) => c.id)).toContain(home.id);
  });

  it('a rise notifies no one, and clears the old price once back up', async () => {
    await follow(client.accessToken, home.id).expect(204);
    await setPrice(home.id, home.price - 1_000_000).expect(200);
    await setPrice(home.id, home.price - 500_000).expect(200);
    expect((await card(home.id)).oldPrice).toBe(home.price);
    await setPrice(home.id, home.price).expect(200);
    expect((await card(home.id)).oldPrice).toBeNull();
    expect((await inbox(client.accessToken)).items).toHaveLength(1);
  });

  it('unfollowing stops the alerts', async () => {
    await follow(client.accessToken, home.id).expect(204);
    await unfollow(client.accessToken, home.id).expect(204);
    await setPrice(home.id, home.price - 1_000_000).expect(200);
    expect((await inbox(client.accessToken)).items).toEqual([]);
  });

  it('writes every change to the price history, with who made it; the same price writes nothing', async () => {
    const before = (await db.select().from(priceHistory).where(eq(priceHistory.propertyId, home.id))).length;
    await setPrice(home.id, home.price - 100_000).expect(200);
    await setPrice(home.id, home.price - 100_000).expect(200);
    await setPrice(home.id, home.price).expect(200);
    const rows = (await db.select().from(priceHistory).where(eq(priceHistory.propertyId, home.id))).slice(before);
    const me = (await http().get('/v1/me').set(bearer(admin)).expect(200)).body as { id: number };
    expect(rows.map((r) => [r.oldPrice, r.newPrice, r.changedBy])).toEqual([
      [home.price, home.price - 100_000, me.id],
      [home.price - 100_000, home.price, me.id],
    ]);
  });

  it('tells no one about a drop on a listing that is not live', async () => {
    await follow(client.accessToken, home.id).expect(204);
    await db.update(properties).set({ status: 'unpublished' }).where(eq(properties.id, home.id));
    try {
      await setPrice(home.id, home.price - 1_000_000).expect(200);
      expect((await inbox(client.accessToken)).items).toEqual([]);
    } finally {
      await db.update(properties).set({ status: 'approved' }).where(eq(properties.id, home.id));
    }
  });

  it('only an admin changes a price, to a whole positive number, of a listing that exists', async () => {
    await setPrice(home.id, 1, client.accessToken).expect(403);
    await setPrice(home.id, 1, await signInSeeded(app, 'omar@maqar.app')).expect(403);
    await http().patch(`/v1/admin/listings/${home.id}/price`).send({ price: 1 }).expect(401);
    await setPrice(home.id, 0).expect(400);
    await setPrice(home.id, 1.5).expect(400);
    await setPrice(999999, 1_000_000).expect(404);
    expect((await card(home.id)).price).toBe(home.price);
  });

  it('forgets the alerts of a deleted account', async () => {
    await follow(client.accessToken, home.id).expect(204);
    await http().delete('/v1/me').set(bearer(client.accessToken)).send({ password: 'Secret123' }).expect(204);
    expect(await db.select().from(priceAlerts).where(eq(priceAlerts.userId, client.user.id))).toEqual([]);
  });
});
