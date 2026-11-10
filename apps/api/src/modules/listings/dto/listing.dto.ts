import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  CATEGORIES,
  type Category,
  FEATURES,
  type Feature,
  FINISHINGS,
  type Finishing,
  LISTING_IMAGES_MAX,
  type ListingBody,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type PropertyStatus,
  type PropertyType,
  type PublishBody,
} from '@maqar/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Only photos uploaded to this server (or the seed's): never another site, never a path that climbs out. */
const UPLOADED = /^\/uploads\/(listings|seed)\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/;
/** Admin lists are longer than the public ones. */
const ADMIN_PAGE_MAX = 100;
const AREA_ID = /^[a-z0-9-]{1,40}$/;
const PHONE = /^\+?[0-9][0-9 ]{5,19}$/;
/** Handover years the form offers. */
const DELIVERY = ['ready', ...Array.from({ length: 61 }, (_, i) => 2000 + i)] as const;

export class PlanDto {
  @ApiProperty() @IsInt() @Min(0) @Max(100)
  downPct: number;

  @ApiProperty() @IsInt() @Min(1) @Max(30)
  years: number;
}

export class LocationDto {
  @ApiProperty() @IsNumber() @Min(-90) @Max(90)
  lat: number;

  @ApiProperty() @IsNumber() @Min(-180) @Max(180)
  lng: number;
}

/** `POST /admin/listings`: the five steps of the listing form (contract §9.2). */
export class ListingDto implements ListingBody {
  @ApiProperty({ enum: CATEGORIES }) @IsIn(CATEGORIES)
  category: Category;

  @ApiProperty({ enum: PROPERTY_TYPES }) @IsIn(PROPERTY_TYPES)
  type: PropertyType;

  @ApiProperty({ example: 'new-cairo' }) @Matches(AREA_ID)
  areaId: string;

  @ApiPropertyOptional({ description: 'Empty gives the default title' })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200)
  titleAr?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(200)
  titleEn?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(150)
  compoundAr?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(150)
  compoundEn?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(trim) @IsString() @MaxLength(150)
  developerAr?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(trim) @IsString() @MaxLength(150)
  developerEn?: string | null;

  @ApiProperty({ description: 'Whole EGP: per month for rent, per night for stays' })
  @IsInt() @Min(1) @Max(10_000_000_000)
  price: number;

  @ApiProperty() @IsInt() @Min(0) @Max(20)
  beds: number;

  @ApiProperty() @IsInt() @Min(0) @Max(20)
  baths: number;

  @ApiProperty() @IsInt() @Min(10) @Max(65_000)
  sizeM2: number;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() @Min(0) @Max(200)
  floor?: number | null;

  @ApiProperty({ enum: FINISHINGS }) @IsIn(FINISHINGS)
  finishing: Finishing;

  @ApiProperty({ description: '"ready", or the handover year' }) @IsIn(DELIVERY)
  delivery: 'ready' | number;

  @ApiPropertyOptional({ nullable: true, description: '% of the price' }) @IsOptional() @IsInt() @Min(0) @Max(100)
  maintenanceFee?: number | null;

  @ApiPropertyOptional({ type: PlanDto, nullable: true }) @IsOptional() @ValidateNested() @Type(() => PlanDto)
  plan?: PlanDto | null;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(5000)
  descAr?: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(5000)
  descEn?: string;

  @ApiProperty({ enum: FEATURES, isArray: true }) @IsIn(FEATURES, { each: true }) @ArrayUnique() @ArrayMaxSize(FEATURES.length)
  features: Feature[];

  @ApiProperty({ description: 'Paths from POST /uploads, cover first', example: ['/uploads/listings/….jpg'] })
  @ArrayMinSize(1, { message: 'Add at least one photo' })
  @ArrayMaxSize(LISTING_IMAGES_MAX)
  @ArrayUnique()
  @Matches(UPLOADED, { each: true, message: 'Photos must be uploaded with POST /uploads' })
  images: string[];

  @ApiPropertyOptional({ type: LocationDto, nullable: true }) @IsOptional() @ValidateNested() @Type(() => LocationDto)
  location?: LocationDto | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(trim) @IsString() @MaxLength(120)
  ownerName?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+201001234567' }) @IsOptional() @Transform(trim) @Matches(PHONE)
  ownerPhone?: string | null;
}

/** `PATCH /admin/listings/:id`: any of the same fields. A new price goes through the price history. */
export class UpdateListingDto extends PartialType(ListingDto) {
  @ApiPropertyOptional({ description: 'Shown first on Home (phase 18)' }) @IsOptional() @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Move the listing to another active advisor (phase 18)' }) @IsOptional() @IsInt() @Min(1)
  agentId?: number;
}

export class PublishDto implements PublishBody {
  @ApiPropertyOptional({ description: 'Without one, the advisor with the fewest live listings' })
  @IsOptional() @IsInt() @Min(1)
  agentId?: number;
}

export class AdminListingsQueryDto {
  @ApiPropertyOptional({ enum: PROPERTY_STATUSES }) @IsOptional() @IsIn(PROPERTY_STATUSES)
  status?: PropertyStatus;

  @ApiPropertyOptional({ description: 'Words in the title, compound, owner or phone' })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  page = 1;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(ADMIN_PAGE_MAX)
  limit = 20;
}
