import type { INestApplication } from '@nestjs/common';
import type { AuthResponse, NotificationItem, NotificationsResponse } from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { type MemoryPushSender, PushSender } from '../../src/modules/notifications/push.sender.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { notifications as notificationsTable, pushTokens } from '../../src/modules/notifications/notifications.schema.js';
import { eq } from 'drizzle-orm';

// Phase 11: the inbox, phone pushes and the push switch (contract §8.13).
describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let push: MemoryPushSender;
  let notifications: NotificationsService;
  let user: AuthResponse;
  const http = () => request(app.getHttpServer());
  let tokenN = 0;
  const newToken = () => `ExponentPushToken[test-token-${++tokenN}-abcdef]`;

  const inbox = async (token: string, query = '') =>
    (await http().get(`/v1/notifications${query}`).set(bearer(token)).expect(200)).body as NotificationsResponse;
  const addPhone = (token: string, pushToken: string, platform = 'android') =>
    http().post('/v1/me/push-tokens').set(bearer(token)).send({ token: pushToken, platform });
  const priceDrop = (n = 1) => ({
    kind: 'price' as const,
    titleAr: `السعر نزل ${n}`,
    titleEn: `Price dropped ${n}`,
    bodyAr: 'الشقة بقت أرخص',
    bodyEn: 'The flat is cheaper now',
    href: '/property/4',
  });

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    await seedDemoAccounts(app.get<Db>(DB), process.env.SEED_PASSWORD!);
    push = app.get(PushSender) as MemoryPushSender;
    notifications = app.get(NotificationsService);
  });
  beforeEach(async () => {
    user = await signUp(app);
    push.sent.length = 0;
  });
  afterAll(async () => {
    await app.close();
  });

  it('refuses guests', async () => {
    await http().get('/v1/notifications').expect(401);
    await http().post('/v1/notifications/read-all').expect(401);
    await http().post('/v1/notifications/1/read').expect(401);
    await http().post('/v1/notifications/test').expect(401);
    await http().post('/v1/me/push-tokens').send({ token: newToken(), platform: 'ios' }).expect(401);
    await http().delete('/v1/me/push-tokens').send({ token: newToken() }).expect(401);
  });

  it('starts empty', async () => {
    expect(await inbox(user.accessToken)).toEqual({ items: [], unread: 0 });
  });

  it('saves a notification, lists the newest first, and counts the unread ones', async () => {
    const first = (await notifications.notify(user.user.id, priceDrop(1)))!;
    await notifications.notify(user.user.id, { ...priceDrop(2), href: null });
    const { items, unread } = await inbox(user.accessToken);
    expect(unread).toBe(2);
    expect(items.map((n) => n.titleEn)).toEqual(['Price dropped 2', 'Price dropped 1']);
    expect(items[1]).toEqual<NotificationItem>({
      id: first.id,
      kind: 'price',
      titleAr: 'السعر نزل 1',
      titleEn: 'Price dropped 1',
      bodyAr: 'الشقة بقت أرخص',
      bodyEn: 'The flat is cheaper now',
      href: '/property/4',
      read: false,
      createdAt: expect.any(String),
    });
    expect(items[0]!.href).toBeNull();
    // Someone else's inbox stays empty.
    expect((await inbox((await signUp(app)).accessToken)).items).toEqual([]);
  });

  it('keeps to the limit', async () => {
    for (let n = 1; n <= 3; n++) await notifications.notify(user.user.id, priceDrop(n));
    const { items, unread } = await inbox(user.accessToken, '?limit=2');
    expect(items.map((n) => n.titleEn)).toEqual(['Price dropped 3', 'Price dropped 2']);
    expect(unread).toBe(3);
    await http().get('/v1/notifications?limit=0').set(bearer(user.accessToken)).expect(400);
    await http().get('/v1/notifications?limit=51').set(bearer(user.accessToken)).expect(400);
  });

  it('marks one read, then all of them', async () => {
    const a = (await notifications.notify(user.user.id, priceDrop(1)))!;
    await notifications.notify(user.user.id, priceDrop(2));
    await http().post(`/v1/notifications/${a.id}/read`).set(bearer(user.accessToken)).expect(204);
    await http().post(`/v1/notifications/${a.id}/read`).set(bearer(user.accessToken)).expect(204);
    let box = await inbox(user.accessToken);
    expect(box.unread).toBe(1);
    expect(box.items.find((n) => n.id === a.id)!.read).toBe(true);

    await http().post('/v1/notifications/read-all').set(bearer(user.accessToken)).expect(204);
    box = await inbox(user.accessToken);
    expect(box.unread).toBe(0);
    expect(box.items.every((n) => n.read)).toBe(true);
  });

  it('will not read someone else’s notification, or a missing one', async () => {
    const other = await signUp(app);
    const theirs = (await notifications.notify(other.user.id, priceDrop()))!;
    await http().post(`/v1/notifications/${theirs.id}/read`).set(bearer(user.accessToken)).expect(404);
    await http().post('/v1/notifications/999999/read').set(bearer(user.accessToken)).expect(404);
    await http().post('/v1/notifications/abc/read').set(bearer(user.accessToken)).expect(400);
    expect((await inbox(other.accessToken)).unread).toBe(1);
  });

  it('pushes to every phone of the account, in the account’s language, with the screen to open', async () => {
    const [p1, p2] = [newToken(), newToken()];
    await addPhone(user.accessToken, p1, 'android').expect(204);
    await addPhone(user.accessToken, p2, 'ios').expect(204);
    await http().patch('/v1/me').set(bearer(user.accessToken)).send({ lang: 'en' }).expect(200);
    const n = (await notifications.notify(user.user.id, priceDrop()))!;
    const message = { title: 'Price dropped 1', body: 'The flat is cheaper now', data: { id: n.id, href: '/property/4' }, badge: 1 };
    expect(push.sent).toEqual([
      { to: p1, ...message },
      { to: p2, ...message },
    ]);
  });

  it('sends Arabic to an Arabic account, with the unread count as the badge', async () => {
    await addPhone(user.accessToken, newToken()).expect(204);
    await notifications.notify(user.user.id, priceDrop(1));
    await notifications.notify(user.user.id, priceDrop(2));
    expect(push.sent.map((m) => [m.title, m.badge])).toEqual([
      ['السعر نزل 1', 1],
      ['السعر نزل 2', 2],
    ]);
  });

  it('sends no push when phone notifications are off, but still fills the inbox', async () => {
    await addPhone(user.accessToken, newToken()).expect(204);
    await http().patch('/v1/me').set(bearer(user.accessToken)).send({ pushEnabled: false }).expect(200);
    await notifications.notify(user.user.id, priceDrop());
    expect(push.sent).toEqual([]);
    expect((await inbox(user.accessToken)).unread).toBe(1);

    await http().patch('/v1/me').set(bearer(user.accessToken)).send({ pushEnabled: true }).expect(200);
    await notifications.notify(user.user.id, priceDrop(2));
    expect(push.sent).toHaveLength(1);
  });

  it('moves a phone’s token to whoever signs in on it, and forgets it on sign-out', async () => {
    const phone = newToken();
    const other = await signUp(app);
    await addPhone(user.accessToken, phone).expect(204);
    await addPhone(user.accessToken, phone).expect(204);
    await addPhone(other.accessToken, phone, 'ios').expect(204);

    await notifications.notify(user.user.id, priceDrop());
    expect(push.sent).toEqual([]);
    await notifications.notify(other.user.id, priceDrop());
    expect(push.sent.map((m) => m.to)).toEqual([phone]);

    // Only the account that has the token can drop it.
    await http().delete('/v1/me/push-tokens').set(bearer(user.accessToken)).send({ token: phone }).expect(204);
    await notifications.notify(other.user.id, priceDrop());
    expect(push.sent).toHaveLength(2);
    await http().delete('/v1/me/push-tokens').set(bearer(other.accessToken)).send({ token: phone }).expect(204);
    await notifications.notify(other.user.id, priceDrop());
    expect(push.sent).toHaveLength(2);
  });

  it('stops using a token the phone dropped', async () => {
    const [kept, dropped] = [newToken(), newToken()];
    await addPhone(user.accessToken, kept).expect(204);
    await addPhone(user.accessToken, dropped).expect(204);
    push.gone.add(dropped);
    await notifications.notify(user.user.id, priceDrop(1));
    push.gone.delete(dropped);
    await notifications.notify(user.user.id, priceDrop(2));
    expect(push.sent.map((m) => m.to)).toEqual([kept, kept]);
  });

  it('refuses a token that is not an Expo push token, or an unknown platform', async () => {
    await addPhone(user.accessToken, 'not-a-token').expect(400);
    await addPhone(user.accessToken, newToken(), 'windows').expect(400);
    await http().delete('/v1/me/push-tokens').set(bearer(user.accessToken)).send({}).expect(400);
  });

  it('sends a test notification to the inbox and the phone', async () => {
    const phone = newToken();
    await addPhone(user.accessToken, phone).expect(204);
    const res = await http().post('/v1/notifications/test').set(bearer(user.accessToken)).expect(201);
    expect(res.body).toMatchObject({ kind: 'system', titleEn: 'Notifications are on', href: '/notifications', read: false });
    expect((await inbox(user.accessToken)).items).toHaveLength(1);
    expect(push.sent).toEqual([expect.objectContaining({ to: phone, title: 'الإشعارات شغالة' })]);
  });

  it('is the same inbox for staff', async () => {
    // Agents get leads and chats (contract §8.13).
    const agent = await signInSeeded(app, 'omar@maqar.app');
    const me = (await http().get('/v1/me').set(bearer(agent)).expect(200)).body as { id: number };
    await notifications.notify(me.id, { ...priceDrop(), kind: 'lead' });
    expect((await inbox(agent)).items[0]!.kind).toBe('lead');
  });

  it('forgets the notifications and phones of a deleted account', async () => {
    await addPhone(user.accessToken, newToken()).expect(204);
    await notifications.notify(user.user.id, priceDrop());
    await http().delete('/v1/me').set(bearer(user.accessToken)).send({ password: 'Secret123' }).expect(204);
    push.sent.length = 0;
    expect(await notifications.notify(user.user.id, priceDrop())).toBeNull();
    expect(push.sent).toEqual([]);
    const db = app.get<Db>(DB);
    const left = await db.select().from(notificationsTable).where(eq(notificationsTable.userId, user.user.id));
    expect(left).toEqual([]);
    expect(await db.select().from(pushTokens).where(eq(pushTokens.userId, user.user.id))).toEqual([]);
  });
});
