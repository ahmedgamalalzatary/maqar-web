import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiPayloadTooLargeResponse, ApiTags } from '@nestjs/swagger';
import type { UploadResponse } from '@maqar/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RateLimited } from '../../common/rate-limit.js';
import { UploadsService } from './uploads.service.js';

/** Photos up to 10 MB before resizing (nginx takes 12 MB). */
export const UPLOAD_BYTES = 10 * 1024 * 1024;

/** Router for `/v1/uploads` (contract §14): listing photos, for the admin listing form. */
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
}
