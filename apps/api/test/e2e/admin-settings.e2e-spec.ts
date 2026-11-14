import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import {
  type AdminAgentDetail,
  type AdminArea,
  type AgentBody,
  type AgentListingOption,
  type AppSettings,
  type AreaItem,
  DEFAULT_APP_SETTINGS,
  HOME_SECTIONS,
  type Page,
  type PropertyCard,
  type PropertyDetail,
  type UploadResponse,
  type VideoUploadResponse,
} from '@maqar/shared';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { ffTools, run } from '../../src/modules/uploads/video.js';
import { users } from '../../src/modules/users/users.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 29: what the owner asked for in the admin tools. The opening screen, the calculator's
// limits and the Home order are settings; an area needs no picture; an agent's form gives listings.
describe('Admin settings and the owner’s changes (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let admin: string;
  let omar: string;
  let client: string;
  let omarId: number;
  let mariamId: number;
  let mariamHome: PropertyCard;
  let dir: string;
  const http = () => request(app.getHttpServer());
  const as = (token = admin) => bearer(token);
  const settings = async () => (await http().get('/v1/settings').expect(200)).body as AppSettings;
  const put = (body: object, token = admin) => http().put('/v1/admin/settings').set(as(token)).send(body);
  const idOf = async (email: string) => (await db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0]!.id;
  const clip = async (seconds: number) => {
    const file = path.join(dir, `clip-${seconds}.mp4`);
    await run(ffTools().ffmpeg, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `testsrc=size=320x240:rate=10:duration=${seconds}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file], 120_000);
    return readFile(file);
  };
  const uploadVideo = (buf: Buffer, splash: boolean) =>
    http()
      .post(`/v1/uploads/videos${splash ? '?splash=true' : ''}`)
      .set(as())
      .attach('video', buf, { filename: 'clip.mp4', contentType: 'video/mp4' });

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'maqar-settings-'));
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    omar = await signInSeeded(app, 'omar@maqar.app');
    client = (await signUp(app)).accessToken;
    omarId = await idOf('omar@maqar.app');
    mariamId = await idOf('mariam@maqar.app');
    const all = ((await http().get('/v1/properties?limit=50').expect(200)).body as Page<PropertyCard>).items;
    const details = await Promise.all(all.map(async (c) => (await http().get(`/v1/properties/${c.id}`).expect(200)).body as PropertyDetail));
    mariamHome = all.find((_, i) => details[i]!.agent.id === mariamId)!;
  }, 120_000);
  afterAll(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe('settings', () => {
    it('anyone reads them (the defaults at first); only an admin changes them', async () => {
      expect(await settings()).toEqual(DEFAULT_APP_SETTINGS);
      const body = { calculator: { minDownPct: 10, minYears: 2, maxYears: 8 } };
      await http().put('/v1/admin/settings').send(body).expect(401);
      await put(body, client).expect(403);
      await put(body, omar).expect(403);
      expect(await settings()).toEqual(DEFAULT_APP_SETTINGS);
    });

    it('keeps the calculator’s limits and the Home order, and leaves the other parts alone', async () => {
      const saved = (await put({ calculator: { minDownPct: 10, minYears: 2, maxYears: 8 } }).expect(200)).body as AppSettings;
      expect(saved.calculator).toEqual({ minDownPct: 10, minYears: 2, maxYears: 8 });
      expect(saved.home).toEqual(DEFAULT_APP_SETTINGS.home);

      const ordered = (await put({ home: { sections: ['launches', 'areas'] } }).expect(200)).body as AppSettings;
      expect(ordered.home.sections.slice(0, 2)).toEqual(['launches', 'areas']);
      expect([...ordered.home.sections].sort()).toEqual([...HOME_SECTIONS].sort());
      expect((await settings()).calculator.maxYears).toBe(8);

      await put({ calculator: { minDownPct: 51, minYears: 1, maxYears: 10 } }).expect(400);
      await put({ calculator: { minDownPct: 12.5, minYears: 1, maxYears: 10 } }).expect(400);
      await put({ calculator: { minDownPct: 10, minYears: 9, maxYears: 5 } }).expect(400);
      await put({ calculator: { minDownPct: 10, minYears: 1, maxYears: 40 } }).expect(400);
      await put({ home: { sections: ['launches', 'nope'] } }).expect(400);
      await put({ home: { sections: ['launches', 'launches'] } }).expect(400);
      expect((await settings()).calculator).toEqual({ minDownPct: 10, minYears: 2, maxYears: 8 });
      // Any whole percent is fine, not only steps of 5.
      expect(((await put({ calculator: { minDownPct: 11, minYears: 2, maxYears: 8 } }).expect(200)).body as AppSettings).calculator.minDownPct).toBe(11);
    });

    it('takes a picture or a video of at most 3 seconds for the opening screen, with text', async () => {
      const jpeg = await sharp({ create: { width: 800, height: 1200, channels: 3, background: '#234' } }).jpeg().toBuffer();
      const photo = ((await http().post('/v1/uploads').set(as()).attach('photo', jpeg, { filename: 'p.jpg', contentType: 'image/jpeg' }).expect(201)).body as UploadResponse).url;
      const text = { textAr: 'بيتك الجاي هنا', textEn: 'Your next home is here' };

      const image = (await put({ splash: { kind: 'image', media: photo, ...text } }).expect(200)).body as AppSettings;
      expect(image.splash).toEqual({ kind: 'image', media: photo, poster: null, ...text });
      expect((await settings()).splash.media).toBe(photo);

      await put({ splash: { kind: 'image', media: null, ...text } }).expect(400);
      await put({ splash: { kind: 'image', media: 'https://evil.example/x.jpg', ...text } }).expect(400);
      await put({ splash: { kind: 'video', media: photo, ...text } }).expect(400);
      await put({ splash: { kind: 'image', media: photo, textAr: 'x'.repeat(81), textEn: '' } }).expect(400);

      // A 2-second clip is fine; a 5-second one is refused at upload, and as the opening video.
      const short = (await uploadVideo(await clip(2), true).expect(201)).body as VideoUploadResponse;
      const video = (await put({ splash: { kind: 'video', media: short.url, ...text } }).expect(200)).body as AppSettings;
      expect(video.splash).toMatchObject({ kind: 'video', media: short.url, poster: short.poster });
      const tooLong = await uploadVideo(await clip(5), true);
      expect(tooLong.status).toBe(400);
      expect((tooLong.body as { message: string }).message).toMatch(/3 seconds/);
      const listingVideo = (await uploadVideo(await clip(5), false).expect(201)).body as VideoUploadResponse;
      await put({ splash: { kind: 'video', media: listingVideo.url, ...text } }).expect(400);
      expect((await settings()).splash.media).toBe(short.url);

      const none = (await put({ splash: { kind: 'none', media: null, textAr: '', textEn: '' } }).expect(200)).body as AppSettings;
      expect(none.splash).toEqual(DEFAULT_APP_SETTINGS.splash);
      // The video it replaced is deleted from the disk.
      await http().get(short.url).expect(404);
    }, 120_000);

    // Phase 29 review: a short video can be both a listing's and the opening screen's.
    it('keeps a video that a listing still plays when the opening screen drops it, and the other way round', async () => {
      const text = { textAr: '', textEn: '' };
      const setVideos = (videos: string[]) => http().patch(`/v1/admin/listings/${mariamHome.id}`).set(as()).send({ videos }).expect(200);

      const shared = (await uploadVideo(await clip(2), false).expect(201)).body as VideoUploadResponse;
      await setVideos([shared.url]);
      await put({ splash: { kind: 'video', media: shared.url, ...text } }).expect(200);
      await put({ splash: { kind: 'none', media: null, ...text } }).expect(200);
      await http().get(shared.url).expect(200);
      await http().get(shared.poster).expect(200);

      const opening = (await uploadVideo(await clip(2), true).expect(201)).body as VideoUploadResponse;
      await put({ splash: { kind: 'video', media: opening.url, ...text } }).expect(200);
      await setVideos([opening.url]);
      await setVideos([]);
      await http().get(opening.url).expect(200);
      expect((await settings()).splash.media).toBe(opening.url);
      await put({ splash: { kind: 'none', media: null, ...text } }).expect(200);
      await http().get(opening.url).expect(404);
    }, 120_000);

    it('loses neither part when the calculator and the Home order are saved at the same moment', async () => {
      for (let i = 0; i < 8; i++) {
        const maxYears = 10 + i;
        const sections = i % 2 ? ['areas', 'launches'] : ['launches', 'areas'];
        await Promise.all([put({ calculator: { minDownPct: 0, minYears: 1, maxYears } }).expect(200), put({ home: { sections } }).expect(200)]);
        const now = await settings();
        expect(now.calculator.maxYears).toBe(maxYears);
        expect(now.home.sections.slice(0, 2)).toEqual(sections);
      }
    });
  });

  describe('areas', () => {
    it('an area needs no picture, and one can be taken off', async () => {
      const body = { nameAr: 'رأس سدر', nameEn: 'Ras Sedr', cityAr: 'جنوب سيناء', cityEn: 'South Sinai' };
      const area = (await http().post('/v1/admin/areas').set(as()).send(body).expect(201)).body as AdminArea;
      expect(area).toMatchObject({ id: 'ras-sedr', image: null });
      const shown = (await http().get('/v1/areas').expect(200)).body as AreaItem[];
      expect(shown.find((a) => a.id === 'ras-sedr')!.image).toBeNull();

      const withPhoto = (await http().patch('/v1/admin/areas/ras-sedr').set(as()).send({ image: '/uploads/seed/p19.jpg' }).expect(200)).body as AdminArea;
      expect(withPhoto.image).toBe('/uploads/seed/p19.jpg');
      const without = (await http().patch('/v1/admin/areas/ras-sedr').set(as()).send({ image: null }).expect(200)).body as AdminArea;
      expect(without.image).toBeNull();
      await http().patch('/v1/admin/areas/ras-sedr').set(as()).send({ image: 'https://evil.example/x.jpg' }).expect(400);
    });
  });

  describe('an agent’s listings', () => {
    const agentBody = (over: Partial<AgentBody> = {}): AgentBody => ({
      nameAr: 'هنا عادل',
      nameEn: 'Hana Adel',
      email: `hana-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@maqar.app`,
      password: 'Starting123',
      phone: '+201005550199',
      roleTitleAr: 'مستشارة مبيعات',
      roleTitleEn: 'Sales advisor',
      languagesAr: 'العربية',
      languagesEn: 'Arabic',
      colour: '#61766d',
      monthlyTarget: 6,
      ...over,
    });
    const advisorOf = async (id: number) => ((await http().get(`/v1/properties/${id}`).expect(200)).body as PropertyDetail).agent.id;
    const options = async () => (await http().get('/v1/admin/agents/listing-options').set(as()).expect(200)).body as AgentListingOption[];

    it('are picked in the agent’s form: a new agent gets them, and an edit gives more', async () => {
      const before = await options();
      expect(before.find((o) => o.id === mariamHome.id)).toMatchObject({ agentId: mariamId, titleEn: expect.any(String), status: 'approved' });

      const hana = (await http().post('/v1/admin/agents').set(as()).send(agentBody({ listingIds: [mariamHome.id] })).expect(201)).body as AdminAgentDetail;
      expect(hana.listingIds).toEqual([mariamHome.id]);
      expect(hana.live).toBe(1);
      expect(await advisorOf(mariamHome.id)).toBe(hana.id);

      // Giving it to Omar from his form takes it from Hana; what he already had stays his.
      const omarBefore = ((await http().get(`/v1/admin/agents/${omarId}`).set(as()).expect(200)).body as AdminAgentDetail).listingIds;
      const omarAfter = (await http().patch(`/v1/admin/agents/${omarId}`).set(as()).send({ listingIds: [mariamHome.id] }).expect(200)).body as AdminAgentDetail;
      expect([...omarAfter.listingIds].sort()).toEqual([...omarBefore, mariamHome.id].sort());
      expect(await advisorOf(mariamHome.id)).toBe(omarId);
      expect(((await http().get(`/v1/admin/agents/${hana.id}`).set(as()).expect(200)).body as AdminAgentDetail).listingIds).toEqual([]);
    });

    it('refuses a listing that does not exist, and listings for an agent who is turned off', async () => {
      await http().patch(`/v1/admin/agents/${omarId}`).set(as()).send({ listingIds: [999_999] }).expect(400);
      const off = (await http().post('/v1/admin/agents').set(as()).send(agentBody()).expect(201)).body as AdminAgentDetail;
      await http().patch(`/v1/admin/agents/${off.id}`).set(as()).send({ active: false }).expect(200);
      await http().patch(`/v1/admin/agents/${off.id}`).set(as()).send({ listingIds: [mariamHome.id] }).expect(400);
      expect(await advisorOf(mariamHome.id)).toBe(omarId);
      await http().get('/v1/admin/agents/listing-options').set(as(omar)).expect(403);
    });
  });
});
