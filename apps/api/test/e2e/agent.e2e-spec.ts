import type { INestApplication } from '@nestjs/common';
import type { AgentToday, AuthResponse, LeadCard, LeadDetail, NotificationsResponse, Page, PropertyCard, PropertyDetail, SlotsResponse, ViewingItem } from '@maqar/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedSampleLeads } from '../../src/modules/leads/leads.seed.js';
import { leads } from '../../src/modules/leads/leads.schema.js';
import { LeadsService } from '../../src/modules/leads/leads.service.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { users } from '../../src/modules/users/users.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

// Phase 15: the sales agent app (contract §10.1, §10.2).
describe('Sales agent (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let omar: string;
  let omarId: number;
  let mariam: string;
  let omarHomes: PropertyCard[];
  let client: AuthResponse;
  const http = () => request(app.getHttpServer());

  const today = async (token = omar) => (await http().get('/v1/agent/today').set(bearer(token)).expect(200)).body as AgentToday;
  const list = async (token = omar, q = '') => (await http().get(`/v1/agent/leads${q}`).set(bearer(token)).expect(200)).body as LeadCard[];
  const detail = async (id: number, token = omar) => (await http().get(`/v1/agent/leads/${id}`).set(bearer(token)).expect(200)).body as LeadDetail;
  const patch = (id: number, body: Record<string, unknown>, token = omar) => http().patch(`/v1/agent/leads/${id}`).set(bearer(token)).send(body);
  const note = (id: number, text: unknown, token = omar) => http().post(`/v1/agent/leads/${id}/notes`).set(bearer(token)).send({ text });
  /** Books a free hour a few days ahead (never Friday) on one of Omar's homes. */
  let next = 0;
  const bookWithOmar = async (token = client.accessToken) => {
    const home = omarHomes[next++ % omarHomes.length]!;
    const { days } = (await http().get(`/v1/properties/${home.id}/slots`).expect(200)).body as SlotsResponse;
    const day = days.slice(2).find((d) => weekdayOf(d.date) !== 5 && d.slots.some((s) => s.state === 'free'))!;
    const time = day.slots.find((s) => s.state === 'free')!.time;
    const v = (await http().post('/v1/viewings').set(bearer(token)).send({ propertyId: home.id, date: day.date, time, reminders: [] }).expect(201)).body as ViewingItem;
    return { v, home };
  };

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    await seedSampleLeads(db);
    omar = await signInSeeded(app, 'omar@maqar.app');
    mariam = await signInSeeded(app, 'mariam@maqar.app');
    omarId = (await db.select({ id: users.id }).from(users).where(eq(users.email, 'omar@maqar.app')))[0]!.id;
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((c) => c.category !== 'stay');
    const details = await Promise.all(all.map(async (c) => (await http().get(`/v1/properties/${c.id}`).expect(200)).body as PropertyDetail));
    omarHomes = all.filter((_, i) => details[i]!.agent.id === omarId);
  });
  beforeEach(async () => {
    client = await signUp(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('is for agents only', async () => {
    await http().get('/v1/agent/today').expect(401);
    await http().get('/v1/agent/today').set(bearer(client.accessToken)).expect(403);
    const admin = await signInSeeded(app, 'admin@maqar.app');
    await http().get('/v1/agent/leads').set(bearer(admin)).expect(403);
  });

  it('a booking shows up straight away: a hot lead at "viewing", new from the app, and on the day', async () => {
    const { v, home } = await bookWithOmar();
    const lead = (await list()).find((l) => l.fromApp && l.property?.id === home.id && l.name === 'Test User')!;
    expect(lead).toMatchObject({ stage: 'viewing', source: 'booking', hot: true, fromApp: true, isNew: true, phone: null });

    const day = await today();
    const seen = [...day.today, ...day.upcoming].find((x) => x.id === v.id);
    // Booked a few days ahead: in "Coming up" unless five sooner ones fill it.
    if (seen) expect(seen).toMatchObject({ leadId: lead.id, clientName: 'Test User', newFromApp: true, date: v.date, time: v.time });
    // On the day itself it is under Today.
    const onTheDay = await app.get(LeadsService).today(omarId, new Date(new Date(v.startsAt).getTime() - 2 * 3_600_000));
    expect(onTheDay.today.find((x) => x.id === v.id)).toMatchObject({ newFromApp: true, clientName: 'Test User' });
  });

  it('opening the lead clears "New from app"; another booking brings it back', async () => {
    const { v } = await bookWithOmar();
    const id = (await list()).find((l) => l.isNew && l.name === 'Test User' && l.fromApp)!.id;
    const page = await detail(id);
    expect(page.viewing).toMatchObject({ id: v.id, newFromApp: true });
    expect((await list()).find((l) => l.id === id)!.isNew).toBe(false);
    expect((await detail(id)).viewing!.newFromApp).toBe(false);

    await bookWithOmar();
    expect((await list()).find((l) => l.id === id)!.isNew).toBe(true);
  });

  it('tells the agent, opening the lead page', async () => {
    await bookWithOmar();
    const id = (await list()).find((l) => l.isNew && l.name === 'Test User')!.id;
    const box = (await http().get('/v1/notifications').set(bearer(omar)).expect(200)).body as NotificationsResponse;
    expect(box.items[0]).toMatchObject({ kind: 'lead', href: `/agent/lead/${id}` });
  });

  it('the day has the stats, the pipeline, the target and "Needs a first call" from the leads', async () => {
    const day = await today();
    const mine = await list();
    const n = (stage: string) => mine.filter((l) => l.stage === stage).length;
    expect(day.firstNameEn).toBe('Omar');
    expect(day.firstNameAr).toBe('عمر');
    expect(day.pipeline).toEqual({ new: n('new'), contacted: n('contacted'), viewing: n('viewing'), negotiation: n('negotiation'), won: n('won'), lost: n('lost') });
    expect(day.stats.fresh).toBe(n('new'));
    expect(day.stats.active).toBe(mine.length - n('won') - n('lost'));
    expect(day.firstCall.map((l) => l.id)).toEqual(mine.filter((l) => l.stage === 'new').map((l) => l.id));
    // Every seeded agent has one sample deal won just now, so the team average is 1.
    expect(day.target).toEqual({ won: 1, target: 6, teamAvg: 1 });
  });

  it('lists the newest activity first, masks phones, and filters by stage', async () => {
    const all = await list();
    const times = all.map((l) => l.lastActivityAt);
    expect(times).toEqual([...times].sort().reverse());
    const sample = all.find((l) => l.name === 'نهى السيد')!;
    expect(sample).toMatchObject({ phone: '+20 112 *** 9087', source: 'tour', hot: true, fromApp: false, isNew: false, stage: 'new' });
    expect((await list(omar, '?stage=negotiation')).every((l) => l.stage === 'negotiation')).toBe(true);
    await http().get('/v1/agent/leads?stage=maybe').set(bearer(omar)).expect(400);
  });

  it('the lead page has the full phone, the home and the notes, newest first', async () => {
    const tarek = (await list()).find((l) => l.name === 'طارق عبد الله')!;
    const page = await detail(tarek.id);
    expect(page.phone).toBe('+201004122231');
    expect(page.property?.id).toBe(tarek.property!.id);
    expect(page.viewing).toBeNull();
    expect(page.notes.map((x) => x.text)).toEqual(['عرض ١٦٫٥ مليون كاش، مستني رد المالك.']);

    const added = (await note(tarek.id, '  Called back: accepted 16.8  ').expect(201)).body;
    expect(added.text).toBe('Called back: accepted 16.8');
    expect((await detail(tarek.id)).notes.map((x) => x.text)).toEqual(['Called back: accepted 16.8', 'عرض ١٦٫٥ مليون كاش، مستني رد المالك.']);
    // A note is activity: the lead goes to the top.
    expect((await list())[0]!.id).toBe(tarek.id);

    await note(tarek.id, '   ').expect(400);
    await note(tarek.id, 'x'.repeat(1001)).expect(400);
  });

  it('changes the stage and the hot mark; Won counts towards the target and moving back takes it off', async () => {
    const dina = (await list()).find((l) => l.name === 'دينا رأفت')!;
    expect((await patch(dina.id, { stage: 'negotiation' }).expect(200)).body).toMatchObject({ stage: 'negotiation' });
    expect((await patch(dina.id, { hot: true }).expect(200)).body).toMatchObject({ hot: true, stage: 'negotiation' });

    await patch(dina.id, { stage: 'won' }).expect(200);
    expect((await today()).target.won).toBe(2);
    await patch(dina.id, { stage: 'won' }).expect(200);
    expect((await today()).target.won).toBe(2);
    await patch(dina.id, { stage: 'contacted' }).expect(200);
    expect((await today()).target.won).toBe(1);
    const [row] = await db.select().from(leads).where(eq(leads.id, dina.id));
    expect(row!.wonAt).toBeNull();

    await patch(dina.id, { stage: 'sold' }).expect(400);
    await patch(dina.id, {}).expect(400);
    await patch(dina.id, { stage: 'won', name: 'x' }).expect(400);
  });

  it('never shows or changes another agent’s lead', async () => {
    const omarLead = (await list())[0]!;
    expect((await list(mariam)).some((l) => l.id === omarLead.id)).toBe(false);
    await http().get(`/v1/agent/leads/${omarLead.id}`).set(bearer(mariam)).expect(404);
    await patch(omarLead.id, { stage: 'lost' }, mariam).expect(404);
    await note(omarLead.id, 'hi', mariam).expect(404);
    await http().get('/v1/agent/leads/999999').set(bearer(omar)).expect(404);
    expect((await detail(omarLead.id)).stage).toBe(omarLead.stage);
  });

  it('a deleted client’s lead stays, without their name', async () => {
    await bookWithOmar();
    const id = (await list()).find((l) => l.isNew && l.name === 'Test User')!.id;
    await http().delete('/v1/me').set(bearer(client.accessToken)).send({ password: 'Secret123' }).expect(204);
    expect((await detail(id)).name).toBe('');
  });

  it('the seed adds the sample leads once', async () => {
    const before = (await list()).length;
    await seedSampleLeads(db);
    expect((await list()).length).toBe(before);
  });
});
