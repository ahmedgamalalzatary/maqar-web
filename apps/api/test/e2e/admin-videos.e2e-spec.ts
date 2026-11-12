import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { AdminListing, ListingBody, PropertyDetail, UploadResponse, VideoUploadResponse } from '@maqar/shared';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { ffTools, probe, run } from '../../src/modules/uploads/video.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 26: admins upload listing videos; the server stores each as an H.264 MP4 with a poster.
describe('Admin listing videos (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let agent: string;
  let client: string;
  let photo: string;
  let dir: string;
  const files: Record<'h264' | 'portrait' | 'big' | 'long' | 'silent', Buffer> = {} as never;
  const { ffmpeg, ffprobe } = ffTools();
  const http = () => request(app.getHttpServer());

  /** A test-pattern clip made with ffmpeg; `out` is a file name in the temp folder. */
  const make = async (out: string, args: string[]) => {
    const file = path.join(dir, out);
    await run(ffmpeg, ['-v', 'error', '-y', ...args, file], 120_000);
    return readFile(file);
  };
  const upload = (buf: Buffer, token = admin, type = 'video/mp4', filename = 'clip.mp4') =>
    http().post('/v1/uploads/videos').set(bearer(token)).attach('video', buf, { filename, contentType: type });
  const video = async (buf = files.h264) => (await upload(buf).expect(201)).body as VideoUploadResponse;

  const body = (over: Partial<ListingBody> = {}): ListingBody => ({
    category: 'sale',
    type: 'apartment',
    areaId: 'new-cairo',
    price: 5_000_000,
    beds: 2,
    baths: 1,
    sizeM2: 120,
    finishing: 'full',
    delivery: 'ready',
    features: [],
    images: [photo],
    ...over,
  });
  const created = async (over: Partial<ListingBody> = {}) =>
    (await http().post('/v1/admin/listings').set(bearer(admin)).send(body(over)).expect(201)).body as AdminListing;
  const setVideos = (id: number, videos: unknown) => http().patch(`/v1/admin/listings/${id}`).set(bearer(admin)).send({ videos });
  /** What ffprobe says about a stored file. */
  const stored = async (url: string) => {
    const file = path.join(dir, `stored-${path.basename(url)}`);
    await writeFile(file, (await http().get(url).buffer(true).expect(200)).body as Buffer);
    return probe(ffprobe, file);
  };

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'maqar-videos-'));
    const tone = (s: number) => ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${s}`];
    // What an Android phone records: H.264 with AAC sound, and where it was filmed.
    files.h264 = await make('h264.mp4', [
      ...['-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=2'],
      ...tone(2),
      ...['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-metadata', 'location=+30.0444+031.2357/'],
    ]);
    // Filmed upright: stored sideways with a quarter-turn rotation (ffmpeg writes one only on a copy).
    await make('sideways.mp4', [...['-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=1'], '-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
    files.portrait = await make('portrait.mp4', ['-i', path.join(dir, 'sideways.mp4'), '-c', 'copy', '-metadata:s:v', 'rotate=90']);
    // Not H.264 and bigger than 1920 px: converted. MPEG-4 part 2 stands in for HEVC here.
    files.big = await make('big.mov', [...['-f', 'lavfi', '-i', 'testsrc=size=2560x1440:rate=10:duration=1'], ...tone(1), '-c:v', 'mpeg4', '-c:a', 'pcm_s16le', '-shortest']);
    files.long = await make('long.mp4', [...['-f', 'lavfi', '-i', 'color=c=gray:size=64x64:rate=1:duration=181'], '-c:v', 'libx264', '-pix_fmt', 'yuv420p']);
    files.silent = await make('silent.mp4', [...['-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10:duration=1'], '-c:v', 'libx264', '-pix_fmt', 'yuv420p']);

    await resetDb();
    app = await createTestApp();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    admin = await signInSeeded(app, 'admin@maqar.app');
    agent = await signInSeeded(app, 'omar@maqar.app');
    client = (await signUp(app)).accessToken;
    const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#789' } }).jpeg().toBuffer();
    photo = ((await http().post('/v1/uploads').set(bearer(admin)).attach('photo', jpeg, { filename: 'p.jpg', contentType: 'image/jpeg' })).body as UploadResponse).url;
  }, 180_000);
  afterAll(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe('POST /uploads/videos', () => {
    it('is for admins only', async () => {
      await http().post('/v1/uploads/videos').attach('video', files.h264, { filename: 'clip.mp4', contentType: 'video/mp4' }).expect(401);
      for (const token of [client, agent]) expect((await upload(files.h264, token)).status).toBe(403);
    });

    it('keeps an H.264 video as it is, drops where it was filmed, and makes a poster', async () => {
      const v = await video();
      expect(v.url).toMatch(/^\/uploads\/videos\/[0-9a-f-]+\.mp4$/);
      expect(v.poster).toBe(v.url.replace(/\.mp4$/, '.jpg'));
      expect([v.width, v.height, v.durationS]).toEqual([640, 360, 2]);
      const p = (await stored(v.url))!;
      expect([p.codec, p.audio, p.width, p.height]).toEqual(['h264', 'aac', 640, 360]);
      const served = await http().get(v.url).buffer(true).expect(200);
      expect((served.body as Buffer).includes(Buffer.from('+30.0444'))).toBe(false);
      const poster = await sharp((await http().get(v.poster).buffer(true).expect(200)).body as Buffer).metadata();
      expect([poster.format, poster.width, poster.height]).toEqual(['jpeg', 640, 360]);
    });

    it('serves part of a video on request, so playback can start and seek', async () => {
      const v = await video(files.silent);
      const res = await http().get(v.url).set('Range', 'bytes=0-99').buffer(true).expect(206);
      expect((res.body as Buffer).length).toBe(100);
    });

    it('reports an upright phone video as upright, with an upright poster', async () => {
      const v = await video(files.portrait);
      expect([v.width, v.height]).toEqual([360, 640]);
      const poster = await sharp((await http().get(v.poster).buffer(true).expect(200)).body as Buffer).metadata();
      expect([poster.width, poster.height]).toEqual([360, 640]);
    });

    it('converts any other video to H.264 at most 1280 px, with AAC sound', async () => {
      const v = await video(files.big);
      expect([v.width, v.height, v.durationS]).toEqual([1280, 720, 1]);
      const p = (await stored(v.url))!;
      expect([p.codec, p.pixFmt, p.audio]).toEqual(['h264', 'yuv420p', 'aac']);
    });

    it('refuses no file, a photo, something that is not a video, one over 3 minutes, and one over 150 MB', async () => {
      await http().post('/v1/uploads/videos').set(bearer(admin)).expect(400);
      expect((await upload(Buffer.from('jpeg?'), admin, 'image/jpeg', 'p.jpg')).status).toBe(400);
      expect((await upload(Buffer.from('not really a video'))).status).toBe(400);
      const long = await upload(files.long);
      expect(long.status).toBe(400);
      expect((long.body as { message: string }).message).toMatch(/3 minutes/);
      expect((await upload(Buffer.alloc(150 * 1024 * 1024 + 1, 1))).status).toBe(413);
    }, 60_000);
  });

  describe('the listing videos', () => {
    it('are saved in order, and clients see them after the photos', async () => {
      const [a, b] = [await video(), await video(files.portrait)];
      const l = await created({ videos: [b.url, a.url] });
      expect(l.videos).toEqual([b, a]);
      await http().post(`/v1/admin/listings/${l.id}/publish`).set(bearer(admin)).expect(200);
      const pub = (await http().get(`/v1/properties/${l.id}`).expect(200)).body as PropertyDetail;
      expect(pub.videos.map((v) => [v.url, v.poster, v.durationS])).toEqual([
        [b.url, b.poster, 1],
        [a.url, a.poster, 2],
      ]);
      // A listing without videos has an empty list.
      expect(((await http().get(`/v1/admin/listings/${(await created()).id}`).set(bearer(admin)).expect(200)).body as AdminListing).videos).toEqual([]);
    });

    it('are replaced as sent, deleting the files of a video no listing uses any more', async () => {
      const [a, b, c] = [await video(), await video(), await video(files.silent)];
      const l = await created({ videos: [a.url, b.url] });
      const res = await setVideos(l.id, [c.url, a.url]).expect(200);
      expect((res.body as AdminListing).videos.map((v) => v.url)).toEqual([c.url, a.url]);
      await http().get(b.url).expect(404);
      await http().get(b.poster).expect(404);
      await http().get(a.url).expect(200);
      // Left out keeps them; an empty list removes them all.
      await http().patch(`/v1/admin/listings/${l.id}`).set(bearer(admin)).send({ price: 5_100_000 }).expect(200);
      expect(((await setVideos(l.id, []).expect(200)).body as AdminListing).videos).toEqual([]);
      await http().get(c.url).expect(404);
    });

    it('refuses a path that is not an uploaded video, a missing file, a repeat, and more than 5', async () => {
      const l = await created();
      for (const bad of [['/uploads/listings/x.jpg'], ['/uploads/videos/../x.mp4'], ['https://example.com/v.mp4'], ['/uploads/videos/00000000-0000-0000-0000-000000000000.mp4']]) {
        expect((await setVideos(l.id, bad)).status).toBe(400);
      }
      const v = await video(files.silent);
      expect((await setVideos(l.id, [v.url, v.url])).status).toBe(400);
      expect((await setVideos(l.id, Array.from({ length: 6 }, () => v.url))).status).toBe(400);
    });
  });
});
