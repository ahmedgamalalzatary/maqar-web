import type { INestApplication } from '@nestjs/common';
import type { AdminViewingItem, AdminViewingsPage, NotificationsResponse, Page, PropertyCard, PropertyDetail, SlotsResponse, ViewingItem } from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { viewings } from '../../src/modules/viewings/viewings.schema.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 23: admins see every viewing and can move or cancel one.
describe('Admin viewings (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let admin: string;
  let agent: string;
  let omarId: number;
  let omarHomes: PropertyCard[] = [];
  const http = () => request(app.getHttpServer());
  const as = (token = admin) => bearer(token);

  const list = async (q = '') => (await http().get(`/v1/admin/viewings${q}`).set(as()).expect(200)).body as AdminViewingsPage;
  const freeTimes = async (homeId: number, reschedule?: number) => {
    const days = ((await http().get(`/v1/properties/${homeId}/slots${reschedule ? `?reschedule=${reschedule}` : ''}`).expect(200)).body as SlotsResponse).days;
    return days.slice(2).flatMap((d) => d.slots.filter((s) => s.state === 'free').map((s) => ({ date: d.date, time: s.time })));
  };
  const book = async (token: string, home: PropertyCard, nth = 0) => {
    const at = (await freeTimes(home.id))[nth]!;
    return (await http().post('/v1/viewings').set(as(token)).send({ propertyId: home.id, ...at, reminders: ['1d'] }).expect(201)).body as ViewingItem;
  };
  const inbox = async (token: string) => ((await http().get('/v1/notifications').set(as(token)).expect(200)).body as NotificationsResponse).items;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    agent = await signInSeeded(app, 'omar@maqar.app');
    omarId = ((await http().get('/v1/me').set(as(agent)).expect(200)).body as { id: number }).id;
    const homes = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((h) => h.category !== 'stay');
    for (const h of homes) {
      const d = (await http().get(`/v1/properties/${h.id}`).expect(200)).body as PropertyDetail;
      if (d.agent.id === omarId) omarHomes.push(h);
    }
    omarHomes = omarHomes.slice(0, 3);
  });
  afterAll(async () => {
    await app.close();
  });

  it('is for admins only', async () => {
    const c = await signUp(app);
    await http().get('/v1/admin/viewings').expect(401);
    for (const token of [c.accessToken, agent]) {
      await http().get('/v1/admin/viewings').set(as(token)).expect(403);
      await http().patch('/v1/admin/viewings/1').set(as(token)).send({ action: 'cancel' }).expect(403);
    }
  });

  it('lists upcoming viewings soonest first with the client, home and advisor, and filters them', async () => {
    const a = await signUp(app, { name: 'Laila Upcoming' });
    const b = await signUp(app, { name: 'Hazem Later' });
    const va = await book(a.accessToken, omarHomes[0]!, 0);
    const vb = await book(b.accessToken, omarHomes[1]!, 3);
    // One in the past, written directly (the API never books the past).
    await db.insert(viewings).values({ propertyId: omarHomes[2]!.id, clientId: a.user.id, agentId: omarId, startsAt: new Date(Date.now() - 3 * 86_400_000), status: 'completed' });

    const upcoming = await list();
    const ids = upcoming.items.map((i) => i.id);
    expect(ids.indexOf(va.id)).toBeLessThan(ids.indexOf(vb.id));
    const row = upcoming.items.find((i) => i.id === va.id)!;
    expect(row).toMatchObject({ status: 'confirmed', property: { id: omarHomes[0]!.id }, agent: { id: omarId }, client: { id: a.user.id, name: 'Laila Upcoming' } });
    expect(upcoming.items.every((i) => Date.parse(i.startsAt) > Date.now())).toBe(true);

    const past = await list('?when=past');
    expect(past.items.some((i) => i.client?.id === a.user.id && i.status === 'completed')).toBe(true);
    expect(past.items.every((i) => Date.parse(i.startsAt) <= Date.now())).toBe(true);

    expect((await list('?q=hazem')).items.map((i) => i.id)).toEqual([vb.id]);
    expect((await list(`?agentId=${omarId}`)).items.map((i) => i.id)).toEqual(expect.arrayContaining([va.id, vb.id]));
    expect((await list('?status=cancelled')).items).toEqual([]);
    expect((await list(`?from=${va.date}&to=${va.date}`)).items.map((i) => i.id)).toContain(va.id);
    await http().get('/v1/admin/viewings?from=12-11-2026').set(as()).expect(400);
  });

  it('moves a viewing to a free time of the same advisor, telling the client and the advisor why', async () => {
    const c = await signUp(app);
    const v = await book(c.accessToken, omarHomes[0]!, 6);
    const to = (await freeTimes(omarHomes[0]!.id, v.id)).find((s) => s.date !== v.date || s.time !== v.time)!;
    const res = (await http().patch(`/v1/admin/viewings/${v.id}`).set(as()).send({ action: 'reschedule', ...to, reason: 'The owner is away that day' }).expect(200)).body as AdminViewingItem;
    expect(res).toMatchObject({ status: 'rescheduled', date: to.date, time: to.time, rescheduledFrom: { date: v.date, time: v.time } });
    const [clientNote] = await inbox(c.accessToken);
    expect(clientNote).toMatchObject({ titleEn: 'Viewing rescheduled' });
    expect(clientNote!.bodyEn).toContain('The owner is away that day');
    expect((await inbox(agent))[0]!.titleEn).toBe('A viewing was moved');
    // The client still sees it, with its reminder.
    const mine = ((await http().get('/v1/viewings').set(as(c.accessToken)).expect(200)).body as ViewingItem[]).find((x) => x.id === v.id)!;
    expect(mine.reminders).toEqual(['1d']);
  });

  it('refuses a time that is taken or cannot be booked', async () => {
    const [c1, c2] = [await signUp(app), await signUp(app)];
    const v1 = await book(c1.accessToken, omarHomes[1]!, 8);
    const v2 = await book(c2.accessToken, omarHomes[2]!, 9);
    await http().patch(`/v1/admin/viewings/${v2.id}`).set(as()).send({ action: 'reschedule', date: v1.date, time: v1.time }).expect(409);
    await http().patch(`/v1/admin/viewings/${v2.id}`).set(as()).send({ action: 'reschedule', date: '2020-01-01', time: '11:00' }).expect(400);
    await http().patch(`/v1/admin/viewings/${v2.id}`).set(as()).send({ action: 'reschedule', date: v2.date }).expect(400);
    await http().patch('/v1/admin/viewings/999999').set(as()).send({ action: 'cancel' }).expect(404);
  });

  it('cancels with a reason, freeing the hour; a cancelled viewing cannot change again', async () => {
    const c = await signUp(app);
    const v = await book(c.accessToken, omarHomes[0]!, 10);
    expect((await freeTimes(omarHomes[0]!.id)).some((s) => s.date === v.date && s.time === v.time)).toBe(false);
    const res = (await http().patch(`/v1/admin/viewings/${v.id}`).set(as()).send({ action: 'cancel', reason: 'The home was sold' }).expect(200)).body as AdminViewingItem;
    expect(res.status).toBe('cancelled');
    expect((await freeTimes(omarHomes[0]!.id)).some((s) => s.date === v.date && s.time === v.time)).toBe(true);
    const [note] = await inbox(c.accessToken);
    expect(note).toMatchObject({ titleEn: 'Viewing cancelled' });
    expect(note!.bodyAr).toContain('The home was sold');
    await http().patch(`/v1/admin/viewings/${v.id}`).set(as()).send({ action: 'cancel' }).expect(409);
  });
});
