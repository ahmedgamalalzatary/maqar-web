import type { INestApplication } from '@nestjs/common';
import type { AdminListing, AdminOverview, ChatThread, ListingBody, Page, PropertyCard, PropertyDetail, SlotsResponse, UploadResponse, ViewingItem } from '@maqar/shared';
import sharp from 'sharp';
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

// Phase 25: the admin's overview counts what happened in the chosen range.
describe('Admin overview (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let omar: string;
  let omarId: number;
  let omarHomes: PropertyDetail[];
  const http = () => request(app.getHttpServer());
  const as = (token: string) => bearer(token);
  const overview = async (days = 30) => (await http().get(`/v1/admin/overview?days=${days}`).set(as(admin)).expect(200)).body as AdminOverview;
  const book = async (token: string, home: PropertyDetail, nth = 0) => {
    const days = ((await http().get(`/v1/properties/${home.id}/slots`).expect(200)).body as SlotsResponse).days;
    const at = days.slice(1).flatMap((d) => d.slots.filter((s) => s.state === 'free').map((s) => ({ date: d.date, time: s.time })))[nth]!;
    return (await http().post('/v1/viewings').set(as(token)).send({ propertyId: home.id, ...at, reminders: [] }).expect(201)).body as ViewingItem;
  };

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    omar = await signInSeeded(app, 'omar@maqar.app');
    omarId = ((await http().get('/v1/me').set(as(omar)).expect(200)).body as { id: number }).id;
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((c) => c.category !== 'stay');
    const details = await Promise.all(all.map(async (c) => (await http().get(`/v1/properties/${c.id}`).expect(200)).body as PropertyDetail));
    omarHomes = details.filter((d) => d.agent.id === omarId);
  });
  afterAll(async () => {
    await app.close();
  });

  it('is for admins only, for 7, 30 or 90 days', async () => {
    const c = await signUp(app);
    await http().get('/v1/admin/overview').expect(401);
    for (const token of [c.accessToken, omar]) await http().get('/v1/admin/overview').set(as(token)).expect(403);
    await http().get('/v1/admin/overview?days=15').set(as(admin)).expect(400);
    const o = await overview(7);
    expect(o.days).toBe(7);
    expect(o.daily).toHaveLength(7);
    expect(o.to).toBe(cairoClock(new Date()).date);
    expect(o.daily.at(-1)!.date).toBe(o.to);
    expect(o.daily[0]!.date).toBe(o.from);
  });

  it('counts what happens: clients, leads, viewings, chats, reports, listings, and each advisor’s numbers', async () => {
    const before = await overview(30);
    const omarBefore = before.agents.find((a) => a.id === omarId)!;

    // Two new clients; one books two homes, cancels one, and chats (then the agent reports it).
    const [a, b] = [await signUp(app), await signUp(app)];
    await book(a.accessToken, omarHomes[0]!, 2);
    const v2 = await book(a.accessToken, omarHomes[1]!, 3);
    await http().patch(`/v1/viewings/${v2.id}`).set(as(a.accessToken)).send({ action: 'cancel' }).expect(200);
    const t = (await http().post('/v1/chats').set(as(b.accessToken)).send({ propertyId: omarHomes[2]!.id }).expect(201)).body as ChatThread;
    await http().post(`/v1/chats/${t.id}/messages`).set(as(b.accessToken)).send({ kind: 'text', text: 'Hi' }).expect(201);
    // Out of the advisor's hours (after 21:00 Cairo) the chat also gets the automatic reply, so
    // count what the chat really holds instead of assuming one message.
    const sent = ((await http().get(`/v1/chats/${t.id}/messages`).set(as(b.accessToken)).expect(200)).body as { items: unknown[] }).items.length;
    await http().post(`/v1/chats/${t.id}/report`).set(as(omar)).send({ reason: 'spam' }).expect(201);
    // Omar wins b's lead.
    const leads = (await http().get('/v1/agent/leads').set(as(omar)).expect(200)).body as { id: number; name: string }[];
    const lead = leads.find((l) => l.name === b.user.name)!;
    await http().patch(`/v1/agent/leads/${lead.id}`).set(as(omar)).send({ stage: 'won' }).expect(200);
    // A new listing published to Omar, and another listing closed.
    const photo = (
      (await http().post('/v1/uploads').set(as(admin)).attach('photo', await sharp({ create: { width: 400, height: 300, channels: 3, background: '#999' } }).jpeg().toBuffer(), { filename: 'p.jpg', contentType: 'image/jpeg' }))
        .body as UploadResponse
    ).url;
    const body: ListingBody = { category: 'sale', type: 'apartment', areaId: 'new-cairo', price: 3_000_000, beds: 2, baths: 1, sizeM2: 100, finishing: 'full', delivery: 'ready', features: [], images: [photo] };
    const made = (await http().post('/v1/admin/listings').set(as(admin)).send(body).expect(201)).body as AdminListing;
    await http().post(`/v1/admin/listings/${made.id}/publish`).set(as(admin)).send({ agentId: omarId }).expect(200);
    await http().post(`/v1/admin/listings/${omarHomes[3]!.id}/close`).set(as(admin)).expect(200);

    const after = await overview(30);
    const omarAfter = after.agents.find((x) => x.id === omarId)!;
    expect(after.clients.new - before.clients.new).toBe(2);
    expect(after.clients.total - before.clients.total).toBe(2);
    // One lead per client and advisor: a booked two of Omar's homes, b chatted.
    expect(after.leads.new - before.leads.new).toBe(2);
    expect(after.leads.won - before.leads.won).toBe(1);
    expect(after.viewings.booked - before.viewings.booked).toBe(2);
    expect(after.viewings.cancelled - before.viewings.cancelled).toBe(1);
    expect(after.viewings.next7Days - before.viewings.next7Days).toBe(1);
    expect(after.chats.new - before.chats.new).toBe(1);
    expect(after.chats.messages - before.chats.messages).toBe(sent);
    expect(after.chats.openReports - before.chats.openReports).toBe(1);
    expect(after.listings.published - before.listings.published).toBe(1);
    expect(after.listings.closed - before.listings.closed).toBe(1);
    expect(after.listings.byStatus.approved - before.listings.byStatus.approved).toBe(0);
    expect(after.listings.byStatus.sold + after.listings.byStatus.rented - before.listings.byStatus.sold - before.listings.byStatus.rented).toBe(1);
    expect(omarAfter.wonThisMonth - omarBefore.wonThisMonth).toBe(1);
    expect(omarAfter.viewings - omarBefore.viewings).toBe(1);
    expect(omarAfter.live - omarBefore.live).toBe(0);
    expect(omarAfter.monthlyTarget).toBe(omarBefore.monthlyTarget);
    const [today, todayBefore] = [after.daily.at(-1)!, before.daily.at(-1)!];
    expect([today.clients - todayBefore.clients, today.leads - todayBefore.leads, today.viewings - todayBefore.viewings]).toEqual([2, 2, 2]);
  });
});
