import type { INestApplication } from '@nestjs/common';
import type { AuthResponse, NotificationsResponse, Page, PropertyCard, SlotsResponse, ViewingItem } from '@maqar/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { type MemoryPushSender, PushSender } from '../../src/modules/notifications/push.sender.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { viewingReminders } from '../../src/modules/viewings/viewings.schema.js';
import { ViewingsRepository } from '../../src/modules/viewings/viewings.repository.js';
import { ViewingsService } from '../../src/modules/viewings/viewings.service.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

const MIN = 60_000;
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

// Phase 14: viewing reminders (contract §8.7). The job is not loaded in tests: they run it with their own clock.
describe('Viewing reminders (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let push: MemoryPushSender;
  let service: ViewingsService;
  let homes: PropertyCard[];
  let client: AuthResponse;
  const http = () => request(app.getHttpServer());

  const book = (token: string, body: Record<string, unknown>) => http().post('/v1/viewings').set(bearer(token)).send(body);
  const patch = (token: string, id: number, body: Record<string, unknown>) => http().patch(`/v1/viewings/${id}`).set(bearer(token)).send(body);
  const reminders = async (token: string) =>
    ((await http().get('/v1/notifications').set(bearer(token)).expect(200)).body as NotificationsResponse).items.filter((n) => n.kind === 'reminder');
  /** Free hours of a home a few days ahead, never on Friday, so every reminder is still to come. */
  const freeHours = async (id: number, n = 2) => {
    const { days } = (await http().get(`/v1/properties/${id}/slots`).expect(200)).body as SlotsResponse;
    const day = days.slice(2).find((d) => weekdayOf(d.date) !== 5 && d.slots.filter((s) => s.state === 'free').length >= n)!;
    return day.slots.filter((s) => s.state === 'free').slice(0, n).map((s) => ({ date: day.date, time: s.time }));
  };
  let next = 0;
  const aHome = () => homes[next++ % homes.length]!;
  /** Books a viewing with these reminders; returns it and its start. */
  const booked = async (offsets: string[] = ['1d', '2h', '30m']) => {
    const home = aHome();
    const [at] = await freeHours(home.id);
    const v = (await book(client.accessToken, { propertyId: home.id, ...at, reminders: offsets }).expect(201)).body as ViewingItem;
    return { v, starts: new Date(v.startsAt).getTime(), home };
  };
  const runAt = (ms: number) => service.sendDueReminders(new Date(ms));

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    push = app.get(PushSender) as MemoryPushSender;
    service = app.get(ViewingsService);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items;
    homes = all.filter((c) => c.category !== 'stay');
  });
  beforeEach(async () => {
    client = await signUp(app);
    push.sent.length = 0;
  });
  afterAll(async () => {
    await app.close();
  });

  it('sends each reminder once, at its time, in the inbox and on the phone, opening My viewings', async () => {
    const { v, starts } = await booked();
    await http().post('/v1/me/push-tokens').set(bearer(client.accessToken)).send({ token: 'ExponentPushToken[reminder-test]', platform: 'android' }).expect(204);

    await runAt(starts - 24 * 60 * MIN - MIN);
    expect(await reminders(client.accessToken)).toEqual([]);

    await runAt(starts - 24 * 60 * MIN);
    await runAt(starts - 24 * 60 * MIN + MIN);
    const [first, ...more] = await reminders(client.accessToken);
    expect(more).toEqual([]);
    expect(first).toMatchObject({ titleAr: 'تذكير بمعاينتك', titleEn: 'Viewing reminder', href: '/viewings', read: false });
    expect(first!.bodyEn).toContain(v.property.titleEn);
    expect(first!.bodyEn).toContain(v.agent.nameEn);
    expect(push.sent.map((m) => m.to)).toEqual(['ExponentPushToken[reminder-test]']);

    await runAt(starts - 2 * 60 * MIN);
    await runAt(starts - 30 * MIN);
    await runAt(starts - 10 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(3);
  });

  it('only sends the choices the client made', async () => {
    const { starts } = await booked(['30m']);
    await runAt(starts - 24 * 60 * MIN);
    await runAt(starts - 2 * 60 * MIN);
    expect(await reminders(client.accessToken)).toEqual([]);
    await runAt(starts - 30 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(1);
  });

  it('after the server was down, sends the missed ones as one message, and nothing once the viewing has started', async () => {
    const { starts } = await booked();
    await runAt(starts - 20 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(1);
    await runAt(starts - 10 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(1);

    const late = await booked(['30m']);
    await runAt(late.starts);
    await runAt(late.starts + 5 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(1);
  });

  it('moves with a reschedule: the old time sends nothing, the new time does', async () => {
    const home = aHome();
    const [a, b] = await freeHours(home.id);
    const v = (await book(client.accessToken, { propertyId: home.id, ...a, reminders: ['30m'] }).expect(201)).body as ViewingItem;
    const oldStart = new Date(v.startsAt).getTime();
    const moved = (await patch(client.accessToken, v.id, { action: 'reschedule', ...b }).expect(200)).body as ViewingItem;
    const newStart = new Date(moved.startsAt).getTime();
    expect(moved.reminders).toEqual(['30m']);

    await runAt(oldStart - 30 * MIN);
    expect(await reminders(client.accessToken)).toEqual([]);
    await runAt(newStart - 30 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(1);
  });

  it('a reminder already sent is sent again for the new time after a reschedule', async () => {
    const home = aHome();
    const [a, b] = await freeHours(home.id);
    const v = (await book(client.accessToken, { propertyId: home.id, ...a, reminders: ['1d'] }).expect(201)).body as ViewingItem;
    await runAt(new Date(v.startsAt).getTime() - 24 * 60 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(1);
    const moved = (await patch(client.accessToken, v.id, { action: 'reschedule', ...b }).expect(200)).body as ViewingItem;
    await runAt(new Date(moved.startsAt).getTime() - 24 * 60 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(2);
  });

  it('sends nothing after a cancel', async () => {
    const { v, starts } = await booked();
    await patch(client.accessToken, v.id, { action: 'cancel' }).expect(200);
    await runAt(starts - 24 * 60 * MIN);
    await runAt(starts - 30 * MIN);
    expect(await reminders(client.accessToken)).toEqual([]);
  });

  it('two servers running at the same moment send it once', async () => {
    const { starts } = await booked(['2h']);
    const at = starts - 2 * 60 * MIN;
    await Promise.all([runAt(at), runAt(at), runAt(at)]);
    expect(await reminders(client.accessToken)).toHaveLength(1);
  });

  it('never sends a choice that was already due when booked: booked 35 minutes ahead, only "30 minutes before" comes', async () => {
    // The booking screen only offers whole hours, so the repository books the odd time directly.
    const home = aHome();
    const agentId = (await http().get(`/v1/properties/${home.id}`).expect(200)).body.agent.id as number;
    // A whole second: `starts_at` keeps seconds, and MySQL rounds the rest (up from .500).
    const starts = Math.floor((Date.now() + 35 * MIN) / 1000) * 1000;
    const id = await app.get(ViewingsRepository).book({ propertyId: home.id, clientId: client.user.id, agentId, startsAt: new Date(starts), reminders: ['1d', '2h', '30m'] });
    const rows = await db.select().from(viewingReminders).where(eq(viewingReminders.viewingId, id));
    expect(Object.fromEntries(rows.map((r) => [r.offset, r.sentAt !== null]))).toEqual({ '1d': true, '2h': true, '30m': false });

    await runAt(Date.now());
    expect(await reminders(client.accessToken)).toEqual([]);
    await runAt(starts - 30 * MIN);
    expect(await reminders(client.accessToken)).toHaveLength(1);
  });
});
