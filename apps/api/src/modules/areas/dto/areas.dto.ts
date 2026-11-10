import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import type { AreaBody } from '@maqar/shared';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Only photos uploaded to this server (or the seed's). */
const UPLOADED = /^\/uploads\/(listings|seed)\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/;

/** `POST /admin/areas`. Without an id, it is made from the English name. */
export class AreaDto implements AreaBody {
  @ApiPropertyOptional({ example: 'new-alamein' }) @IsOptional() @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'id is lowercase words joined by dashes' }) @Length(2, 40)
  id?: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  nameAr: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  nameEn: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  cityAr: string;

  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100)
  cityEn: string;

  @ApiProperty({ description: 'A path from POST /uploads' }) @Matches(UPLOADED, { message: 'image must be uploaded with POST /uploads' })
  image: string;
}

/** `PATCH /admin/areas/:id`: names, city or image. The id stays, as listings and links use it. */
export class UpdateAreaDto extends PartialType(OmitType(AreaDto, ['id'] as const)) {}
