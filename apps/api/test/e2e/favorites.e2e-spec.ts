import type { INestApplication } from '@nestjs/common';
import type { AuthResponse, Page, PropertyCard } from '@maqar/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { favorites } from '../../src/modules/favorites/favorites.schema.js';
import { properties } from '../../src/modules/properties/properties.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 7: saved homes belong to the account, not the phone (contract §8.9, §14).
describe('Saved homes (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let homes: PropertyCard[];
  let client: AuthResponse;
  const http = () => request(app.getHttpServer());

  const save = (token: string, id: number | string) => http().put(`/v1/favorites/${id}`).set(bearer(token));
  const unsave = (token: string, id: number | string) => http().delete(`/v1/favorites/${id}`).set(bearer(token));
  const saved = async (token: string) => (await http().get('/v1/favorites').set(bearer(token)).expect(200)).body as PropertyCard[];
  const savedIds = async (token: string) => (await saved(token)).map((c) => c.id);

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    homes = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items;
  });
  beforeEach(async () => {
    client = await signUp(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('refuses guests', async () => {
    await http().get('/v1/favorites').expect(401);
    await http().put(`/v1/favorites/${homes[0]!.id}`).expect(401);
    await http().delete(`/v1/favorites/${homes[0]!.id}`).expect(401);
  });

  it('is for clients only', async () => {
    const owner = await signUp(app, { role: 'owner' });
    await http().get('/v1/favorites').set(bearer(owner.accessToken)).expect(403);
    await save(owner.accessToken, homes[0]!.id).expect(403);
    await unsave(owner.accessToken, homes[0]!.id).expect(403);
  });

  it('starts empty, then lists a saved home the same way browsing shows it', async () => {
    expect(await saved(client.accessToken)).toEqual([]);
    await save(client.accessToken, homes[0]!.id).expect(204);
    expect(await saved(client.accessToken)).toEqual([homes[0]]);
  });

  it('saving twice does nothing extra and keeps the home in its place', async () => {
    const [a, b] = homes;
    await save(client.accessToken, a!.id).expect(204);
    await save(client.accessToken, b!.id).expect(204);
    await save(client.accessToken, a!.id).expect(204);
    expect(await savedIds(client.accessToken)).toEqual([b!.id, a!.id]);
  });

  it('lists the most recently saved first', async () => {
    const picked = [homes[3]!.id, homes[0]!.id, homes[7]!.id];
    for (const id of picked) await save(client.accessToken, id).expect(204);
    expect(await savedIds(client.accessToken)).toEqual([...picked].reverse());
  });

  it('removes a home, and removing it again does nothing', async () => {
    await save(client.accessToken, homes[0]!.id).expect(204);
    await unsave(client.accessToken, homes[0]!.id).expect(204);
    await unsave(client.accessToken, homes[0]!.id).expect(204);
    expect(await saved(client.accessToken)).toEqual([]);
  });

  it('keeps each list to its owner', async () => {
    const other = await signUp(app);
    await save(client.accessToken, homes[0]!.id).expect(204);
    await save(other.accessToken, homes[1]!.id).expect(204);
    await unsave(other.accessToken, homes[0]!.id).expect(204);
    expect(await savedIds(client.accessToken)).toEqual([homes[0]!.id]);
    expect(await savedIds(other.accessToken)).toEqual([homes[1]!.id]);
  });

  it('stays saved on another device: a new sign-in sees the same list', async () => {
    const email = `saved-${Date.now()}@test.maqar`;
    const first = await signUp(app, { email });
    await save(first.accessToken, homes[2]!.id).expect(204);
    const second = (await http().post('/v1/auth/sign-in').send({ email, password: 'Secret123' }).expect(200)).body as AuthResponse;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(await savedIds(second.accessToken)).toEqual([homes[2]!.id]);
  });

  it('answers 404 for a home that does not exist and 400 for a bad id', async () => {
    await save(client.accessToken, 999_999).expect(404);
    await save(client.accessToken, 'abc').expect(400);
    await unsave(client.accessToken, 'abc').expect(400);
  });

  describe('a listing that is no longer approved', () => {
    const setStatus = (id: number, status: 'approved' | 'draft') => db.update(properties).set({ status }).where(eq(properties.id, id));
    const id = () => homes[4]!.id;
    afterEach(() => setStatus(id(), 'approved'));

    it('cannot be saved', async () => {
      await setStatus(id(), 'draft');
      await save(client.accessToken, id()).expect(404);
    });

    it('leaves the list and comes back with its approval, and can be removed meanwhile', async () => {
      await save(client.accessToken, id()).expect(204);
      await setStatus(id(), 'draft');
      expect(await saved(client.accessToken)).toEqual([]);
      await setStatus(id(), 'approved');
      expect(await savedIds(client.accessToken)).toEqual([id()]);
      await setStatus(id(), 'draft');
      await unsave(client.accessToken, id()).expect(204);
      await setStatus(id(), 'approved');
      expect(await saved(client.accessToken)).toEqual([]);
    });
  });

  it('deleting the account deletes its saved homes', async () => {
    await save(client.accessToken, homes[0]!.id).expect(204);
    await http().delete('/v1/me').set(bearer(client.accessToken)).send({ password: 'Secret123' }).expect(204);
    expect(await db.select().from(favorites).where(eq(favorites.userId, client.user.id))).toEqual([]);
  });
});
