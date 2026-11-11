import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadResponse } from '@maqar/shared';
import sharp from 'sharp';
import type { Env } from '../../core/config/env.js';

/** Listing photos keep at most this many pixels on the longest side. */
export const LISTING_PHOTO_PX = 2000;

/** Listing photos on the server's disk (contract §16.1 #2), served by nginx under `/uploads/listings/`. */
@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService<Env, true>) {}

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
}
