import { mkdir, writeFile } from 'node:fs/promises';
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
}
