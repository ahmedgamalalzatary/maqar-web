import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type AppSettingsBody,
  CALCULATOR_BOUNDS,
  type CalculatorSettings,
  HOME_SECTIONS,
  type HomeSection,
  SPLASH_KINDS,
  SPLASH_TEXT_MAX,
  type SplashKind,
} from '@maqar/shared';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** A picture from `POST /uploads`, or a video from `POST /uploads/videos?splash=true`. */
const MEDIA = /^\/uploads\/(listings\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)|videos\/[A-Za-z0-9_-]+\.mp4)$/;

export class SplashDto {
  @ApiProperty({ enum: SPLASH_KINDS }) @IsIn(SPLASH_KINDS)
  kind: SplashKind;

  @ApiProperty({ nullable: true, description: 'The uploaded picture or video; null when kind is none' })
  @ValidateIf((_o, v) => v !== null)
  @Matches(MEDIA, { message: 'media must be uploaded with POST /uploads or POST /uploads/videos?splash=true' })
  media: string | null;

  @ApiProperty() @Transform(trim) @IsString() @MaxLength(SPLASH_TEXT_MAX)
  textAr: string;

  @ApiProperty() @Transform(trim) @IsString() @MaxLength(SPLASH_TEXT_MAX)
  textEn: string;
}

export class CalculatorDto implements CalculatorSettings {
  @ApiProperty({ description: 'The least down payment, in percent: a whole number from 0 to 50' }) @IsInt() @Min(0) @Max(CALCULATOR_BOUNDS.downMax)
  minDownPct: number;

  @ApiProperty() @IsInt() @Min(1) @Max(CALCULATOR_BOUNDS.yearsMax)
  minYears: number;

  @ApiProperty() @IsInt() @Min(1) @Max(CALCULATOR_BOUNDS.yearsMax)
  maxYears: number;
}

export class HomeDto {
  @ApiProperty({ enum: HOME_SECTIONS, isArray: true, description: 'The order; a section left out goes after these' })
  @IsArray()
  @ArrayMaxSize(HOME_SECTIONS.length)
  @ArrayUnique()
  @IsIn(HOME_SECTIONS, { each: true })
  sections: HomeSection[];
}

/** `PUT /admin/settings`: any of the three parts; a part sent replaces that part. */
export class SettingsDto implements AppSettingsBody {
  @ApiPropertyOptional({ type: SplashDto }) @IsOptional() @ValidateNested() @Type(() => SplashDto)
  splash?: SplashDto;

  @ApiPropertyOptional({ type: CalculatorDto }) @IsOptional() @ValidateNested() @Type(() => CalculatorDto)
  calculator?: CalculatorDto;

  @ApiPropertyOptional({ type: HomeDto }) @IsOptional() @ValidateNested() @Type(() => HomeDto)
  home?: HomeDto;
}
