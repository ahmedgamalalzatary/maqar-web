import type { INestApplication } from '@nestjs/common';
import type {
  AdminAccount,
  AdminClientDetail,
  AdminClientsPage,
  AuthResponse,
  ClientUpdateResult,
  NotificationsResponse,
  Page,
  PropertyCard,
  PropertyDetail,
  SlotsResponse,
} from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 22: admins manage client accounts and other admins, with suspension.
describe('Admin clients and admins (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let adminId: number;
  let agent: string;
  let homes: PropertyCard[];
  /** A home whose advisor is Omar, the agent signed in here. */
  let omarHome: PropertyCard;
  const http = () => request(app.getHttpServer());
  const as = (token = admin) => bearer(token);

  const client = (name = 'Karim Mahmoud') => signUp(app, { name, password: 'Secret123' });
  const detail = async (id: number) => (await http().get(`/v1/admin/clients/${id}`).set(as()).expect(200)).body as AdminClientDetail;
  const list = async (q = '') => (await http().get(`/v1/admin/clients${q}`).set(as()).expect(200)).body as AdminClientsPage;
  const signIn = (email: string, password: string) => http().post('/v1/auth/sign-in').send({ email, password });
  /** Books the first free hour of a home a few days out. */
  const book = async (token: string, home: PropertyCard) => {
    const days = ((await http().get(`/v1/properties/${home.id}/slots`).expect(200)).body as SlotsResponse).days;
    for (const day of days.slice(2)) {
      const slot = day.slots.find((s) => s.state === 'free');
      if (slot) return http().post('/v1/viewings').set(as(token)).send({ propertyId: home.id, date: day.date, time: slot.time, reminders: [] }).expect(201);
    }
    throw new Error('no free slot');
  };

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    adminId = ((await http().get('/v1/me').set(as()).expect(200)).body as { id: number }).id;
    agent = await signInSeeded(app, 'omar@maqar.app');
    homes = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((h) => h.category !== 'stay');
    const omarId = ((await http().get('/v1/me').set(as(agent)).expect(200)).body as { id: number }).id;
    for (const h of homes) {
      const d = (await http().get(`/v1/properties/${h.id}`).expect(200)).body as PropertyDetail;
      if (d.agent.id === omarId) {
        omarHome = h;
        break;
      }
    }
  });
  afterAll(async () => {
    await app.close();
  });

  it('is for admins only', async () => {
    const c = await client();
    for (const path of ['/v1/admin/clients', '/v1/admin/admins', `/v1/admin/clients/${c.user.id}`]) {
      await http().get(path).expect(401);
      for (const token of [c.accessToken, agent]) await http().get(path).set(as(token)).expect(403);
    }
  });

  describe('clients', () => {
    it('lists clients only, newest first, searchable by name, email or phone, with counts', async () => {
      const a = await client('Nour Hesham');
      await http().patch('/v1/me').set(as(a.accessToken)).send({ phone: '+201112223334' }).expect(200);
      await http().put(`/v1/favorites/${homes[0]!.id}`).set(as(a.accessToken)).expect(204);
      const page = await list();
      expect(page.items.every((i) => i.email !== 'admin@maqar.app' && i.email !== 'omar@maqar.app')).toBe(true);
      expect(page.items[0]!.id).toBe(a.user.id);
      expect(page.items[0]).toMatchObject({ name: 'Nour Hesham', saved: 1, suspendedAt: null });
      // Seen just now (it signed up a moment ago), not hours off by a time zone.
      expect(Math.abs(Date.parse(page.items[0]!.lastSeenAt!) - Date.now())).toBeLessThan(60_000);
      for (const q of ['nour', a.user.email!.slice(0, 8), '2223334']) expect((await list(`?q=${encodeURIComponent(q)}`)).items.map((i) => i.id)).toContain(a.user.id);
      expect((await list('?q=nobody-like-this')).items).toEqual([]);
      expect(page.counts.active).toBeGreaterThan(0);
    });

    it('opens a client with their preferences, viewings, chats and leads', async () => {
      const c = await client();
      await book(c.accessToken, homes[0]!);
      const d = await detail(c.user.id);
      expect(d.recentViewings).toHaveLength(1);
      expect(d.recentViewings[0]!.property.id).toBe(homes[0]!.id);
      expect(d.leadsList).toHaveLength(1);
      expect(d.prefs).toBeNull();
      await http().get('/v1/admin/clients/999999').set(as()).expect(404);
      // Staff are not clients.
      await http().get(`/v1/admin/clients/${adminId}`).set(as()).expect(404);
    });

    it('a new password signs the client out everywhere, and the new one works', async () => {
      const c = await client();
      await http().patch(`/v1/admin/clients/${c.user.id}`).set(as()).send({ password: 'short' }).expect(400);
      await http().patch(`/v1/admin/clients/${c.user.id}`).set(as()).send({ password: 'NewPass123' }).expect(200);
      await http().get('/v1/me').set(as(c.accessToken)).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: c.refreshToken }).expect(401);
      await signIn(c.user.email!, 'Secret123').expect(401);
      await signIn(c.user.email!, 'NewPass123').expect(200);
    });

    it('suspending signs the client out at once, refuses sign-in, cancels upcoming viewings and tells the advisor; restoring lets them back', async () => {
      const c = await client('Suspended Sam');
      await book(c.accessToken, omarHome);
      const agentBefore = ((await http().get('/v1/notifications').set(as(agent)).expect(200)).body as NotificationsResponse).items.length;
      const res = (await http().patch(`/v1/admin/clients/${c.user.id}`).set(as()).send({ suspended: true }).expect(200)).body as ClientUpdateResult;
      expect(res.suspendedAt).not.toBeNull();
      expect(res.cancelledViewings).toBe(1);
      expect(res.recentViewings[0]!.status).toBe('cancelled');
      await http().get('/v1/me').set(as(c.accessToken)).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: c.refreshToken }).expect(401);
      await signIn(c.user.email!, 'Secret123').expect(401);
      // The home's advisor heard about it; the suspended client is not sent anything.
      const advisorInbox = (await http().get('/v1/notifications').set(as(agent)).expect(200)).body as NotificationsResponse;
      expect(advisorInbox.items.length).toBe(agentBefore + 1);
      expect(advisorInbox.items[0]!.titleEn).toBe('A viewing was cancelled');
      expect((await list('?status=suspended')).items.map((i) => i.id)).toContain(c.user.id);
      expect((await list('?status=active')).items.map((i) => i.id)).not.toContain(c.user.id);

      const back = (await http().patch(`/v1/admin/clients/${c.user.id}`).set(as()).send({ suspended: false }).expect(200)).body as ClientUpdateResult;
      expect(back.suspendedAt).toBeNull();
      await signIn(c.user.email!, 'Secret123').expect(200);
    });

    it('deletes a client as if they deleted the account themselves', async () => {
      const c = await client();
      await http().put(`/v1/favorites/${homes[1]!.id}`).set(as(c.accessToken)).expect(204);
      await http().delete(`/v1/admin/clients/${c.user.id}`).set(as()).expect(204);
      await http().get('/v1/me').set(as(c.accessToken)).expect(401);
      await http().get(`/v1/admin/clients/${c.user.id}`).set(as()).expect(404);
      await signIn(c.user.email!, 'Secret123').expect(401);
      // The address is free to sign up again.
      await signUp(app, { email: c.user.email!, password: 'Secret123' });
      await http().delete(`/v1/admin/clients/${adminId}`).set(as()).expect(404);
    });
  });

  describe('admins', () => {
    it('lists admins, marks the one asking, and creates one with a starting password', async () => {
      const before = (await http().get('/v1/admin/admins').set(as()).expect(200)).body as AdminAccount[];
      expect(before.find((a) => a.id === adminId)).toMatchObject({ you: true, email: 'admin@maqar.app' });
      const email = `second-${Date.now()}@maqar.app`;
      await http().post('/v1/admin/admins').set(as()).send({ name: 'Second', email, password: 'nodigits' }).expect(400);
      const made = (await http().post('/v1/admin/admins').set(as()).send({ name: 'Second Admin', email, password: 'Starting123' }).expect(201)).body as AdminAccount;
      expect(made).toMatchObject({ name: 'Second Admin', email, you: false, suspendedAt: null });
      await http().post('/v1/admin/admins').set(as()).send({ name: 'Again', email, password: 'Starting123' }).expect(409);
      const token = ((await signIn(email, 'Starting123').expect(200)).body as AuthResponse).accessToken;
      await http().get('/v1/admin/clients').set(as(token)).expect(200);
    });

    it('suspends another admin at once, but never oneself (so one admin always stays active)', async () => {
      const email = `third-${Date.now()}@maqar.app`;
      const made = (await http().post('/v1/admin/admins').set(as()).send({ name: 'Third', email, password: 'Starting123' }).expect(201)).body as AdminAccount;
      const token = ((await signIn(email, 'Starting123').expect(200)).body as AuthResponse).accessToken;
      await http().patch(`/v1/admin/admins/${adminId}`).set(as()).send({ suspended: true }).expect(409);
      const res = await http().patch(`/v1/admin/admins/${made.id}`).set(as()).send({ suspended: true, name: 'Third Admin' }).expect(200);
      expect((res.body as AdminAccount).name).toBe('Third Admin');
      await http().get('/v1/admin/clients').set(as(token)).expect(401);
      await signIn(email, 'Starting123').expect(401);
      await http().patch(`/v1/admin/admins/${made.id}`).set(as()).send({ suspended: false, password: 'Another123' }).expect(200);
      await signIn(email, 'Starting123').expect(401);
      await signIn(email, 'Another123').expect(200);
    });

    it('an agent or client id is not an admin', async () => {
      const c = await client();
      await http().patch(`/v1/admin/admins/${c.user.id}`).set(as()).send({ name: 'Not an admin' }).expect(404);
    });
  });
});
