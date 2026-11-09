import type { INestApplication } from '@nestjs/common';
import type { AuthResponse, NotificationsResponse, Page, PropertyCard, PropertyDetail, SlotDay, SlotsResponse, ViewingItem } from '@maqar/shared';
import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { agentDaysOff, agentHours } from '../../src/modules/agents/agents.schema.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { leads } from '../../src/modules/leads/leads.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { viewings } from '../../src/modules/viewings/viewings.schema.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

// Phase 13: booking a viewing (contract §8.7, §8.8).
describe('Viewings (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let homes: PropertyCard[];
  let client: AuthResponse;
  const http = () => request(app.getHttpServer());

  const slots = async (id: number, q = '') => (await http().get(`/v1/properties/${id}/slots${q}`).expect(200)).body as SlotsResponse;
  const book = (token: string, body: Record<string, unknown>) => http().post('/v1/viewings').set(bearer(token)).send(body);
  const patch = (token: string, id: number, body: Record<string, unknown>) => http().patch(`/v1/viewings/${id}`).set(bearer(token)).send(body);
  const mine = async (token: string) => (await http().get('/v1/viewings').set(bearer(token)).expect(200)).body as ViewingItem[];
  const inbox = async (token: string) => (await http().get('/v1/notifications').set(bearer(token)).expect(200)).body as NotificationsResponse;
  const stateOf = (days: SlotDay[], date: string, time: string) => days.find((d) => d.date === date)!.slots.find((s) => s.time === time)!.state;

  /** Free hours of a home a few days ahead, never on Friday, so the times exist whenever the tests run. */
  const freeHours = async (id: number, n = 2) => {
    const { days } = await slots(id);
    const day = days.slice(2).find((d) => weekdayOf(d.date) !== 5 && d.slots.filter((s) => s.state === 'free').length >= n)!;
    return day.slots.filter((s) => s.state === 'free').slice(0, n).map((s) => ({ date: day.date, time: s.time }));
  };
  /** A home that is not a stay, each test its own, so their bookings never meet. */
  let next = 0;
  const aHome = () => homes[next++ % homes.length]!;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items;
    homes = all.filter((c) => c.category !== 'stay');
  });
  beforeEach(async () => {
    client = await signUp(app);
  });
  afterAll(async () => {
    await app.close();
  });

  describe('slots', () => {
    it('shows 14 days of hours from 10:00 to 20:00 to anyone, Friday closed before 14:00', async () => {
      const { days, defaultDate } = await slots(homes[0]!.id);
      expect(days).toHaveLength(14);
      expect(days[0]!.slots.map((s) => s.time)).toEqual(['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']);
      const friday = days.slice(1).find((d) => weekdayOf(d.date) === 5)!;
      expect(friday.slots.filter((s) => s.state === 'closed').map((s) => s.time)).toEqual(['10:00', '11:00', '12:00', '13:00']);
      expect(friday.slots.find((s) => s.time === '14:00')!.state).toBe('free');
      expect(days.map((d) => d.date)).toContain(defaultDate);
      // Days follow each other.
      for (let i = 1; i < days.length; i++) expect(Date.parse(days[i]!.date) - Date.parse(days[i - 1]!.date)).toBe(86_400_000);
    });

    it('marks no hour of today as free once it has begun', async () => {
      const { days } = await slots(homes[0]!.id);
      const hourNow = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date()));
      for (const s of days[0]!.slots) if (Number(s.time.slice(0, 2)) <= hourNow) expect(s.state).toBe('past');
    });

    it('follows the agent’s own hours and days off', async () => {
      const home = aHome();
      const detail = (await http().get(`/v1/properties/${home.id}`).expect(200)).body as PropertyDetail;
      const { days } = await slots(home.id);
      const target = days[4]!;
      const wd = weekdayOf(target.date);
      const [saved] = await db.select().from(agentHours).where(and(eq(agentHours.agentId, detail.agent.id), eq(agentHours.weekday, wd)));
      await db.update(agentHours).set({ fromHour: 15, toHour: 17 }).where(and(eq(agentHours.agentId, detail.agent.id), eq(agentHours.weekday, wd)));
      await db.insert(agentDaysOff).values({ agentId: detail.agent.id, date: days[5]!.date, reason: 'Holiday' });
      try {
        const after = (await slots(home.id)).days;
        expect(stateOf(after, target.date, '14:00')).toBe('closed');
        expect(stateOf(after, target.date, '15:00')).toBe('free');
        expect(stateOf(after, target.date, '18:00')).toBe('closed');
        expect(after[5]!.slots.every((s) => s.state === 'closed')).toBe(true);
        await book(client.accessToken, { propertyId: home.id, date: target.date, time: '18:00', reminders: [] }).expect(409);
      } finally {
        await db.update(agentHours).set({ fromHour: saved!.fromHour, toHour: saved!.toHour }).where(and(eq(agentHours.agentId, detail.agent.id), eq(agentHours.weekday, wd)));
        await db.delete(agentDaysOff).where(eq(agentDaysOff.agentId, detail.agent.id));
      }
    });

    it('is 404 for a missing home', async () => {
      await http().get('/v1/properties/999999/slots').expect(404);
    });
  });

  describe('booking', () => {
    it('books a free hour: confirmed, with the home’s advisor, and the hour is taken after', async () => {
      const home = aHome();
      const [at] = await freeHours(home.id);
      const res = await book(client.accessToken, { propertyId: home.id, ...at, reminders: ['1d', '2h'] }).expect(201);
      const v = res.body as ViewingItem;
      const detail = (await http().get(`/v1/properties/${home.id}`).expect(200)).body as PropertyDetail;
      expect(v).toMatchObject({ status: 'confirmed', mode: 'visit', date: at!.date, time: at!.time, rescheduledFrom: null, reminders: ['1d', '2h'], client: null });
      expect(v.property.id).toBe(home.id);
      expect(v.agent.id).toBe(detail.agent.id);
      expect(stateOf((await slots(home.id)).days, at!.date, at!.time)).toBe('taken');
      expect(await mine(client.accessToken)).toEqual([v]);
    });

    it('tells the client and the agent, and puts the client in the agent’s leads at "viewing"', async () => {
      const home = aHome();
      const [at] = await freeHours(home.id);
      const v = (await book(client.accessToken, { propertyId: home.id, ...at, reminders: [] }).expect(201)).body as ViewingItem;
      const box = await inbox(client.accessToken);
      expect(box.items[0]).toMatchObject({ kind: 'booking', titleEn: 'Viewing confirmed', href: '/viewings' });
      expect(box.items[0]!.bodyEn).toContain(v.agent.nameEn);
      const [lead] = await db.select().from(leads).where(eq(leads.clientId, client.user.id));
      expect(lead).toMatchObject({ agentId: v.agent.id, propertyId: home.id, stage: 'viewing', fromApp: true });
    });

    it('lets only one of two people book the same hour at the same moment', async () => {
      const home = aHome();
      const [at] = await freeHours(home.id);
      const other = await signUp(app);
      const results = await Promise.all([
        book(client.accessToken, { propertyId: home.id, ...at, reminders: [] }),
        book(other.accessToken, { propertyId: home.id, ...at, reminders: [] }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const rows = await db.select().from(viewings).where(eq(viewings.propertyId, home.id));
      expect(rows.filter((r) => r.status !== 'cancelled')).toHaveLength(1);
    });

    it('refuses an hour that is taken, closed or outside the 14 days, and a second viewing of the same home', async () => {
      const home = aHome();
      const [a, b] = await freeHours(home.id);
      await book(client.accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(201);
      await book((await signUp(app)).accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(409);
      await book(client.accessToken, { propertyId: home.id, ...b, reminders: [] }).expect(409);
      const { days } = await slots(home.id);
      const friday = days.slice(1).find((d) => weekdayOf(d.date) === 5)!;
      await book((await signUp(app)).accessToken, { propertyId: home.id, date: friday.date, time: '10:00', reminders: [] }).expect(409);
      await book(client.accessToken, { propertyId: aHome().id, date: '2020-01-01', time: '10:00', reminders: [] }).expect(400);
    });

    it('checks the request', async () => {
      const home = aHome();
      const [at] = await freeHours(home.id);
      await book(client.accessToken, { propertyId: home.id, date: at!.date, time: '16:30', reminders: [] }).expect(400);
      await book(client.accessToken, { propertyId: home.id, date: '15-11-2026', time: '16:00', reminders: [] }).expect(400);
      await book(client.accessToken, { propertyId: home.id, ...at, reminders: ['3d'] }).expect(400);
      await book(client.accessToken, { propertyId: 999999, ...at, reminders: [] }).expect(404);
    });

    it('does not book stays', async () => {
      const stays = ((await http().get('/v1/properties?category=stay&limit=5').expect(200)).body as Page<PropertyCard>).items;
      const [at] = await freeHours(stays[0]!.id);
      await book(client.accessToken, { propertyId: stays[0]!.id, ...at, reminders: [] }).expect(400);
    });

    it('is for signed-in clients', async () => {
      const home = aHome();
      const [at] = await freeHours(home.id);
      await http().post('/v1/viewings').send({ propertyId: home.id, ...at, reminders: [] }).expect(401);
      const agent = await signInSeeded(app, 'omar@maqar.app');
      await book(agent, { propertyId: home.id, ...at, reminders: [] }).expect(403);
    });
  });

  describe('changing a viewing', () => {
    it('reschedules: keeps where it was, frees the old hour and takes the new one', async () => {
      const home = aHome();
      const [a, b] = await freeHours(home.id);
      const v = (await book(client.accessToken, { propertyId: home.id, ...a, reminders: ['1d'] }).expect(201)).body as ViewingItem;
      const moved = (await patch(client.accessToken, v.id, { action: 'reschedule', ...b, reminders: ['2h', '30m'] }).expect(200)).body as ViewingItem;
      expect(moved).toMatchObject({ status: 'rescheduled', date: b!.date, time: b!.time, rescheduledFrom: a, reminders: ['2h', '30m'] });
      const { days } = await slots(home.id);
      expect(stateOf(days, a!.date, a!.time)).toBe('free');
      expect(stateOf(days, b!.date, b!.time)).toBe('taken');
      // With `reschedule`, its own hour shows free, so the screen can show it picked.
      expect(stateOf((await slots(home.id, `?reschedule=${v.id}`)).days, b!.date, b!.time)).toBe('free');
      expect((await inbox(client.accessToken)).items[0]).toMatchObject({ kind: 'booking', titleEn: 'Viewing rescheduled' });
      await patch(client.accessToken, v.id, { action: 'reschedule', ...b }).expect(400);
    });

    it('will not move onto someone else’s hour', async () => {
      const home = aHome();
      const [a, b] = await freeHours(home.id);
      const v = (await book(client.accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(201)).body as ViewingItem;
      await book((await signUp(app)).accessToken, { propertyId: home.id, ...b, reminders: [] }).expect(201);
      await patch(client.accessToken, v.id, { action: 'reschedule', ...b }).expect(409);
      await patch(client.accessToken, v.id, { action: 'reschedule' }).expect(400);
    });

    it('cancels: the hour is free again, it can be booked again, and a cancelled one cannot change', async () => {
      const home = aHome();
      const [a] = await freeHours(home.id);
      const v = (await book(client.accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(201)).body as ViewingItem;
      expect((await patch(client.accessToken, v.id, { action: 'cancel' }).expect(200)).body).toMatchObject({ status: 'cancelled' });
      expect(stateOf((await slots(home.id)).days, a!.date, a!.time)).toBe('free');
      expect((await inbox(client.accessToken)).items[0]).toMatchObject({ titleEn: 'Viewing cancelled' });
      await patch(client.accessToken, v.id, { action: 'cancel' }).expect(409);
      await book(client.accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(201);
      // Still one lead for this client and agent.
      expect(await db.select().from(leads).where(eq(leads.clientId, client.user.id))).toHaveLength(1);
    });

    it('lets a client change only their own', async () => {
      const home = aHome();
      const [a] = await freeHours(home.id);
      const v = (await book(client.accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(201)).body as ViewingItem;
      const other = await signUp(app);
      await patch(other.accessToken, v.id, { action: 'cancel' }).expect(404);
      await patch(await signInSeeded(app, 'omar@maqar.app'), v.id, { action: 'cancel' }).expect(403);
      await patch(client.accessToken, 999999, { action: 'cancel' }).expect(404);
      expect(await mine(other.accessToken)).toEqual([]);
    });
  });

  describe('lists and calendar', () => {
    it('shows an agent the viewings they meet, with who is coming', async () => {
      const home = aHome();
      const detail = (await http().get(`/v1/properties/${home.id}`).expect(200)).body as PropertyDetail;
      const agentEmail = { 'عمر': 'omar@maqar.app', 'مريم': 'mariam@maqar.app', 'يوسف': 'youssef@maqar.app', 'سلمى': 'salma@maqar.app' };
      const email = Object.entries(agentEmail).find(([n]) => detail.agent.nameAr.startsWith(n))![1];
      const [a] = await freeHours(home.id);
      const v = (await book(client.accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(201)).body as ViewingItem;
      const agent = await signInSeeded(app, email);
      const theirs = await mine(agent);
      expect(theirs.find((x) => x.id === v.id)?.client).toEqual({ name: 'Test User', phone: null });
      expect((await inbox(agent)).items.some((n) => n.kind === 'lead' && n.titleEn === 'New booking from the app')).toBe(true);
    });

    it('gives a calendar file with a 45-minute event and an alarm 2 hours before', async () => {
      const home = aHome();
      const [a] = await freeHours(home.id);
      const v = (await book(client.accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(201)).body as ViewingItem;
      const res = await http().get(`/v1/viewings/${v.id}/ics`).set(bearer(client.accessToken)).expect(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      const text = res.text;
      const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      expect(text).toContain(`DTSTART:${stamp(new Date(v.startsAt))}`);
      expect(text).toContain(`DTEND:${stamp(new Date(Date.parse(v.startsAt) + 45 * 60_000))}`);
      expect(text).toContain('TRIGGER:-PT2H');
      expect(text).toContain('\r\n');
      const stranger = await signUp(app);
      await http().get(`/v1/viewings/${v.id}/ics`).set(bearer(stranger.accessToken)).expect(404);
    });

    it('cancels the coming viewings of a deleted account', async () => {
      const home = aHome();
      const [a] = await freeHours(home.id);
      await book(client.accessToken, { propertyId: home.id, ...a, reminders: [] }).expect(201);
      await http().delete('/v1/me').set(bearer(client.accessToken)).send({ password: 'Secret123' }).expect(204);
      expect(stateOf((await slots(home.id)).days, a!.date, a!.time)).toBe('free');
    });
  });
});
