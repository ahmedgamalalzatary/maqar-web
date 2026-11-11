import type { INestApplication } from '@nestjs/common';
import type { InterestedClient, ListingStats, Page, PropertyCard, PropertyDetail, SlotsResponse } from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { cairoClock } from '../../src/modules/viewings/slots.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

const ALL_DAY = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, from: 0, to: 23 }));

// Phase 19: per listing, daily views, saves and new interested clients, and who they are (contract §11).
describe('Listing insights (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let homes: PropertyCard[];
  const http = () => request(app.getHttpServer());
  const as = (token = admin) => bearer(token);
  const today = () => cairoClock(new Date()).date;
  const stats = async (id: number, q = '') => (await http().get(`/v1/admin/listings/${id}/stats${q}`).set(as()).expect(200)).body as ListingStats;
  const interested = async (id: number) => (await http().get(`/v1/admin/listings/${id}/interested`).set(as()).expect(200)).body as InterestedClient[];
  const todayOf = (s: ListingStats) => s.days[s.days.length - 1]!;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    homes = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((c) => c.category !== 'stay');
  });
  afterAll(async () => {
    await app.close();
  });

  it('is for admins only, and 404 for a listing that does not exist', async () => {
    const client = (await signUp(app)).accessToken;
    const agent = await signInSeeded(app, 'omar@maqar.app');
    for (const path of [`/v1/admin/listings/${homes[0]!.id}/stats`, `/v1/admin/listings/${homes[0]!.id}/interested`]) {
      await http().get(path).expect(401);
      await http().get(path).set(as(client)).expect(403);
      await http().get(path).set(as(agent)).expect(403);
    }
    await http().get('/v1/admin/listings/999999/stats').set(as()).expect(404);
    await http().get('/v1/admin/listings/999999/interested').set(as()).expect(404);
  });

  it('gives one entry per Cairo day, ending today: 30 by default, or 7 or 90', async () => {
    const id = homes[0]!.id;
    const s = await stats(id);
    expect(s.days).toHaveLength(30);
    expect(todayOf(s).day).toBe(today());
    expect(new Set(s.days.map((d) => d.day)).size).toBe(30);
    expect((await stats(id, '?days=7')).days).toHaveLength(7);
    expect((await stats(id, '?days=90')).days).toHaveLength(90);
    await http().get(`/v1/admin/listings/${id}/stats?days=5`).set(as()).expect(400);
  });

  it('counts each property page view on today, and in the all-time total', async () => {
    const id = homes[1]!.id;
    const client = (await signUp(app)).accessToken;
    const before = await stats(id);
    await http().get(`/v1/properties/${id}`).expect(200);
    await http().get(`/v1/properties/${id}`).set(as(client)).expect(200);
    await http().get(`/v1/properties/compare?ids=${id}`).expect(200);
    const after = await stats(id);
    expect(todayOf(after).views).toBe(todayOf(before).views + 2);
    expect(after.totals.views).toBe(before.totals.views + 2);
  });

  it('counts a save once on the day it is made; the total is who has it saved now', async () => {
    const id = homes[2]!.id;
    const a = (await signUp(app)).accessToken;
    const b = (await signUp(app)).accessToken;
    await http().put(`/v1/favorites/${id}`).set(as(a)).expect(204);
    await http().put(`/v1/favorites/${id}`).set(as(a)).expect(204);
    await http().put(`/v1/favorites/${id}`).set(as(b)).expect(204);
    await http().delete(`/v1/favorites/${id}`).set(as(b)).expect(204);
    const s = await stats(id);
    expect(todayOf(s).saves).toBe(2);
    expect(s.totals.saves).toBe(1);
  });

  it('lists each client who saved, followed, chatted or booked once, with what they did, and counts them as new today', async () => {
    const home = homes[3]!;
    const detail = (await http().get(`/v1/properties/${home.id}`).expect(200)).body as PropertyDetail;
    await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [detail.agent.id], hours: ALL_DAY }).expect(204);
    const saver = await signUp(app, { name: 'Saver' });
    await http().patch('/v1/me').set(as(saver.accessToken)).send({ phone: '01001234567' }).expect(200);
    const chatter = await signUp(app, { name: 'Chatter' });
    const booker = await signUp(app, { name: 'Booker' });

    await http().put(`/v1/favorites/${home.id}`).set(as(saver.accessToken)).expect(204);
    await http().put(`/v1/alerts/${home.id}`).set(as(saver.accessToken)).expect(204);
    // Chatting means sending a message: opening an empty conversation is not interest (INS-04).
    const thread = (await http().post('/v1/chats').set(as(chatter.accessToken)).send({ propertyId: home.id }).expect(201)).body as { id: number };
    expect((await interested(home.id)).map((c) => c.name)).not.toContain('Chatter');
    await http().post(`/v1/chats/${thread.id}/messages`).set(as(chatter.accessToken)).send({ kind: 'text', text: 'Is it still available?' }).expect(201);
    const day = ((await http().get(`/v1/properties/${home.id}/slots`).expect(200)).body as SlotsResponse).days[2]!;
    await http().post('/v1/viewings').set(as(booker.accessToken)).send({ propertyId: home.id, date: day.date, time: '11:00', reminders: [] }).expect(201);

    const list = await interested(home.id);
    expect(list.map((c) => c.name)).toEqual(['Booker', 'Chatter', 'Saver']);
    expect(list.find((c) => c.name === 'Saver')).toMatchObject({ kinds: ['saved', 'followed'], phone: expect.stringContaining('1001234567') });
    expect(list.find((c) => c.name === 'Chatter')!.kinds).toEqual(['chatted']);
    expect(list.find((c) => c.name === 'Booker')!.kinds).toEqual(['booked']);
    for (const c of list) expect(Date.parse(c.lastAt)).toBeGreaterThanOrEqual(Date.parse(c.firstAt));

    const s = await stats(home.id);
    expect(todayOf(s).interested).toBe(3);
    expect(s.totals).toMatchObject({ interested: 3, saves: 1, followers: 1, chats: 1, viewings: 1 });

    // A deleted account leaves the list; what it did that day stays in the day's counts.
    await http().delete('/v1/me').set(as(chatter.accessToken)).send({ password: 'Secret123' }).expect(204);
    expect((await interested(home.id)).map((c) => c.name)).toEqual(['Booker', 'Saver']);
    expect(todayOf(await stats(home.id)).saves).toBe(1);
  });

  it('has no interested clients for a listing nobody saved, followed, chatted about or booked', async () => {
    expect(await interested(homes[5]!.id)).toEqual([]);
    expect((await stats(homes[5]!.id)).totals.interested).toBe(0);
  });
});
