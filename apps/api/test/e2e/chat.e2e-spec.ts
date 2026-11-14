import type { INestApplication } from '@nestjs/common';
import type { AuthResponse, ChatMessage, ChatPage, ChatThread, LeadCard, LeadDetail, NotificationsResponse, Page, PropertyCard, PropertyDetail, SlotsResponse, ViewingItem } from '@maqar/shared';
import { and, eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { agentDaysOff, agentHours } from '../../src/modules/agents/agents.schema.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { chatMessages } from '../../src/modules/chat/chat.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { users } from '../../src/modules/users/users.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { cairoClock } from '../../src/modules/viewings/slots.js';
import { viewings } from '../../src/modules/viewings/viewings.schema.js';
import { ViewingsService } from '../../src/modules/viewings/viewings.service.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

// Phase 16: live chat (contract §8.12, §10.3).
describe('Chat (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let url: string;
  let omar: string;
  let omarId: number;
  let mariam: string;
  let homes: PropertyDetail[];
  let client: AuthResponse;
  const sockets: Socket[] = [];
  const http = () => request(app.getHttpServer());

  const start = async (token: string, propertyId: number) =>
    (await http().post('/v1/chats').set(bearer(token)).send({ propertyId }).expect(201)).body as ChatThread;
  const send = (token: string, id: number, body: Record<string, unknown>) => http().post(`/v1/chats/${id}/messages`).set(bearer(token)).send(body);
  const list = async (token: string) => (await http().get('/v1/chats').set(bearer(token)).expect(200)).body as ChatThread[];
  const page = async (token: string, id: number, q = '') => (await http().get(`/v1/chats/${id}/messages${q}`).set(bearer(token)).expect(200)).body as ChatPage;
  const inbox = async (token: string) => (await http().get('/v1/notifications').set(bearer(token)).expect(200)).body as NotificationsResponse;
  const connect = (token: string | undefined) =>
    new Promise<Socket>((resolve, reject) => {
      const s = io(url, { path: '/v1/socket.io', auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
      sockets.push(s);
      s.on('connect', () => setTimeout(() => (s.connected ? resolve(s) : reject(new Error('dropped'))), 150));
      s.on('denied', () => reject(new Error('denied')));
      s.on('connect_error', reject);
    });
  const next = <T>(s: Socket, event: string) => new Promise<T>((resolve) => s.once(event, resolve));
  /** An Omar home (not a stay), each test its own. */
  let n = 0;
  const aHome = () => homes[n++ % homes.length]!;

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    await app.listen(0);
    url = await app.getUrl();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    omar = await signInSeeded(app, 'omar@maqar.app');
    mariam = await signInSeeded(app, 'mariam@maqar.app');
    omarId = (await db.select({ id: users.id }).from(users).where(eq(users.email, 'omar@maqar.app')))[0]!.id;
    // Omar works around the clock in these tests, so the away reply only comes when a test asks for it.
    await db.update(agentHours).set({ fromHour: 0, toHour: 23 }).where(eq(agentHours.agentId, omarId));
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((c) => c.category !== 'stay');
    const details = await Promise.all(all.map(async (c) => (await http().get(`/v1/properties/${c.id}`).expect(200)).body as PropertyDetail));
    homes = details.filter((d) => d.agent.id === omarId);
  });
  beforeEach(async () => {
    client = await signUp(app);
  });
  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('conversations', () => {
    it('is for clients and agents; only clients start one', async () => {
      await http().get('/v1/chats').expect(401);
      const admin = await signInSeeded(app, 'admin@maqar.app');
      await http().get('/v1/chats').set(bearer(admin)).expect(403);
      await http().post('/v1/chats').set(bearer(omar)).send({ propertyId: aHome().id }).expect(403);
      await http().post('/v1/chats').set(bearer(client.accessToken)).send({ propertyId: 999999 }).expect(404);
    });

    it('one per client and home, with its advisor; it puts the client in the advisor’s leads', async () => {
      const home = aHome();
      const a = await start(client.accessToken, home.id);
      const b = await start(client.accessToken, home.id);
      expect(b.id).toBe(a.id);
      expect(a).toMatchObject({ property: { id: home.id }, agent: { id: omarId }, unread: 0, last: null });
      // Empty conversations are not listed.
      expect(await list(client.accessToken)).toEqual([]);
      const leads = (await http().get('/v1/agent/leads').set(bearer(omar)).expect(200)).body as LeadCard[];
      expect(leads.find((l) => l.name === 'Test User' && l.property?.id === home.id)).toMatchObject({ stage: 'new', source: 'chat' });
    });

    it('only its client and its agent can read or write it', async () => {
      const t = await start(client.accessToken, aHome().id);
      const stranger = await signUp(app);
      await http().get(`/v1/chats/${t.id}`).set(bearer(stranger.accessToken)).expect(404);
      await http().get(`/v1/chats/${t.id}/messages`).set(bearer(mariam)).expect(404);
      await send(stranger.accessToken, t.id, { kind: 'text', text: 'hi' }).expect(404);
      await send(mariam, t.id, { kind: 'text', text: 'hi' }).expect(404);
      await http().post(`/v1/chats/${t.id}/read`).set(bearer(mariam)).expect(404);
    });
  });

  describe('messages', () => {
    it('sends and lists them, the newest conversation first, with unread counts each side', async () => {
      const t = await start(client.accessToken, aHome().id);
      expect((await send(client.accessToken, t.id, { kind: 'text', text: '  لسه متاحة؟  ' }).expect(201)).body).toMatchObject({ sender: 'client', body: { kind: 'text', text: 'لسه متاحة؟' }, readAt: null });
      await send(client.accessToken, t.id, { kind: 'text', text: 'ممكن أعاينها؟' }).expect(201);
      const mine = await list(client.accessToken);
      expect(mine.map((x) => x.id)).toEqual([t.id]);
      expect(mine[0]).toMatchObject({ unread: 0, client: null, last: { body: { text: 'ممكن أعاينها؟' } } });
      const theirs = (await list(omar)).find((x) => x.id === t.id)!;
      expect(theirs).toMatchObject({ unread: 2, client: { name: 'Test User' } });
      expect(theirs.leadId).toEqual(expect.any(Number));
    });

    it('reading marks the other side’s messages, and counts drop', async () => {
      const t = await start(client.accessToken, aHome().id);
      await send(client.accessToken, t.id, { kind: 'text', text: 'hi' }).expect(201);
      await http().post(`/v1/chats/${t.id}/read`).set(bearer(omar)).expect(204);
      expect((await list(omar)).find((x) => x.id === t.id)!.unread).toBe(0);
      expect((await page(client.accessToken, t.id)).items[0]!.readAt).toEqual(expect.any(String));
      await send(omar, t.id, { kind: 'text', text: 'أهلاً' }).expect(201);
      expect((await list(client.accessToken))[0]!.unread).toBe(1);
    });

    it('pages back through the history, oldest first', async () => {
      const t = await start(client.accessToken, aHome().id);
      for (let i = 1; i <= 35; i++) await send(client.accessToken, t.id, { kind: 'text', text: `m${i}` }).expect(201);
      const first = await page(client.accessToken, t.id);
      expect(first.items).toHaveLength(30);
      expect(first.items[0]!.body).toEqual({ kind: 'text', text: 'm6' });
      expect(first.items.at(-1)!.body).toEqual({ kind: 'text', text: 'm35' });
      expect(first.hasMore).toBe(true);
      const older = await page(client.accessToken, t.id, `?before=${first.items[0]!.id}`);
      expect(older.items.map((m) => (m.body as { text: string }).text)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
      expect(older.hasMore).toBe(false);
    });

    it('refuses empty or long texts, and cards from clients', async () => {
      const t = await start(client.accessToken, aHome().id);
      await send(client.accessToken, t.id, { kind: 'text', text: '   ' }).expect(400);
      await send(client.accessToken, t.id, { kind: 'text', text: 'x'.repeat(2001) }).expect(400);
      await send(client.accessToken, t.id, { kind: 'property' }).expect(403);
      await send(client.accessToken, t.id, { kind: 'booking' }).expect(400);
    });

    it('agents send home, plan and tour cards; a home without a tour or plan says so', async () => {
      const withAll = homes.find((h) => h.tour && h.plan);
      const t = await start(client.accessToken, (withAll ?? aHome()).id);
      expect((await send(omar, t.id, { kind: 'property' }).expect(201)).body.body).toEqual({ kind: 'property' });
      if (withAll) {
        const plan = (await send(omar, t.id, { kind: 'plan' }).expect(201)).body as ChatMessage;
        expect(plan.body).toMatchObject({ kind: 'plan', price: withAll.price, downPct: withAll.plan!.downPct, years: withAll.plan!.years });
        await send(omar, t.id, { kind: 'tour' }).expect(201);
      }
      const plain = homes.find((h) => !h.tour);
      if (plain) {
        const p = await start(client.accessToken, plain.id);
        await send(omar, p.id, { kind: 'tour' }).expect(400);
      }
    });

    it('takes photos, resized and stored, as one message', async () => {
      const t = await start(client.accessToken, aHome().id);
      const sharp = (await import('sharp')).default;
      const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#b38959' } }).png().toBuffer();
      const res = await http().post(`/v1/chats/${t.id}/images`).set(bearer(client.accessToken)).attach('photos', png, { filename: 'a.png', contentType: 'image/png' }).attach('photos', png, { filename: 'b.png', contentType: 'image/png' }).expect(201);
      const body = (res.body as ChatMessage).body as { kind: 'images'; urls: string[] };
      expect(body.kind).toBe('images');
      expect(body.urls).toHaveLength(2);
      expect(body.urls[0]).toMatch(new RegExp(`^/uploads/chat/${t.id}/[\\w-]+\\.jpg$`));
      const served = await http().get(body.urls[0]!).expect(200);
      const meta = await sharp(served.body as Buffer).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1600, 800]);
      await http().post(`/v1/chats/${t.id}/images`).set(bearer(client.accessToken)).attach('photos', Buffer.from('not a photo'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
    });
  });

  describe('booking from a times card', () => {
    const freeDay = async (homeId: number) => {
      const { days } = (await http().get(`/v1/properties/${homeId}/slots`).expect(200)).body as SlotsResponse;
      return days.slice(2).find((d) => weekdayOf(d.date) !== 5 && d.slots.filter((s) => s.state === 'free').length >= 2)!;
    };

    const viewingsOf = async (token: string) => (await http().get('/v1/viewings').set(bearer(token)).expect(200)).body as ViewingItem[];
    const answer = (token: string, threadId: number, messageId: number, body: Record<string, unknown>) =>
      http().post(`/v1/chats/${threadId}/messages/${messageId}/answer`).set(bearer(token)).send(body);
    const hourState = async (homeId: number, date: string, time: string) =>
      ((await http().get(`/v1/properties/${homeId}/slots`).expect(200)).body as SlotsResponse).days.find((d) => d.date === date)!.slots.find((s) => s.time === time)!.state;
    /** A client's booking from a times card, and the request card the pick posts. */
    const requested = async () => {
      const home = aHome();
      const t = await start(client.accessToken, home.id);
      const day = await freeDay(home.id);
      const card = (await send(omar, t.id, { kind: 'slots', date: day.date }).expect(201)).body as ChatMessage;
      const times = (card.body as { times: string[] }).times;
      const res = await http().post(`/v1/chats/${t.id}/messages/${card.id}/book`).set(bearer(client.accessToken)).send({ time: times[1] }).expect(201);
      const req = (await page(client.accessToken, t.id)).items.at(-1)!;
      return { home, t, day, card, times, viewing: res.body.viewing as ViewingItem, slotsCard: res.body.card as ChatMessage, req };
    };

    // Owner, 2026-11-14: a time picked in the chat is a request; the advisor accepts, declines or moves it.
    it('books the picked time as a request: the hour is held, and the chat says what the client booked', async () => {
      const { home, t, day, times, viewing, slotsCard, req, card } = await requested();
      expect(times).toEqual(day.slots.filter((s) => s.state === 'free').map((s) => s.time));
      expect(viewing).toMatchObject({ status: 'pending', date: day.date, time: times[1], property: { id: home.id } });
      expect(slotsCard.body).toMatchObject({ kind: 'slots', chosen: times[1] });
      // The automatic message, from the client's side, unread by the advisor, who is told.
      expect(req).toMatchObject({ sender: 'client', readAt: null, body: { kind: 'booking', viewingId: viewing.id, date: day.date, time: times[1], state: 'pending' } });
      expect((await list(omar)).find((x) => x.id === t.id)!.unread).toBeGreaterThan(0);
      expect((await inbox(omar)).items[0]).toMatchObject({ kind: 'chat', href: `/agent/chat/${t.id}` });
      expect((await viewingsOf(client.accessToken)).find((v) => v.id === viewing.id)!.status).toBe('pending');
      expect(await hourState(home.id, day.date, times[1]!)).toBe('taken');
      await http().post(`/v1/chats/${t.id}/messages/${card.id}/book`).set(bearer(client.accessToken)).send({ time: times[0] }).expect(409);
    });

    it('the advisor accepts: the viewing is confirmed, the request is marked, and a confirmation follows', async () => {
      const { t, req, viewing, times, day } = await requested();
      const reminders = app.get(ViewingsService);
      // No reminder goes out for a viewing that is not confirmed yet.
      const before = new Date(Date.parse(viewing.startsAt) - 90 * 60_000);
      expect(await reminders.sendDueReminders(before)).toBe(0);
      await answer(client.accessToken, t.id, req.id, { action: 'accept' }).expect(403);

      const res = await answer(omar, t.id, req.id, { action: 'accept' }).expect(201);
      expect(res.body.viewing).toMatchObject({ id: viewing.id, status: 'confirmed' });
      expect(res.body.card).toMatchObject({ id: req.id, body: { state: 'accepted' } });
      const last = (await page(client.accessToken, t.id)).items.at(-1)!;
      expect(last).toMatchObject({ sender: 'agent', body: { kind: 'booking', viewingId: viewing.id, date: day.date, time: times[1], state: 'accepted' } });
      expect((await inbox(client.accessToken)).items[0]).toMatchObject({ kind: 'booking', titleEn: 'Viewing confirmed' });
      expect(await reminders.sendDueReminders(before)).toBe(1);
      await answer(omar, t.id, req.id, { action: 'decline' }).expect(409);
    });

    it('the advisor declines: the hour is free again and the client can book again', async () => {
      const { home, t, req, viewing, times, day } = await requested();
      const res = await answer(omar, t.id, req.id, { action: 'decline' }).expect(201);
      expect(res.body.viewing).toMatchObject({ id: viewing.id, status: 'cancelled' });
      expect(res.body.card.body).toMatchObject({ state: 'declined' });
      expect((await page(client.accessToken, t.id)).items.at(-1)!.body).toMatchObject({ kind: 'booking', state: 'declined' });
      expect((await inbox(client.accessToken)).items[0]).toMatchObject({ kind: 'booking', titleEn: 'Viewing cancelled' });
      expect(await hourState(home.id, day.date, times[1]!)).toBe('free');
      const again = (await send(omar, t.id, { kind: 'slots', date: day.date }).expect(201)).body as ChatMessage;
      await http().post(`/v1/chats/${t.id}/messages/${again.id}/book`).set(bearer(client.accessToken)).send({ time: times[0] }).expect(201);
    });

    it('the advisor moves it to another free hour, which is confirmed', async () => {
      const { home, t, req, viewing, times, day } = await requested();
      await answer(omar, t.id, req.id, { action: 'reschedule', date: day.date }).expect(400);
      await answer(omar, t.id, req.id, { action: 'reschedule', date: day.date, time: '03:30' }).expect(400);
      const res = await answer(omar, t.id, req.id, { action: 'reschedule', date: day.date, time: times[0] }).expect(201);
      expect(res.body.viewing).toMatchObject({ id: viewing.id, status: 'rescheduled', date: day.date, time: times[0] });
      expect(res.body.card.body).toMatchObject({ state: 'moved' });
      expect((await page(client.accessToken, t.id)).items.at(-1)!.body).toMatchObject({ kind: 'booking', state: 'moved', date: day.date, time: times[0] });
      expect((await inbox(client.accessToken)).items[0]).toMatchObject({ kind: 'booking', titleEn: 'Viewing rescheduled' });
      expect(await hourState(home.id, day.date, times[1]!)).toBe('free');
      expect(await hourState(home.id, day.date, times[0]!)).toBe('taken');
    });

    it('a request the client cancelled first can no longer be answered, and its card says so', async () => {
      const { t, req, viewing } = await requested();
      await http().patch(`/v1/viewings/${viewing.id}`).set(bearer(client.accessToken)).send({ action: 'cancel' }).expect(200);
      await answer(omar, t.id, req.id, { action: 'accept' }).expect(409);
      expect((await page(omar, t.id)).items.find((m) => m.id === req.id)!.body).toMatchObject({ state: 'cancelled' });
    });

    // CodeRabbit (2026-11-14): two answers at once, and writes that stopped half-way.
    it('takes one of two answers sent at the same moment', async () => {
      const { t, req, viewing } = await requested();
      const [a, b] = await Promise.all([answer(omar, t.id, req.id, { action: 'accept' }), answer(omar, t.id, req.id, { action: 'decline' })]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      const won = a.status === 201 ? 'confirmed' : 'cancelled';
      expect((await viewingsOf(client.accessToken)).find((v) => v.id === viewing.id)!.status).toBe(won);
      expect((await page(omar, t.id)).items.filter((m) => m.body.kind === 'booking' && m.sender === 'agent')).toHaveLength(1);
    });

    it('a booking whose request card was never stored gets it on the retry', async () => {
      const { t, card, times, viewing, req } = await requested();
      // As if the server stopped after booking, before the card was written.
      await db.delete(chatMessages).where(eq(chatMessages.id, req.id));
      const res = await http().post(`/v1/chats/${t.id}/messages/${card.id}/book`).set(bearer(client.accessToken)).send({ time: times[1] }).expect(201);
      expect(res.body.viewing).toMatchObject({ id: viewing.id, status: 'pending' });
      const requests = (await page(omar, t.id)).items.filter((m) => m.body.kind === 'booking');
      expect(requests).toHaveLength(1);
      expect(requests[0]!.body).toMatchObject({ viewingId: viewing.id, state: 'pending' });
      // Another try finds it there and adds nothing.
      await http().post(`/v1/chats/${t.id}/messages/${card.id}/book`).set(bearer(client.accessToken)).send({ time: times[1] }).expect(201);
      expect((await page(omar, t.id)).items.filter((m) => m.body.kind === 'booking')).toHaveLength(1);
    });

    it('an answer whose chat cards were never written is finished on the retry, with what was really done', async () => {
      const { t, req, viewing, times, day } = await requested();
      // As if the server stopped after moving the viewing, before the chat was told.
      await app.get(ViewingsService).answer({ id: omarId, role: 'agent' } as never, viewing.id, { action: 'reschedule', date: day.date, time: times[0]! });
      await answer(omar, t.id, req.id, { action: 'accept' }).expect(409);
      const items = (await page(omar, t.id)).items;
      expect(items.find((m) => m.id === req.id)!.body).toMatchObject({ state: 'moved' });
      expect(items.at(-1)).toMatchObject({ sender: 'agent', body: { kind: 'booking', state: 'moved', date: day.date, time: times[0] } });
    });

    it('a request nobody answered before its time is closed with the past viewings', async () => {
      const { viewing } = await requested();
      await db.update(viewings).set({ startsAt: new Date(Date.now() - 3_600_000) }).where(eq(viewings.id, viewing.id));
      await app.get(ViewingsService).completePastViewings();
      const [row] = await db.select({ status: viewings.status }).from(viewings).where(eq(viewings.id, viewing.id));
      expect(row!.status).toBe('cancelled');
    });

    it('refuses a time not on the card, the agent booking, and a day with no free hours', async () => {
      const home = aHome();
      const t = await start(client.accessToken, home.id);
      const day = await freeDay(home.id);
      const card = (await send(omar, t.id, { kind: 'slots', date: day.date }).expect(201)).body as ChatMessage;
      await http().post(`/v1/chats/${t.id}/messages/${card.id}/book`).set(bearer(client.accessToken)).send({ time: '03:30' }).expect(400);
      await http().post(`/v1/chats/${t.id}/messages/${card.id}/book`).set(bearer(omar)).send({ time: '10:00' }).expect(403);
      await send(omar, t.id, { kind: 'slots', date: '2020-01-01' }).expect(400);
      const text = (await send(omar, t.id, { kind: 'text', text: 'hi' }).expect(201)).body as ChatMessage;
      await http().post(`/v1/chats/${t.id}/messages/${text.id}/book`).set(bearer(client.accessToken)).send({ time: '10:00' }).expect(404);
    });
  });

  describe('out of hours', () => {
    it('replies once, in the client’s language, until the agent answers in person', async () => {
      const today = cairoClock(new Date()).date;
      await db.insert(agentDaysOff).values({ agentId: omarId, date: today, reason: 'Test' });
      try {
        const t = await start(client.accessToken, aHome().id);
        await send(client.accessToken, t.id, { kind: 'text', text: 'hi' }).expect(201);
        await send(client.accessToken, t.id, { kind: 'text', text: 'anyone?' }).expect(201);
        let items = (await page(client.accessToken, t.id)).items;
        expect(items.map((m) => m.sender)).toEqual(['client', 'agent', 'client']);
        expect(items[1]!.body).toMatchObject({ kind: 'text', auto: true });
        expect((items[1]!.body as { text: string }).text).toContain('مواعيد');
        await send(omar, t.id, { kind: 'text', text: 'أنا هنا' }).expect(201);
        await send(client.accessToken, t.id, { kind: 'text', text: 'تمام' }).expect(201);
        items = (await page(client.accessToken, t.id)).items;
        expect(items.filter((m) => m.body.kind === 'text' && m.body.auto)).toHaveLength(2);
      } finally {
        await db.delete(agentDaysOff).where(and(eq(agentDaysOff.agentId, omarId), eq(agentDaysOff.date, today)));
      }
    });
  });

  describe('live (socket)', () => {
    it('turns away a missing or bad token, and staff other than agents', async () => {
      await expect(connect(undefined)).rejects.toThrow();
      await expect(connect('not-a-token')).rejects.toThrow();
      await expect(connect(await signInSeeded(app, 'admin@maqar.app'))).rejects.toThrow();
    });

    it('brings messages, typing and read receipts to the other side at once', async () => {
      const t = await start(client.accessToken, aHome().id);
      const [me, agent] = await Promise.all([connect(client.accessToken), connect(omar)]);
      const arrived = next<{ message: ChatMessage }>(agent, 'message');
      await send(client.accessToken, t.id, { kind: 'text', text: 'live?' }).expect(201);
      expect((await arrived).message).toMatchObject({ threadId: t.id, sender: 'client', body: { text: 'live?' } });

      const typing = next<{ threadId: number; sender: string }>(me, 'typing');
      agent.emit('typing', { threadId: t.id });
      expect(await typing).toEqual({ threadId: t.id, sender: 'agent' });

      const read = next<{ threadId: number; reader: string }>(me, 'read');
      await http().post(`/v1/chats/${t.id}/read`).set(bearer(omar)).expect(204);
      expect(await read).toMatchObject({ threadId: t.id, reader: 'agent' });
    });

    it('typing in someone else’s conversation reaches nobody', async () => {
      const t = await start(client.accessToken, aHome().id);
      const [me, other] = await Promise.all([connect(client.accessToken), connect(mariam)]);
      let heard = false;
      me.on('typing', () => (heard = true));
      other.emit('typing', { threadId: t.id });
      await new Promise((r) => setTimeout(r, 300));
      expect(heard).toBe(false);
    });

    it('notifies unless the conversation is open', async () => {
      const t = await start(client.accessToken, aHome().id);
      const before = (await inbox(client.accessToken)).items.length;
      await send(omar, t.id, { kind: 'text', text: 'closed' }).expect(201);
      const closed = (await inbox(client.accessToken)).items;
      expect(closed).toHaveLength(before + 1);
      expect(closed[0]).toMatchObject({ kind: 'chat', titleEn: 'Omar Hassan', bodyEn: 'closed', href: `/chat/${t.id}` });

      const me = await connect(client.accessToken);
      me.emit('open', { threadId: t.id });
      await new Promise((r) => setTimeout(r, 200));
      await send(omar, t.id, { kind: 'text', text: 'open' }).expect(201);
      expect((await inbox(client.accessToken)).items).toHaveLength(before + 1);

      // And the agent hears of the client's message, opening the agent's conversation screen.
      await send(client.accessToken, t.id, { kind: 'text', text: 'thanks' }).expect(201);
      expect((await inbox(omar)).items[0]).toMatchObject({ kind: 'chat', titleEn: 'Test User', href: `/agent/chat/${t.id}` });
    });
  });

  it('the lead page links to the conversation', async () => {
    const home = aHome();
    const t = await start(client.accessToken, home.id);
    await send(client.accessToken, t.id, { kind: 'text', text: 'hi' }).expect(201);
    const lead = ((await http().get('/v1/agent/leads').set(bearer(omar)).expect(200)).body as LeadCard[]).find((l) => l.name === 'Test User' && l.property?.id === home.id)!;
    expect(((await http().get(`/v1/agent/leads/${lead.id}`).set(bearer(omar)).expect(200)).body as LeadDetail).chatId).toBe(t.id);
  });

  it('deleting the account deletes the client’s conversations and their photos', async () => {
    const t = await start(client.accessToken, aHome().id);
    await send(client.accessToken, t.id, { kind: 'text', text: 'bye' }).expect(201);
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#b38959' } }).png().toBuffer();
    const photo = ((await http().post(`/v1/chats/${t.id}/images`).set(bearer(client.accessToken)).attach('photos', png, { filename: 'a.png', contentType: 'image/png' }).expect(201)).body as ChatMessage).body as { urls: string[] };
    await http().get(photo.urls[0]!).expect(200);
    await http().delete('/v1/me').set(bearer(client.accessToken)).send({ password: 'Secret123' }).expect(204);
    expect((await list(omar)).some((x) => x.id === t.id)).toBe(false);
    expect(await db.select().from(chatMessages).where(eq(chatMessages.threadId, t.id))).toEqual([]);
    await http().get(photo.urls[0]!).expect(404);
  });
});
