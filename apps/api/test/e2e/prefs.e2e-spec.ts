import type { INestApplication } from '@nestjs/common';
import {
  DEFAULT_PREFS,
  GOOD_MATCH,
  type Me,
  matchScore,
  type Page,
  type Prefs,
  type PropertyCard,
  type PropertyDetail,
} from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { clientPrefs } from '../../src/modules/users/users.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 6: preferences, the match score on the server, best-match sort and picks (contract §8.1, §8.3).
// The server scores in SQL; every expected score here comes from the shared matchScore.
describe('Preferences and smart picks (e2e)', () => {
  let app: INestApplication<App>;
  let client: string;
  let agent: string;
  let details: PropertyDetail[];
  const http = () => request(app.getHttpServer());

  const renter: Prefs = { purpose: ['rent', 'stay'], budgetMax: 60_000, areas: ['new-cairo', 'zayed'], types: ['apartment'], beds: 2, interests: ['pool', 'gym'] };
  const buyer: Prefs = { purpose: ['sale', 'project'], budgetMax: 8_000_000, areas: ['north-coast'], types: ['chalet', 'villa'], beds: 3, interests: ['sea', 'pool', 'garden', 'smart'] };

  /** What the shared rules say, in the server's order: score, then newest. */
  const expected = (prefs: Prefs, of = details) =>
    of
      .map((d) => ({
        d,
        m: matchScore({ ...d, features: d.features, plan: d.plan !== null }, prefs),
      }))
      .sort((a, b) => b.m.score - a.m.score || b.d.publishedAt.localeCompare(a.d.publishedAt) || b.d.id - a.d.id);

  const putPrefs = (token: string, body: unknown) => http().put('/v1/me/prefs').set(bearer(token)).send(body as object);
  const byMatch = async (token: string, query = '') =>
    (await http().get(`/v1/properties?sort=match&limit=50&${query}`).set(bearer(token)).expect(200)).body as Page<PropertyCard>;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    client = (await signUp(app)).accessToken;
    agent = await signInSeeded(app, 'omar@maqar.app');
    const all = (await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>;
    details = await Promise.all(all.items.map(async (c) => (await http().get(`/v1/properties/${c.id}`).expect(200)).body as PropertyDetail));
  });
  afterAll(async () => {
    await app.close();
  });

  describe('PUT /me/prefs', () => {
    it('starts with no preferences, saves them and shows them on /me', async () => {
      const fresh = await signUp(app);
      expect(fresh.user.prefs).toBeNull();
      const res = await putPrefs(fresh.accessToken, renter).expect(200);
      expect(res.body).toEqual(renter);
      const me = (await http().get('/v1/me').set(bearer(fresh.accessToken)).expect(200)).body as Me;
      expect(me.prefs).toEqual(renter);
    });

    it('comes back on sign-in, so the app knows them after a restart', async () => {
      const email = `prefs-${Date.now()}@test.maqar`;
      const fresh = await signUp(app, { email, password: 'Secret123' });
      await putPrefs(fresh.accessToken, renter).expect(200);
      const res = await http().post('/v1/auth/sign-in').send({ email, password: 'Secret123' }).expect(200);
      expect(res.body.user.prefs).toEqual(renter);
    });

    it('replaces the saved preferences whole', async () => {
      const fresh = await signUp(app);
      await putPrefs(fresh.accessToken, renter).expect(200);
      await putPrefs(fresh.accessToken, { ...DEFAULT_PREFS, areas: ['zayed', 'zayed'] }).expect(200);
      const me = (await http().get('/v1/me').set(bearer(fresh.accessToken)).expect(200)).body as Me;
      // Repeated values are kept once.
      expect(me.prefs).toEqual({ ...DEFAULT_PREFS, areas: ['zayed'] });
    });

    it('needs a signed-in client', async () => {
      await http().put('/v1/me/prefs').send(renter).expect(401);
      await putPrefs(agent, renter).expect(403);
      const me = (await http().get('/v1/me').set(bearer(agent)).expect(200)).body as Me;
      expect(me).not.toHaveProperty('prefs');
    });

    it.each([
      ['no purpose', { purpose: [] }],
      ['an unknown purpose', { purpose: ['buy'] }],
      ['a budget of 0', { budgetMax: 0 }],
      ['a fractional budget', { budgetMax: 1.5 }],
      ['an unknown unit type', { types: ['castle'] }],
      ['an unknown must-have', { interests: ['helipad'] }],
      ['more than 5 bedrooms', { beds: 6 }],
      ['negative bedrooms', { beds: -1 }],
      ['an area that does not exist', { areas: ['atlantis'] }],
      ['a missing field', { interests: undefined }],
      ['an extra field', { name: 'x' }],
    ])('refuses %s', async (_name, change) => {
      await putPrefs(client, { ...renter, ...change }).expect(400);
    });
  });

  describe('best match', () => {
    it('orders every listing as the shared rules score it, with scores and reasons', async () => {
      await putPrefs(client, renter).expect(200);
      const page = await byMatch(client);
      const want = expected(renter);
      expect(page.total).toBe(details.length);
      expect(page.items.map((c) => c.id)).toEqual(want.map((w) => w.d.id));
      expect(page.items.map((c) => c.match)).toEqual(want.map((w) => w.m));
    });

    it('follows a change of preferences', async () => {
      await putPrefs(client, buyer).expect(200);
      const page = await byMatch(client);
      expect(page.items.map((c) => c.match)).toEqual(expected(buyer).map((w) => w.m));
      expect(page.items[0].id).toBe(expected(buyer)[0].d.id);
    });

    it('works with filters and pages', async () => {
      await putPrefs(client, renter).expect(200);
      const rent = details.filter((d) => d.category === 'rent');
      const first = (await http().get('/v1/properties?sort=match&category=rent&limit=2&page=1').set(bearer(client)).expect(200)).body as Page<PropertyCard>;
      const second = (await http().get('/v1/properties?sort=match&category=rent&limit=2&page=2').set(bearer(client)).expect(200)).body as Page<PropertyCard>;
      expect(first.total).toBe(rent.length);
      expect([...first.items, ...second.items].map((c) => c.id)).toEqual(expected(renter, rent).slice(0, 4).map((w) => w.d.id));
    });

    it('scores a client who skipped onboarding with the default preferences', async () => {
      const fresh = await signUp(app);
      const page = await byMatch(fresh.accessToken);
      expect(page.items.map((c) => c.match)).toEqual(expected(DEFAULT_PREFS).map((w) => w.m));
    });

    it('needs a signed-in client; other sorts carry no match', async () => {
      await http().get('/v1/properties?sort=match').expect(401);
      await http().get('/v1/properties?sort=match').set(bearer(agent)).expect(403);
      // A bad token on a public route is ignored for other sorts, but match needs the account.
      await http().get('/v1/properties?sort=match').set(bearer('nope')).expect(401);
      const plain = (await http().get('/v1/properties').set(bearer(client)).expect(200)).body as Page<PropertyCard>;
      expect(plain.items[0]).not.toHaveProperty('match');
      await http().get('/v1/properties').set(bearer('nope')).expect(200);
    });
  });

  describe('GET /properties/recommended', () => {
    it('gives the 6 best picks with reasons', async () => {
      await putPrefs(client, buyer).expect(200);
      const res = await http().get('/v1/properties/recommended').set(bearer(client)).expect(200);
      const picks = res.body as PropertyCard[];
      const want = expected(buyer).slice(0, 6);
      expect(picks.map((c) => c.id)).toEqual(want.map((w) => w.d.id));
      expect(picks.map((c) => c.match)).toEqual(want.map((w) => w.m));
      expect(picks[0].match!.reasons.length).toBeGreaterThan(0);
    });

    it('needs a signed-in client', async () => {
      await http().get('/v1/properties/recommended').expect(401);
      await http().get('/v1/properties/recommended').set(bearer(agent)).expect(403);
    });
  });

  describe('GET /properties/match-count (onboarding)', () => {
    const query = (p: Prefs) =>
      new URLSearchParams({
        purpose: p.purpose.join(','),
        budgetMax: String(p.budgetMax),
        ...(p.areas.length && { area: p.areas.join(',') }),
        ...(p.types.length && { type: p.types.join(',') }),
        beds: String(p.beds),
        ...(p.interests.length && { interest: p.interests.join(',') }),
      });

    it.each([
      ['a renter', renter],
      ['a buyer', buyer],
      ['the defaults', DEFAULT_PREFS],
    ])('counts the good matches (70+) for %s', async (_name, prefs) => {
      const res = await http().get(`/v1/properties/match-count?${query(prefs)}`).expect(200);
      expect(res.body).toEqual({ count: expected(prefs).filter((w) => w.m.score >= GOOD_MATCH).length });
    });

    it('refuses bad preferences', async () => {
      await http().get('/v1/properties/match-count?budgetMax=1000').expect(400);
      await http().get('/v1/properties/match-count?purpose=sale&budgetMax=0').expect(400);
      await http().get('/v1/properties/match-count?purpose=sale&budgetMax=1000&type=castle').expect(400);
    });
  });

  it('deleting the account deletes its preferences', async () => {
    const fresh = await signUp(app);
    await putPrefs(fresh.accessToken, renter).expect(200);
    await http().delete('/v1/me').set(bearer(fresh.accessToken)).send({ password: 'Secret123' }).expect(204);
    const db = app.get<Db>(DB);
    const rows = await db.select().from(clientPrefs);
    expect(rows.map((r) => r.userId)).not.toContain(fresh.user.id);
  });
});
