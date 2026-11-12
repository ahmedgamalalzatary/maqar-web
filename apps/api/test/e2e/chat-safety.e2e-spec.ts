import type { INestApplication } from '@nestjs/common';
import type {
  AdminChatDetail,
  AdminChatsPage,
  AdminReportItem,
  AuthResponse,
  ChatPage,
  ChatReport,
  ChatThread,
  NotificationsResponse,
  Page,
  PropertyCard,
  PropertyDetail,
} from '@maqar/shared';
import { eq } from 'drizzle-orm';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { agentHours } from '../../src/modules/agents/agents.schema.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { users } from '../../src/modules/users/users.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 24: clients and agents report or block a conversation; admins read every chat and handle reports.
describe('Chat report, block and admin oversight (e2e)', () => {
  let app: INestApplication<App>;
  let url: string;
  let admin: string;
  let omar: string;
  let homes: PropertyDetail[];
  let client: AuthResponse;
  const sockets: Socket[] = [];
  const http = () => request(app.getHttpServer());
  const as = (token: string) => bearer(token);

  const start = async (token: string, propertyId: number) => (await http().post('/v1/chats').set(as(token)).send({ propertyId }).expect(201)).body as ChatThread;
  const send = (token: string, id: number, text = 'Hello') => http().post(`/v1/chats/${id}/messages`).set(as(token)).send({ kind: 'text', text });
  const report = (token: string, id: number, body: object = { reason: 'abuse', note: 'Rude messages' }) => http().post(`/v1/chats/${id}/report`).set(as(token)).send(body);
  const inbox = async (token: string) => ((await http().get('/v1/notifications').set(as(token)).expect(200)).body as NotificationsResponse).items;
  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const s = io(url, { path: '/v1/socket.io', auth: { token }, transports: ['websocket'], forceNew: true });
      sockets.push(s);
      s.on('connect', () => setTimeout(() => resolve(s), 150));
      s.on('connect_error', reject);
    });
  let n = 0;
  const aHome = () => homes[n++ % homes.length]!;
  /** A fresh conversation with one client message in it. */
  const conversation = async () => {
    const t = await start(client.accessToken, aHome().id);
    await send(client.accessToken, t.id, 'Is it still available?').expect(201);
    return t;
  };

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    await app.listen(0);
    url = await app.getUrl();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    omar = await signInSeeded(app, 'omar@maqar.app');
    const omarId = (await db.select({ id: users.id }).from(users).where(eq(users.email, 'omar@maqar.app')))[0]!.id;
    // Always in working hours, so no away reply joins the conversations.
    await db.update(agentHours).set({ fromHour: 0, toHour: 23 }).where(eq(agentHours.agentId, omarId));
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items.filter((c) => c.category !== 'stay');
    const details = await Promise.all(all.map(async (c) => (await http().get(`/v1/properties/${c.id}`).expect(200)).body as PropertyDetail));
    homes = details.filter((d) => d.agent.id === omarId);
  });
  beforeEach(async () => {
    client = await signUp(app, { name: 'Reported Client' });
  });
  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('report', () => {
    it('either side reports its own conversation, and the admins are told', async () => {
      const t = await conversation();
      const mine = (await report(omar, t.id).expect(201)).body as ChatReport;
      expect(mine).toMatchObject({ threadId: t.id, by: 'agent', reason: 'abuse', note: 'Rude messages', outcome: null, resolvedAt: null });
      await report(client.accessToken, t.id, { reason: 'spam' }).expect(201);
      const [note] = await inbox(admin);
      expect(note).toMatchObject({ titleEn: 'A chat was reported', href: `/admin/chat/${t.id}` });
    });

    it('only on one’s own conversation, with a known reason', async () => {
      const t = await conversation();
      const stranger = await signUp(app);
      await report(stranger.accessToken, t.id).expect(404);
      await report(admin, t.id).expect(403);
      await report(client.accessToken, t.id, { reason: 'boring' }).expect(400);
      await report(client.accessToken, t.id, { reason: 'other', note: 'x'.repeat(501) }).expect(400);
    });
  });

  describe('block', () => {
    it('closes the conversation for both sides, live, and nobody can send any more', async () => {
      const t = await conversation();
      const live = await connect(client.accessToken);
      const heard = new Promise<{ threadId: number; blocked: { by: string } | null }>((resolve) => live.once('blocked', resolve));
      const res = (await http().post(`/v1/chats/${t.id}/block`).set(as(omar)).expect(201)).body as ChatThread;
      expect(res.blocked).toMatchObject({ by: 'agent' });
      expect(await heard).toMatchObject({ threadId: t.id, blocked: { by: 'agent' } });
      const seen = (await http().get(`/v1/chats/${t.id}`).set(as(client.accessToken)).expect(200)).body as ChatThread;
      expect(seen.blocked).toMatchObject({ by: 'agent' });
      await send(client.accessToken, t.id).expect(409);
      await send(omar, t.id).expect(409);
      await http().post(`/v1/chats/${t.id}/images`).set(as(client.accessToken)).attach('photos', Buffer.from('x'), { filename: 'a.jpg', contentType: 'image/jpeg' }).expect(409);
      // Still readable.
      expect(((await http().get(`/v1/chats/${t.id}/messages`).set(as(client.accessToken)).expect(200)).body as ChatPage).items).toHaveLength(1);
      await http().post(`/v1/chats/${t.id}/block`).set(as(client.accessToken)).expect(409);
    });

    it('a client blocks too, and only an admin opens it again', async () => {
      const t = await conversation();
      await http().post(`/v1/chats/${t.id}/block`).set(as(client.accessToken)).expect(201);
      await http().post(`/v1/admin/chats/${t.id}/unblock`).set(as(omar)).expect(403);
      const back = (await http().post(`/v1/admin/chats/${t.id}/unblock`).set(as(admin)).expect(201)).body as AdminChatDetail;
      expect(back.blocked).toBeNull();
      await send(omar, t.id, 'Welcome back').expect(201);
    });
  });

  describe('admin oversight', () => {
    it('is for admins only', async () => {
      for (const path of ['/v1/admin/chats', '/v1/admin/reports']) {
        await http().get(path).expect(401);
        for (const token of [client.accessToken, omar]) await http().get(path).set(as(token)).expect(403);
      }
    });

    it('lists every conversation with its reports, filters the reported ones, and reads one without marking it read', async () => {
      const quiet = await conversation();
      const loud = await conversation();
      await report(omar, loud.id).expect(201);
      const all = (await http().get('/v1/admin/chats').set(as(admin)).expect(200)).body as AdminChatsPage;
      const row = all.items.find((c) => c.id === loud.id)!;
      expect(row).toMatchObject({ openReports: 1, messages: 1, client: { name: 'Reported Client' }, blocked: null });
      expect(row.last?.body).toMatchObject({ kind: 'text', text: 'Is it still available?' });
      const reported = (await http().get('/v1/admin/chats?reported=true').set(as(admin)).expect(200)).body as AdminChatsPage;
      expect(reported.items.map((c) => c.id)).toContain(loud.id);
      expect(reported.items.map((c) => c.id)).not.toContain(quiet.id);

      const detail = (await http().get(`/v1/admin/chats/${loud.id}`).set(as(admin)).expect(200)).body as AdminChatDetail;
      expect(detail.reports).toHaveLength(1);
      const msgs = (await http().get(`/v1/admin/chats/${loud.id}/messages`).set(as(admin)).expect(200)).body as ChatPage;
      expect(msgs.items.map((m) => m.readAt)).toEqual([null]);
      await http().get('/v1/admin/chats/999999').set(as(admin)).expect(404);
    });

    it('closes reports: dismissed, the conversation blocked, or the client suspended; only once', async () => {
      const [a, b, c] = [await conversation(), await conversation(), await conversation()];
      const [ra, rb, rc] = [
        ((await report(omar, a.id).expect(201)).body as ChatReport).id,
        ((await report(omar, b.id).expect(201)).body as ChatReport).id,
        ((await report(omar, c.id).expect(201)).body as ChatReport).id,
      ];
      const open = (await http().get('/v1/admin/reports?open=true').set(as(admin)).expect(200)).body as AdminReportItem[];
      expect(open.map((r) => r.id)).toEqual(expect.arrayContaining([ra, rb, rc]));
      expect(open.find((r) => r.id === ra)!.chat.id).toBe(a.id);

      const dismissed = (await http().patch(`/v1/admin/reports/${ra}`).set(as(admin)).send({ outcome: 'dismissed' }).expect(200)).body as ChatReport;
      expect(dismissed).toMatchObject({ outcome: 'dismissed', resolvedBy: { name: expect.any(String) } });
      await http().patch(`/v1/admin/reports/${ra}`).set(as(admin)).send({ outcome: 'blocked' }).expect(409);

      await http().patch(`/v1/admin/reports/${rb}`).set(as(admin)).send({ outcome: 'blocked' }).expect(200);
      expect(((await http().get(`/v1/chats/${b.id}`).set(as(omar)).expect(200)).body as ChatThread).blocked).toMatchObject({ by: 'admin' });

      await http().patch(`/v1/admin/reports/${rc}`).set(as(admin)).send({ outcome: 'suspended' }).expect(200);
      await http().get('/v1/me').set(as(client.accessToken)).expect(401);

      const stillOpen = (await http().get('/v1/admin/reports?open=true').set(as(admin)).expect(200)).body as AdminReportItem[];
      expect(stillOpen.map((r) => r.id)).not.toEqual(expect.arrayContaining([ra]));
      await http().patch(`/v1/admin/reports/${ra}`).set(as(admin)).send({ outcome: 'nothing' }).expect(400);
      await http().patch('/v1/admin/reports/999999').set(as(admin)).send({ outcome: 'dismissed' }).expect(404);
    });
  });
});
