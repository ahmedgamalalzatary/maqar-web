import type { INestApplication } from '@nestjs/common';
import {
  type AdminListing,
  type ChatThread,
  type ListingBody,
  type Page,
  type PropertyCard,
  type PropertyDetail,
  REPORT_IDS,
  type ReportId,
  type ReportResult,
  type ReportTable,
  REPORTS,
  type SlotsResponse,
  type UploadResponse,
  type ViewingItem,
} from '@maqar/shared';
import { eq, sql } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { chatMessages, chatThreads } from '../../src/modules/chat/chat.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { cairoClock } from '../../src/modules/viewings/slots.js';
import { viewings } from '../../src/modules/viewings/viewings.schema.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 27: the admin's reports count what happened, by range and filter.
describe('Admin reports (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let admin: string;
  let omar: string;
  let omarId: number;
  let omarHomes: PropertyDetail[];
  let otherAgentId: number;
  const http = () => request(app.getHttpServer());
  const as = (token: string) => bearer(token);
  // One advisor's report (phase 29) is always about someone: Omar, unless the test says otherwise.
  const report = async (id: ReportId, q: Record<string, string | number> = {}) =>
    (await http().get(`/v1/admin/analytics/${id}`).query(id === 'advisor' ? { agentId: omarId, ...q } : q).set(as(admin)).expect(200)).body as ReportResult;
  const kpi = (r: ReportResult, key: string) => r.kpis.find((k) => k.key === key)!.value ?? 0;
  const table = (r: ReportResult, key: string) => r.tables.find((t) => t.key === key)!;
  const rowOf = (t: ReportTable, kind: string, id: number) => t.rows.find((x) => x.link?.kind === kind && x.link.id === id);
  const book = async (token: string, home: PropertyDetail, nth = 0) => {
    const days = ((await http().get(`/v1/properties/${home.id}/slots`).expect(200)).body as SlotsResponse).days;
    const at = days.slice(1).flatMap((d) => d.slots.filter((s) => s.state === 'free').map((s) => ({ date: d.date, time: s.time })))[nth]!;
    return (await http().post('/v1/viewings').set(as(token)).send({ propertyId: home.id, ...at, reminders: [] }).expect(201)).body as ViewingItem;
  };

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    omar = await signInSeeded(app, 'omar@maqar.app');
    omarId = ((await http().get('/v1/me').set(as(omar)).expect(200)).body as { id: number }).id;
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((c) => c.category !== 'stay');
    const details = await Promise.all(all.map(async (c) => (await http().get(`/v1/properties/${c.id}`).expect(200)).body as PropertyDetail));
    omarHomes = details.filter((d) => d.agent.id === omarId);
    otherAgentId = details.find((d) => d.agent.id !== omarId)!.agent.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('is for admins only, checks the range and refuses a filter the report does not take', async () => {
    const c = await signUp(app);
    await http().get('/v1/admin/analytics/deals').expect(401);
    for (const token of [c.accessToken, omar]) await http().get('/v1/admin/analytics/deals').set(as(token)).expect(403);
    const bad = async (path: string, q: Record<string, string | number> = {}) => (await http().get(`/v1/admin/analytics/${path}`).query(q).set(as(admin)).expect(400)).body as { message: string | string[] };
    await bad('nope');
    const today = cairoClock(new Date()).date;
    expect((await bad('deals', { from: '2026-01-01' })).message).toMatch(/both/);
    expect((await bad('deals', { from: today, to: '2099-01-01' })).message).toMatch(/after today/);
    expect((await bad('deals', { from: today, to: '2020-01-01' })).message).toMatch(/after to/);
    expect((await bad('deals', { from: '2020-01-01', to: today })).message).toMatch(/366/);
    expect((await bad('deals', { from: '2026-02-30', to: today })).message).toMatch(/real dates/);
    expect((await bad('advisors', { agentId: omarId })).message).toMatch(/advisor/);
    expect((await bad('chats', { category: 'sale' })).message).toMatch(/category/);
    // One advisor's report needs the advisor, and a real one.
    expect((await bad('advisor')).message).toMatch(/advisor/);
    await http().get('/v1/admin/analytics/advisor').query({ agentId: 999_999 }).set(as(admin)).expect(404);
    await bad('deals', { category: 'castle' });
  });

  it('every report answers in the shared shape; ranged ones default to the last 30 days with the 30 before', async () => {
    const today = cairoClock(new Date()).date;
    for (const id of REPORT_IDS) {
      const r = await report(id);
      const spec = REPORTS.find((s) => s.id === id)!;
      expect(r.id).toBe(id);
      if (spec.ranged) {
        expect(r.range).toMatchObject({ to: today, days: 30 });
        expect(r.previous!.to < r.range!.from).toBe(true);
      } else {
        expect([r.range, r.previous]).toEqual([null, null]);
      }
      expect(r.kpis.length).toBeGreaterThan(0);
      expect(r.tables.length).toBeGreaterThan(0);
      for (const t of r.tables) for (const row of t.rows) for (const col of t.columns) expect(row.cells).toHaveProperty(col.key);
      for (const ch of r.charts) if (ch.kind === 'daily') expect(ch.points).toHaveLength(30);
    }
  });

  it('counts what happens, in every report', async () => {
    const before = Object.fromEntries(await Promise.all(REPORT_IDS.map(async (id) => [id, await report(id)] as const))) as Record<ReportId, ReportResult>;
    const omarBefore = rowOf(table(before.advisors, 'advisors'), 'agent', omarId)!.cells;

    // Two clients: a books two of Omar's homes and cancels one; b chats, and Omar answers.
    const [a, b] = [await signUp(app, { name: 'Report Client A' }), await signUp(app, { name: 'Report Client B' })];
    await book(a.accessToken, omarHomes[0]!, 2);
    const v2 = await book(a.accessToken, omarHomes[1]!, 3);
    await http().patch(`/v1/viewings/${v2.id}`).set(as(a.accessToken)).send({ action: 'cancel' }).expect(200);
    const t = (await http().post('/v1/chats').set(as(b.accessToken)).send({ propertyId: omarHomes[2]!.id }).expect(201)).body as ChatThread;
    await http().post(`/v1/chats/${t.id}/messages`).set(as(b.accessToken)).send({ kind: 'text', text: 'Is it still free?' }).expect(201);
    await http().post(`/v1/chats/${t.id}/messages`).set(as(omar)).send({ kind: 'text', text: 'Yes' }).expect(201);
    // a also asks about another home and is still waiting, two hours on.
    const w = (await http().post('/v1/chats').set(as(a.accessToken)).send({ propertyId: omarHomes[3]!.id }).expect(201)).body as ChatThread;
    await http().post(`/v1/chats/${w.id}/messages`).set(as(a.accessToken)).send({ kind: 'text', text: 'Hello?' }).expect(201);
    await db.update(chatMessages).set({ createdAt: sql`now(3) - interval 2 hour` }).where(eq(chatMessages.threadId, w.id));
    await db.update(chatThreads).set({ lastMessageAt: sql`now(3) - interval 2 hour` }).where(eq(chatThreads.id, w.id));
    // Omar wins b's lead and loses a's.
    const leads = (await http().get('/v1/agent/leads').set(as(omar)).expect(200)).body as { id: number; name: string }[];
    await http().patch(`/v1/agent/leads/${leads.find((l) => l.name === b.user.name)!.id}`).set(as(omar)).send({ stage: 'won' }).expect(200);
    await http().patch(`/v1/agent/leads/${leads.find((l) => l.name === a.user.name)!.id}`).set(as(omar)).send({ stage: 'lost' }).expect(200);
    // A new listing (one photo, no pin, no tour) published to Omar, its price dropped; another closed.
    const photo = (
      (await http().post('/v1/uploads').set(as(admin)).attach('photo', await sharp({ create: { width: 400, height: 300, channels: 3, background: '#999' } }).jpeg().toBuffer(), { filename: 'p.jpg', contentType: 'image/jpeg' }))
        .body as UploadResponse
    ).url;
    const body: ListingBody = { category: 'sale', type: 'apartment', areaId: 'new-cairo', price: 3_000_000, beds: 2, baths: 1, sizeM2: 100, finishing: 'full', delivery: 'ready', features: [], images: [photo] };
    const made = (await http().post('/v1/admin/listings').set(as(admin)).send(body).expect(201)).body as AdminListing;
    await http().post(`/v1/admin/listings/${made.id}/publish`).set(as(admin)).send({ agentId: omarId }).expect(200);
    await http().patch(`/v1/admin/listings/${made.id}`).set(as(admin)).send({ price: 2_700_000 }).expect(200);
    const closed = omarHomes.at(-1)!;
    await http().post(`/v1/admin/listings/${closed.id}/close`).set(as(admin)).expect(200);

    const after = Object.fromEntries(await Promise.all(REPORT_IDS.map(async (id) => [id, await report(id)] as const))) as Record<ReportId, ReportResult>;
    const delta = (id: ReportId, key: string) => kpi(after[id], key) - kpi(before[id], key);

    // Closed deals: the closed home, with its asking price and days on the market.
    expect(delta('deals', 'deals')).toBe(1);
    expect(delta('deals', 'leadsWon')).toBe(1);
    const deal = rowOf(table(after.deals, 'deals'), 'listing', closed.id)!;
    expect(deal.cells.price).toBe(closed.price);
    expect(typeof deal.cells.days).toBe('number');

    // Advisor performance: Omar's row moved.
    const omarAfter = rowOf(table(after.advisors, 'advisors'), 'agent', omarId)!.cells;
    expect((omarAfter.leads as number) - (omarBefore.leads as number)).toBe(2);
    expect((omarAfter.won as number) - (omarBefore.won as number)).toBe(1);
    expect((omarAfter.lost as number) - (omarBefore.lost as number)).toBe(1);
    expect((omarAfter.booked as number) - (omarBefore.booked as number)).toBe(2);
    expect((omarAfter.cancelled as number) - (omarBefore.cancelled as number)).toBe(1);
    expect(omarAfter.reply).not.toBeNull();

    // One advisor (phase 29): Omar's own report has his row's numbers, and his work only.
    for (const key of ['leads', 'won', 'lost', 'booked', 'cancelled', 'open'] as const) expect(kpi(after.advisor, key)).toBe(omarAfter[key]);
    expect(delta('advisor', 'leads')).toBe(2);
    expect(table(after.advisor, 'leads').rows.map((r) => r.cells.client)).toEqual(expect.arrayContaining([a.user.name, b.user.name]));
    expect(rowOf(table(after.advisor, 'viewings'), 'listing', omarHomes[0]!.id)).toBeDefined();
    expect(rowOf(table(after.advisor, 'listings'), 'listing', made.id)).toBeDefined();
    expect(rowOf(table(after.advisor, 'deals'), 'listing', closed.id)).toBeDefined();
    const other = await report('advisor', { agentId: otherAgentId });
    expect(table(other, 'leads').rows.map((r) => r.cells.client)).not.toContain(a.user.name);
    expect(rowOf(table(other, 'listings'), 'listing', made.id)).toBeUndefined();

    // Leads: one per client and advisor, so two new (a booked and chatted, b chatted), one won, one lost.
    expect(delta('leads', 'leads')).toBe(2);
    expect(delta('leads', 'won')).toBe(1);
    expect(delta('leads', 'lost')).toBe(1);
    expect(table(after.leads, 'sources').rows.map((r) => r.cells.source)).toEqual(expect.arrayContaining([expect.objectContaining({ en: 'Chat' })]));

    // Inventory: one more live, one fewer live: no change; one more closed.
    expect(delta('inventory', 'live')).toBe(0);
    expect(delta('inventory', 'closed')).toBe(1);

    // Listing performance: two viewings and two chats booked on Omar's homes.
    expect(delta('listings', 'viewings')).toBe(2);
    expect(delta('listings', 'chats')).toBe(2);

    // Price changes: the drop, by the admin, 10% down.
    expect(delta('prices', 'drops')).toBe(1);
    const change = rowOf(table(after.prices, 'changes'), 'listing', made.id)!;
    expect([change.cells.old, change.cells.new]).toEqual([3_000_000, 2_700_000]);
    expect(change.cells.change).toBeCloseTo(-0.1);

    // Listing quality: the new listing lacks photos, a pin, descriptions, a tour, a video and the owner's phone.
    const q = rowOf(table(after.quality, 'listings'), 'listing', made.id)!;
    expect(q.cells.score).toBe(0);
    expect(q.cells.photos).toBe(1);

    // Clients: two sign-ups, both active.
    expect(delta('clients', 'signUps')).toBe(2);
    expect(delta('clients', 'active')).toBe(2);

    // Demand by area and viewings.
    expect(delta('areas', 'leads')).toBe(2);
    expect(delta('viewings', 'booked')).toBe(2);
    expect(delta('viewings', 'cancelled')).toBe(1);
    const cancelledBy = after.viewings.charts.find((c) => c.key === 'cancelledBy');
    expect(cancelledBy?.kind === 'bars' && cancelledBy.bars.find((x) => x.label.en === 'The client')!.value).toBe(1);

    // Chats: two new conversations; a is waiting, as a row that opens the chat.
    expect(delta('chats', 'conversations')).toBe(2);
    expect(delta('chats', 'waiting')).toBe(1);
    expect(rowOf(table(after.chats, 'waiting'), 'chat', w.id)).toBeDefined();
  });

  it('narrows by advisor, area and category, and compares with the previous period', async () => {
    const today = cairoClock(new Date()).date;
    const all = await report('deals');
    const mine = await report('deals', { agentId: omarId });
    expect(kpi(mine, 'deals')).toBeGreaterThan(0);
    expect(kpi(mine, 'deals')).toBeLessThanOrEqual(kpi(all, 'deals'));
    expect(table(mine, 'deals').rows.every((r) => r.cells.advisor !== null)).toBe(true);
    expect(kpi(await report('deals', { agentId: 999_999 }), 'deals')).toBe(0);
    expect(kpi(await report('deals', { category: 'stay' }), 'deals')).toBe(0);
    // Today only: the deal is today; the day before has none, so it shows as the previous value 0.
    const day = await report('deals', { from: today, to: today });
    expect(day.range).toEqual({ from: today, to: today, days: 1 });
    expect(kpi(day, 'deals')).toBeGreaterThan(0);
    expect(day.kpis.find((k) => k.key === 'deals')!.previous).toBe(0);
    expect(day.previous!.to < today).toBe(true);
  });

  it('lists in one advisor’s viewings a viewing cancelled in the range, even if booked and set for other days', async () => {
    const today = cairoClock(new Date()).date;
    const c = await signUp(app);
    const home = omarHomes[omarHomes.length - 1]!;
    const dayMs = 86_400_000;
    // Booked 60 days ago for 40 days from now, and cancelled today.
    await db.insert(viewings).values({
      propertyId: home.id,
      clientId: c.user.id,
      agentId: omarId,
      startsAt: new Date(Date.now() + 40 * dayMs),
      status: 'cancelled',
      cancelledBy: 'client',
      createdAt: new Date(Date.now() - 60 * dayMs),
    });
    const r = await report('advisor', { from: today, to: today });
    const cancelled = table(r, 'viewings').rows.filter((x) => (x.cells.status as { en: string } | null)?.en === 'Cancelled');
    expect(cancelled.some((x) => x.link?.id === home.id)).toBe(true);
    // Every cancellation the number counts has its row.
    expect(cancelled.length).toBeGreaterThanOrEqual(kpi(r, 'cancelled'));
  });
});
