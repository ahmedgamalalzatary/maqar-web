import type { INestApplication } from '@nestjs/common';
import type {
  AdminAgentDetail,
  AdminAgentItem,
  AdminArea,
  AdminLeadItem,
  AgentBody,
  AreaItem,
  AuthResponse,
  ChatPage,
  ChatThread,
  DaysOffResult,
  LeadCard,
  Page,
  PropertyCard,
  PropertyDetail,
  SlotsResponse,
} from '@maqar/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { users } from '../../src/modules/users/users.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { cairoClock } from '../../src/modules/viewings/slots.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const ALL_DAY = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, from: 0, to: 23 }));

// Phase 18: agents, their hours and days off, leads, areas and featured listings (contract §11).
describe('Admin tools (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let admin: string;
  let omarId: number;
  let mariamId: number;
  let omarHome: PropertyCard;
  let mariamHome: PropertyCard;
  const http = () => request(app.getHttpServer());
  const as = (token = admin) => bearer(token);

  const idOf = async (email: string) => (await db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0]!.id;
  const slots = async (id: number) => ((await http().get(`/v1/properties/${id}/slots`).expect(200)).body as SlotsResponse).days;
  const agentBody = (over: Partial<AgentBody> = {}): AgentBody => ({
    nameAr: 'نادين سمير',
    nameEn: 'Nadine Samir',
    email: `nadine-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@maqar.app`,
    password: 'Starting123',
    phone: '+201005550101',
    roleTitleAr: 'مستشارة مبيعات',
    roleTitleEn: 'Sales advisor',
    languagesAr: 'العربية',
    languagesEn: 'Arabic',
    colour: '#61766d',
    monthlyTarget: 6,
    ...over,
  });
  const createAgent = async (over: Partial<AgentBody> = {}) => {
    const body = agentBody(over);
    const res = await http().post('/v1/admin/agents').set(as()).send(body).expect(201);
    return { agent: res.body as AdminAgentDetail, body };
  };
  const signIn = (email: string, password: string) => http().post('/v1/auth/sign-in').send({ email, password });

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    omarId = await idOf('omar@maqar.app');
    mariamId = await idOf('mariam@maqar.app');
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((c) => c.category !== 'stay');
    const details = await Promise.all(all.map(async (c) => (await http().get(`/v1/properties/${c.id}`).expect(200)).body as PropertyDetail));
    omarHome = all.find((_, i) => details[i]!.agent.id === omarId)!;
    mariamHome = all.find((_, i) => details[i]!.agent.id === mariamId)!;
  });
  afterAll(async () => {
    await app.close();
  });

  it('is for admins only', async () => {
    const client = (await signUp(app)).accessToken;
    const omar = await signInSeeded(app, 'omar@maqar.app');
    const routes = [
      () => http().get('/v1/admin/agents'),
      () => http().post('/v1/admin/agents').send(agentBody()),
      () => http().put('/v1/admin/agents/hours').send({ agentIds: [omarId], hours: ALL_DAY }),
      () => http().post('/v1/admin/agents/days-off').send({ agentIds: [omarId], from: '2030-01-01' }),
      () => http().get('/v1/admin/leads'),
      () => http().get('/v1/admin/areas'),
      () => http().post('/v1/admin/areas').send({}),
    ];
    for (const route of routes) {
      await route().expect(401);
      await route().set(as(client)).expect(403);
      await route().set(as(omar)).expect(403);
    }
  });

  describe('agents', () => {
    it('creates an agent who can sign in at once with the starting password, and lists them', async () => {
      const { agent, body } = await createAgent();
      expect(agent).toMatchObject({ nameEn: 'Nadine Samir', email: body.email, active: true, live: 0, openLeads: 0, defaultHours: true, daysOff: [] });
      expect(agent.hours).toHaveLength(7);
      const res = await signIn(body.email, body.password!).expect(200);
      expect((res.body as AuthResponse).user.role).toBe('agent');
      const list = (await http().get('/v1/admin/agents').set(as()).expect(200)).body as AdminAgentItem[];
      expect(list.map((a) => a.id)).toContain(agent.id);
      expect(list).not.toContainEqual(expect.objectContaining({ password: expect.anything() }));
    });

    it('refuses an email in use, a short password, and a colour that is not one', async () => {
      const { body } = await createAgent();
      await http().post('/v1/admin/agents').set(as()).send(agentBody({ email: body.email })).expect(409);
      await http().post('/v1/admin/agents').set(as()).send(agentBody({ email: 'OMAR@maqar.app' })).expect(409);
      await http().post('/v1/admin/agents').set(as()).send(agentBody({ password: 'short' })).expect(400);
      await http().post('/v1/admin/agents').set(as()).send(agentBody({ password: undefined })).expect(400);
      await http().post('/v1/admin/agents').set(as()).send(agentBody({ colour: 'gold' })).expect(400);
    });

    it('edits the profile, and a deactivated agent is signed out and cannot sign in until turned back on', async () => {
      const { agent, body } = await createAgent();
      const token = ((await signIn(body.email, body.password!).expect(200)).body as AuthResponse).accessToken;
      const edited = (await http().patch(`/v1/admin/agents/${agent.id}`).set(as()).send({ roleTitleEn: 'Senior advisor', monthlyTarget: 9 }).expect(200)).body as AdminAgentDetail;
      expect(edited).toMatchObject({ roleTitleEn: 'Senior advisor', monthlyTarget: 9, nameEn: 'Nadine Samir' });

      await http().patch(`/v1/admin/agents/${agent.id}`).set(as()).send({ active: false }).expect(200);
      await http().get('/v1/agent/today').set(as(token)).expect(401);
      await signIn(body.email, body.password!).expect(401);
      const pickable = (await http().get('/v1/admin/agents?active=true').set(as()).expect(200)).body as AdminAgentItem[];
      expect(pickable.map((a) => a.id)).not.toContain(agent.id);

      await http().patch(`/v1/admin/agents/${agent.id}`).set(as()).send({ active: true }).expect(200);
      await signIn(body.email, body.password!).expect(200);
      await http().patch('/v1/admin/agents/999999').set(as()).send({ monthlyTarget: 1 }).expect(404);
    });

    it('will not deactivate an advisor who still has live listings', async () => {
      await http().patch(`/v1/admin/agents/${omarId}`).set(as()).send({ active: false }).expect(409);
    });
  });

  describe('hours and days off', () => {
    it('sets the same week for several agents at once, and their homes’ slots follow at once', async () => {
      const week = [1, 2, 3].map((weekday) => ({ weekday, from: 9, to: 12 }));
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [omarId, mariamId], hours: week }).expect(204);
      for (const home of [omarHome, mariamHome]) {
        for (const day of (await slots(home.id)).slice(1)) {
          const open = day.slots.filter((s) => s.state !== 'closed').map((s) => s.time);
          expect(open).toEqual([1, 2, 3].includes(weekdayOf(day.date)) ? ['09:00', '10:00', '11:00', '12:00'] : []);
        }
      }
      const omar = (await http().get(`/v1/admin/agents/${omarId}`).set(as()).expect(200)).body as AdminAgentDetail;
      expect(omar).toMatchObject({ defaultHours: false, hours: week });
    });

    it('refuses a week that is not one, and agents that do not exist', async () => {
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [omarId], hours: [{ weekday: 1, from: 20, to: 10 }] }).expect(400);
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [omarId], hours: [{ weekday: 1, from: 9, to: 12 }, { weekday: 1, from: 13, to: 14 }] }).expect(400);
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [], hours: ALL_DAY }).expect(400);
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [omarId, 999999], hours: ALL_DAY }).expect(404);
    });

    it('a day off closes that day’s slots, tells how many viewings are booked then, and can be taken back', async () => {
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [omarId], hours: ALL_DAY }).expect(204);
      const days = await slots(omarHome.id);
      const day = days[3]!;
      const client = await signUp(app);
      await http().post('/v1/viewings').set(as(client.accessToken)).send({ propertyId: omarHome.id, date: day.date, time: '11:00', reminders: [] }).expect(201);

      const res = (await http().post('/v1/admin/agents/days-off').set(as()).send({ agentIds: [omarId], from: day.date, reason: 'إجازة' }).expect(201)).body as DaysOffResult;
      expect(res).toEqual({ days: 1, booked: [{ agentId: omarId, viewings: 1 }] });
      const closed = (await slots(omarHome.id)).find((d) => d.date === day.date)!;
      expect(closed.slots.filter((s) => s.state === 'free')).toEqual([]);
      const omar = (await http().get(`/v1/admin/agents/${omarId}`).set(as()).expect(200)).body as AdminAgentDetail;
      expect(omar.daysOff).toContainEqual({ date: day.date, reason: 'إجازة' });

      await http().delete(`/v1/admin/agents/${omarId}/days-off/${day.date}`).set(as()).expect(204);
      const open = (await slots(omarHome.id)).find((d) => d.date === day.date)!;
      expect(open.slots.filter((s) => s.state === 'free').length).toBeGreaterThan(0);
    });

    it('adds a stretch of days off for several agents; adding the same day again changes nothing', async () => {
      const days = await slots(omarHome.id);
      const [from, to] = [days[5]!.date, days[7]!.date];
      const res = (await http().post('/v1/admin/agents/days-off').set(as()).send({ agentIds: [omarId, mariamId], from, to, reason: 'Holiday' }).expect(201)).body as DaysOffResult;
      expect(res.days).toBe(3);
      await http().post('/v1/admin/agents/days-off').set(as()).send({ agentIds: [omarId], from, to }).expect(201);
      for (const home of [omarHome, mariamHome]) {
        const shown = (await slots(home.id)).filter((d) => d.date >= from && d.date <= to);
        expect(shown.every((d) => d.slots.every((s) => s.state !== 'free'))).toBe(true);
      }
      await http().post('/v1/admin/agents/days-off').set(as()).send({ agentIds: [omarId], from: to, to: from }).expect(400);
      await http().post('/v1/admin/agents/days-off').set(as()).send({ agentIds: [omarId], from: '2026-13-01' }).expect(400);
    });

    it('a day off today turns on the chat’s away reply at once', async () => {
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [omarId], hours: ALL_DAY }).expect(204);
      const client = await signUp(app);
      const thread = (await http().post('/v1/chats').set(as(client.accessToken)).send({ propertyId: omarHome.id }).expect(201)).body as ChatThread;
      const say = (text: string) => http().post(`/v1/chats/${thread.id}/messages`).set(as(client.accessToken)).send({ kind: 'text', text }).expect(201);
      const autos = async () => ((await http().get(`/v1/chats/${thread.id}/messages`).set(as(client.accessToken)).expect(200)).body as ChatPage).items.filter((m) => m.body.kind === 'text' && m.body.auto);

      await say('متاحة؟');
      expect(await autos()).toHaveLength(0);
      const today = cairoClock(new Date()).date;
      await http().post('/v1/admin/agents/days-off').set(as()).send({ agentIds: [omarId], from: today }).expect(201);
      await say('حد موجود؟');
      expect(await autos()).toHaveLength(1);
      await http().delete(`/v1/admin/agents/${omarId}/days-off/${today}`).set(as()).expect(204);
    });
  });

  describe('leads', () => {
    it('lists every agent’s leads, and reassigns one: the new agent has it, the old one does not', async () => {
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [omarId], hours: ALL_DAY }).expect(204);
      const client = await signUp(app, { name: 'Lead To Move' });
      const day = (await slots(omarHome.id)).slice(9).find((d) => d.slots.some((s) => s.state === 'free'))!;
      const time = day.slots.find((s) => s.state === 'free')!.time;
      await http().post('/v1/viewings').set(as(client.accessToken)).send({ propertyId: omarHome.id, date: day.date, time, reminders: [] }).expect(201);

      const all = (await http().get('/v1/admin/leads').set(as()).expect(200)).body as AdminLeadItem[];
      const lead = all.find((l) => l.name === 'Lead To Move')!;
      expect(lead.agent.id).toBe(omarId);
      const mariamOnly = (await http().get(`/v1/admin/leads?agentId=${mariamId}`).set(as()).expect(200)).body as AdminLeadItem[];
      expect(mariamOnly.every((l) => l.agent.id === mariamId)).toBe(true);

      const moved = (await http().patch(`/v1/admin/leads/${lead.id}/assign`).set(as()).send({ agentId: mariamId }).expect(200)).body as AdminLeadItem;
      expect(moved.agent.id).toBe(mariamId);
      const omar = await signInSeeded(app, 'omar@maqar.app');
      const mariam = await signInSeeded(app, 'mariam@maqar.app');
      expect(((await http().get('/v1/agent/leads').set(as(omar)).expect(200)).body as LeadCard[]).map((l) => l.id)).not.toContain(lead.id);
      expect(((await http().get('/v1/agent/leads').set(as(mariam)).expect(200)).body as LeadCard[]).map((l) => l.id)).toContain(lead.id);

      // Nor to an advisor who does not exist.
      await http().patch(`/v1/admin/leads/${lead.id}/assign`).set(as()).send({ agentId: 999999 }).expect(400);
      await http().patch('/v1/admin/leads/999999/assign').set(as()).send({ agentId: omarId }).expect(404);
    });

    it('will not give a client a second lead with the same advisor', async () => {
      await http().put('/v1/admin/agents/hours').set(as()).send({ agentIds: [omarId, mariamId], hours: ALL_DAY }).expect(204);
      const client = await signUp(app, { name: 'Two Advisors' });
      for (const home of [omarHome, mariamHome]) {
        const day = (await slots(home.id)).slice(10).find((d) => d.slots.some((s) => s.state === 'free'))!;
        const time = day.slots.find((s) => s.state === 'free')!.time;
        await http().post('/v1/viewings').set(as(client.accessToken)).send({ propertyId: home.id, date: day.date, time, reminders: [] }).expect(201);
      }
      const mine = ((await http().get('/v1/admin/leads').set(as()).expect(200)).body as AdminLeadItem[]).filter((l) => l.name === 'Two Advisors');
      expect(mine).toHaveLength(2);
      const withOmar = mine.find((l) => l.agent.id === omarId)!;
      await http().patch(`/v1/admin/leads/${withOmar.id}/assign`).set(as()).send({ agentId: mariamId }).expect(409);
    });
  });

  describe('areas', () => {
    it('adds an area (id from the English name), edits it, and shows it to clients', async () => {
      const body = { nameAr: 'العلمين الجديدة', nameEn: 'New Alamein', cityAr: 'مطروح', cityEn: 'Matrouh', image: '/uploads/seed/p19.jpg' };
      const area = (await http().post('/v1/admin/areas').set(as()).send(body).expect(201)).body as AdminArea;
      expect(area).toMatchObject({ id: 'new-alamein', listings: 0 });
      await http().post('/v1/admin/areas').set(as()).send(body).expect(409);
      await http().post('/v1/admin/areas').set(as()).send({ ...body, nameEn: 'العلمين' }).expect(400);
      await http().post('/v1/admin/areas').set(as()).send({ ...body, id: 'alamein-2', image: 'https://evil.example/x.jpg' }).expect(400);

      const edited = (await http().patch('/v1/admin/areas/new-alamein').set(as()).send({ cityEn: 'Marsa Matrouh' }).expect(200)).body as AdminArea;
      expect(edited.cityEn).toBe('Marsa Matrouh');
      const shown = (await http().get('/v1/areas').expect(200)).body as AreaItem[];
      expect(shown.map((a) => a.id)).toContain('new-alamein');
      await http().patch('/v1/admin/areas/atlantis').set(as()).send({ cityEn: 'Nowhere' }).expect(404);
    });

    it('deletes an area no listing uses, and refuses one in use', async () => {
      const list = (await http().get('/v1/admin/areas').set(as()).expect(200)).body as AdminArea[];
      const used = list.find((a) => a.listings > 0)!;
      await http().delete(`/v1/admin/areas/${used.id}`).set(as()).expect(409);
      await http().post('/v1/admin/areas').set(as()).send({ id: 'to-delete', nameAr: 'مؤقتة', nameEn: 'Temporary', cityAr: 'القاهرة', cityEn: 'Cairo', image: '/uploads/seed/p2.jpg' }).expect(201);
      await http().delete('/v1/admin/areas/to-delete').set(as()).expect(204);
      await http().delete('/v1/admin/areas/to-delete').set(as()).expect(404);
    });
  });

  describe('listings', () => {
    it('features a listing: clients see it marked, and can ask for featured ones only', async () => {
      const featuredIds = async () => ((await http().get('/v1/properties?featured=true&limit=50').expect(200)).body as Page<PropertyCard>).items.map((c) => c.id);
      const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items;
      const plain = all.find((c) => !c.featured)!;
      const before = await featuredIds();
      expect(before).toEqual(all.filter((c) => c.featured).map((c) => c.id));
      expect(before).not.toContain(plain.id);

      await http().patch(`/v1/admin/listings/${plain.id}`).set(as()).send({ featured: true }).expect(200);
      expect(await featuredIds()).toContain(plain.id);
      await http().patch(`/v1/admin/listings/${plain.id}`).set(as()).send({ featured: false }).expect(200);
      expect(await featuredIds()).toEqual(before);
    });

    it('moves a live listing to another advisor, but not to an inactive one', async () => {
      const { agent } = await createAgent();
      const res = await http().patch(`/v1/admin/listings/${mariamHome.id}`).set(as()).send({ agentId: agent.id }).expect(200);
      expect(res.body.agent.id).toBe(agent.id);
      expect(((await http().get(`/v1/properties/${mariamHome.id}`).expect(200)).body as PropertyDetail).agent.id).toBe(agent.id);
      await http().patch(`/v1/admin/agents/${agent.id}`).set(as()).send({ active: false }).expect(409);
      await http().patch(`/v1/admin/listings/${mariamHome.id}`).set(as()).send({ agentId: mariamId }).expect(200);
      await http().patch(`/v1/admin/agents/${agent.id}`).set(as()).send({ active: false }).expect(200);
      await http().patch(`/v1/admin/listings/${mariamHome.id}`).set(as()).send({ agentId: agent.id }).expect(400);
    });
  });
});
