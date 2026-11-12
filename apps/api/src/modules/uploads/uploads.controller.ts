import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiPayloadTooLargeResponse, ApiTags } from '@nestjs/swagger';
import { tmpdir } from 'node:os';
import { type UploadResponse, VIDEO_MAX_BYTES, type VideoUploadResponse } from '@maqar/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RateLimited } from '../../common/rate-limit.js';
import { UploadsService } from './uploads.service.js';

/** Photos up to 10 MB before resizing (nginx takes 12 MB). */
export const UPLOAD_BYTES = 10 * 1024 * 1024;

/** 360° panoramas up to 30 MB before scaling (nginx takes 32 MB on that route). */
export const PANO_BYTES = 30 * 1024 * 1024;

/** Router for `/v1/uploads` (contract §14): listing photos, 360° panoramas and videos, for the admin listing form. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@RateLimited()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** One photo in the `photo` field (JPEG, PNG, WebP or HEIC). Returns its path, for the listing's `images`. */
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } } })
  @ApiPayloadTooLargeResponse({ description: 'Over 10 MB' })
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, done) => done(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
    }),
  )
  upload(@UploadedFile() file?: { buffer: Buffer }): Promise<UploadResponse> {
    if (!file) throw new BadRequestException('Add a photo (JPEG, PNG, WebP or HEIC) in the photo field');
    return this.uploads.savePhoto(file.buffer);
  }

  /** One 360° panorama in the `pano` field: a 2:1 JPEG of at least 4096×2048 (phase 21). Returns its path, for the listing's `tour`. */
  @Post('panoramas')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { pano: { type: 'string', format: 'binary' } } } })
  @ApiPayloadTooLargeResponse({ description: 'Over 30 MB' })
  @UseInterceptors(
    FileInterceptor('pano', {
      limits: { fileSize: PANO_BYTES, files: 1 },
      fileFilter: (_req, file, done) => done(null, file.mimetype === 'image/jpeg'),
    }),
  )
  uploadPanorama(@UploadedFile() file?: { buffer: Buffer }): Promise<UploadResponse> {
    if (!file) throw new BadRequestException('Add a panorama (a JPEG) in the pano field');
    return this.uploads.savePanorama(file.buffer);
  }

  /**
   * One listing video in the `video` field (phase 26): an MP4 or MOV of at most 150 MB and 3 minutes.
   * It is stored as an H.264 MP4 with a poster frame; converting one can take a few minutes.
   * The file goes to a temp folder, never into memory.
   */
  @Post('videos')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { video: { type: 'string', format: 'binary' } } } })
  @ApiPayloadTooLargeResponse({ description: 'Over 150 MB' })
  @UseInterceptors(
    FileInterceptor('video', {
      dest: tmpdir(),
      limits: { fileSize: VIDEO_MAX_BYTES, files: 1 },
      fileFilter: (_req, file, done) => done(null, /^video\//.test(file.mimetype)),
    }),
  )
  uploadVideo(@UploadedFile() file?: { path: string }): Promise<VideoUploadResponse> {
    if (!file) throw new BadRequestException('Add a video (MP4 or MOV) in the video field');
    return this.uploads.saveVideo(file.path);
  }
}
