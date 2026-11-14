import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ListingVideo, PANO_SIZE, panoramaProblem, type UploadResponse, VIDEO_MAX_SECONDS, type VideoUploadResponse } from '@maqar/shared';
import sharp from 'sharp';
import type { Env } from '../../core/config/env.js';
import { convertArgs, ffTools, posterArgs, probe, run } from './video.js';

/** Listing photos keep at most this many pixels on the longest side. */
export const LISTING_PHOTO_PX = 2000;

// 360° panoramas are stored at exactly PANO_SIZE (contract §8.6): the seed tours prove it on
// phones, and a sharper texture could be more than an older phone's GPU can load.

/** Panorama files: a bare uuid-style name, so a path can never climb out of the folder. */
const PANO_NAME = /^[A-Za-z0-9_-]+\.jpe?g$/;

/** Video files, the same way: the MP4 and its poster share the bare name. */
const VIDEO_NAME = /^[A-Za-z0-9_-]+\.mp4$/;

/** Posters keep at most this many pixels on the longest side. */
export const VIDEO_POSTER_PX = 1280;

/** A conversion that takes longer than this is stopped (a 3-minute 4K video takes a few minutes on one core). */
const CONVERT_TIMEOUT_MS = 10 * 60_000;

/** Listing photos on the server's disk (contract §16.1 #2), served by nginx under `/uploads/listings/`. */
@Injectable()
export class UploadsService {
  private readonly ff: { ffmpeg: string; ffprobe: string };
  /** Videos are converted one at a time: the server has one core and a neighbour. */
  private videoQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService<Env, true>) {
    this.ff = ffTools({
      NODE_ENV: config.get('NODE_ENV', { infer: true }),
      FFMPEG_PATH: config.get('FFMPEG_PATH', { infer: true }),
      FFPROBE_PATH: config.get('FFPROBE_PATH', { infer: true }),
    });
  }

  /** Turned upright, made at most 2000 px on the longest side and stored as JPEG. */
  async savePhoto(buffer: Buffer): Promise<UploadResponse> {
    const jpeg = await sharp(buffer)
      .rotate()
      .resize(LISTING_PHOTO_PX, LISTING_PHOTO_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
      .catch(() => {
        throw new BadRequestException('That file is not a photo we can read');
      });
    const dir = path.resolve(this.config.get('UPLOADS_DIR', { infer: true }), 'listings');
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.jpg`;
    await writeFile(path.join(dir, name), jpeg);
    return { url: `/uploads/listings/${name}` };
  }

  /**
   * A 360° panorama (phase 21): a JPEG, 2:1 within 1%, at least 4096×2048. It is re-encoded (which
   * drops the camera's metadata, such as where it was taken) at exactly 4096×2048.
   */
  async savePanorama(buffer: Buffer): Promise<UploadResponse> {
    const meta = await sharp(buffer)
      .metadata()
      .catch(() => {
        throw new BadRequestException('That file is not a photo we can read');
      });
    const { format, width = 0, height = 0 } = meta;
    if (format !== 'jpeg') throw new BadRequestException('A panorama must be a JPEG');
    const problem = panoramaProblem(width, height);
    if (problem === 'ratio') throw new BadRequestException('A panorama must be twice as wide as it is high (2:1)');
    if (problem === 'small') throw new BadRequestException('A panorama must be at least 4096×2048');
    const jpeg = await sharp(buffer)
      .resize(PANO_SIZE.width, PANO_SIZE.height, { fit: 'fill' })
      .jpeg({ quality: 85 })
      .toBuffer()
      .catch(() => {
        throw new BadRequestException('That file is not a photo we can read');
      });
    const dir = this.toursDir();
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.jpg`;
    await writeFile(path.join(dir, name), jpeg);
    return { url: `/uploads/tours/${name}` };
  }

  private toursDir(): string {
    return path.resolve(this.config.get('UPLOADS_DIR', { infer: true }), 'tours');
  }

  /** Every tour panorama must be a file this server has (seed panoramas excepted). */
  async assertTourFiles(urls: string[]): Promise<void> {
    for (const url of urls) {
      if (!url.startsWith('/uploads/tours/')) continue;
      const name = url.slice('/uploads/tours/'.length);
      if (!PANO_NAME.test(name)) throw new BadRequestException('A panorama path is not one of ours');
      try {
        await access(path.join(this.toursDir(), name));
      } catch {
        throw new BadRequestException(`A panorama is missing from the server's disk: ${name}`);
      }
    }
  }

  /** Deletes panorama files no tour uses any more; never anything outside the folder. */
  async removeTourFiles(urls: string[]): Promise<void> {
    const dir = this.toursDir();
    await Promise.all(
      urls
        .filter((url) => url.startsWith('/uploads/tours/'))
        .map((url) => {
          const name = url.slice('/uploads/tours/'.length);
          if (!PANO_NAME.test(name)) return Promise.resolve();
          return unlink(path.join(dir, name)).catch(() => undefined);
        }),
    );
  }

  private listingsDir(): string {
    return path.resolve(this.config.get('UPLOADS_DIR', { infer: true }), 'listings');
  }

  /**
   * Every submitted listing photo must be a file this server actually has (seed photos excepted):
   * a correct-looking path that was never uploaded would publish a broken image.
   */
  async assertListingFiles(urls: string[]): Promise<void> {
    for (const url of urls) {
      if (!url.startsWith('/uploads/listings/')) continue;
      const name = url.slice('/uploads/listings/'.length);
      // A bare file name only: anything with a separator could climb out of the folder.
      if (!/^[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/.test(name)) throw new BadRequestException('A photo path is not one of ours');
      try {
        await access(path.join(this.listingsDir(), name));
      } catch {
        throw new BadRequestException(`A photo is missing from the server's disk: ${name}`);
      }
    }
  }

  /** Deletes listing photo files nothing references any more; never anything outside the folder. */
  async removeListingFiles(urls: string[]): Promise<void> {
    const dir = this.listingsDir();
    await Promise.all(
      urls
        .filter((url) => url.startsWith('/uploads/listings/'))
        .map((url) => {
          const name = url.slice('/uploads/listings/'.length);
          if (!/^[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/.test(name)) return Promise.resolve();
          return unlink(path.join(dir, name)).catch(() => undefined);
        }),
    );
  }

  private videosDir(): string {
    return path.resolve(this.config.get('UPLOADS_DIR', { infer: true }), 'videos');
  }

  /**
   * A listing video (phase 26), from the temp file the upload went to (deleted afterwards). At most
   * 3 minutes. Stored as an H.264 MP4 without metadata, with a JPEG poster of the same name.
   */
  async saveVideo(input: string, maxSeconds: number = VIDEO_MAX_SECONDS): Promise<VideoUploadResponse> {
    const job = this.videoQueue.then(() => this.convertVideo(input, maxSeconds));
    this.videoQueue = job.catch(() => undefined);
    try {
      return await job;
    } finally {
      await unlink(input).catch(() => undefined);
    }
  }

  private async convertVideo(input: string, maxSeconds: number): Promise<VideoUploadResponse> {
    const p = await probe(this.ff.ffprobe, input);
    if (!p) throw new BadRequestException('That file is not a video we can read');
    if (Math.round(p.durationS) > maxSeconds) {
      throw new BadRequestException(maxSeconds < 60 ? `This video can be at most ${maxSeconds} seconds long` : `A video can be at most ${maxSeconds / 60} minutes long`);
    }
    const dir = this.videosDir();
    await mkdir(dir, { recursive: true });
    const name = randomUUID();
    const [video, poster, frame] = [path.join(dir, `${name}.mp4`), path.join(dir, `${name}.jpg`), path.join(tmpdir(), `${name}-frame.jpg`)];
    try {
      await run(this.ff.ffmpeg, convertArgs(p, input, video), CONVERT_TIMEOUT_MS);
      const out = await probe(this.ff.ffprobe, video);
      if (!out) throw new BadRequestException('We could not convert that video');
      // The frame is decoded the way players show it, so an upright phone video gets an upright poster.
      await run(this.ff.ffmpeg, posterArgs(out.durationS, video, frame), 60_000);
      await sharp(frame).resize(VIDEO_POSTER_PX, VIDEO_POSTER_PX, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toFile(poster);
      return {
        url: `/uploads/videos/${name}.mp4`,
        poster: `/uploads/videos/${name}.jpg`,
        durationS: Math.max(1, Math.round(out.durationS)),
        width: out.shown.width,
        height: out.shown.height,
      };
    } catch (e) {
      await Promise.all([unlink(video), unlink(poster)].map((x) => x.catch(() => undefined)));
      if (e instanceof HttpException) throw e;
      throw new BadRequestException('We could not convert that video');
    } finally {
      await unlink(frame).catch(() => undefined);
    }
  }

  /**
   * The saved form of each listing video, in order: every path must be a video this server
   * converted, with its poster. Its length and size are read from the file itself. `maxSeconds`
   * refuses a longer one (the opening screen's video).
   */
  async videoDetails(urls: string[], maxSeconds?: number): Promise<ListingVideo[]> {
    const dir = this.videosDir();
    const out: ListingVideo[] = [];
    for (const url of urls) {
      const name = url.startsWith('/uploads/videos/') ? url.slice('/uploads/videos/'.length) : '';
      if (!VIDEO_NAME.test(name)) throw new BadRequestException('Videos must be uploaded with POST /uploads/videos');
      const posterName = name.replace(/\.mp4$/, '.jpg');
      try {
        await access(path.join(dir, posterName));
      } catch {
        throw new BadRequestException(`A video is missing from the server's disk: ${name}`);
      }
      const p = await probe(this.ff.ffprobe, path.join(dir, name));
      if (!p) throw new BadRequestException(`A video is missing from the server's disk: ${name}`);
      if (maxSeconds !== undefined && p.durationS > maxSeconds) throw new BadRequestException(`This video can be at most ${Math.floor(maxSeconds)} seconds long`);
      out.push({ url, poster: `/uploads/videos/${posterName}`, durationS: Math.max(1, Math.round(p.durationS)), width: p.shown.width, height: p.shown.height });
    }
    return out;
  }

  /** Deletes videos (and their posters) no listing uses any more; never anything outside the folder. */
  async removeVideoFiles(urls: string[]): Promise<void> {
    const dir = this.videosDir();
    await Promise.all(
      urls.flatMap((url) => {
        const name = url.startsWith('/uploads/videos/') ? url.slice('/uploads/videos/'.length) : '';
        if (!VIDEO_NAME.test(name)) return [];
        return [name, name.replace(/\.mp4$/, '.jpg')].map((f) => unlink(path.join(dir, f)).catch(() => undefined));
      }),
    );
  }
}
