import { access, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PANO_SIZE, panoramaProblem, type UploadResponse } from '@maqar/shared';
import sharp from 'sharp';
import type { Env } from '../../core/config/env.js';

/** Listing photos keep at most this many pixels on the longest side. */
export const LISTING_PHOTO_PX = 2000;

// 360° panoramas are stored at exactly PANO_SIZE (contract §8.6): the seed tours prove it on
// phones, and a sharper texture could be more than an older phone's GPU can load.

/** Panorama files: a bare uuid-style name, so a path can never climb out of the folder. */
const PANO_NAME = /^[A-Za-z0-9_-]+\.jpe?g$/;

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
}
