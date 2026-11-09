import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BATHS_OPTIONS,
  BEDS_OPTIONS,
  CATEGORIES,
  type Category,
  type Delivery,
  FEATURES,
  type Feature,
  FINISHINGS,
  type Finishing,
  type ListingFilters,
  PAGE_LIMIT_MAX,
  PROPERTY_TYPES,
  type PropertyType,
  SORTS,
  type Sort,
} from '@maqar/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const PAGE_MAX = 1_000_000;
const PRICE_MAX = 10_000_000_000;
const SIZE_MAX = 100_000;
const AREA_ID = /^[a-z0-9-]{1,40}$/;
const DELIVERY = /^(ready|20\d\d)$/;

/** `a,b` or `x=a&x=b` → `['a', 'b']`. */
const toList = ({ value }: { value: unknown }) =>
  value === undefined
    ? undefined
    : (Array.isArray(value) ? value : [value])
        .flatMap((v) => String(v).split(','))
        .map((s) => s.trim())
        .filter(Boolean);

const toIntList = (arg: { value: unknown }) => toList(arg)?.map((s) => (/^\d+$/.test(s) ? Number(s) : s));

/** Only "true"/"1" and "false"/"0"; anything else stays a string and fails `IsBoolean`. */
const toBool = ({ value }: { value: unknown }) =>
  value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value;

const commaList = (description: string, values?: readonly (string | number)[]) =>
  ApiPropertyOptional({ description: `${description}. Comma-separated or repeated.`, type: String, example: values?.slice(0, 2).join(',') });

/** The filters, shared by the list and its facets (contract §8.4). Unknown parameters are refused by the global pipe. */
export class ListingFiltersDto {
  @ApiPropertyOptional({ enum: CATEGORIES }) @IsOptional() @IsIn(CATEGORIES)
  category?: Category;

  @ApiPropertyOptional({ description: 'Title, compound, area, developer or unit type, in Arabic or English', maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ description: 'EGP. On All it limits the list to sale and project listings.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(PRICE_MAX)
  minPrice?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(PRICE_MAX)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'm²' }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(SIZE_MAX)
  minSize?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(SIZE_MAX)
  maxSize?: number;

  @commaList('Unit types', PROPERTY_TYPES)
  @IsOptional() @Transform(toList) @ArrayMaxSize(PROPERTY_TYPES.length) @IsIn(PROPERTY_TYPES, { each: true })
  type?: PropertyType[];

  @commaList('Bedrooms; 5 means 5 or more', BEDS_OPTIONS)
  @IsOptional() @Transform(toIntList) @ArrayMaxSize(BEDS_OPTIONS.length) @IsIn(BEDS_OPTIONS, { each: true })
  beds?: number[];

  @commaList('Bathrooms; 4 means 4 or more', BATHS_OPTIONS)
  @IsOptional() @Transform(toIntList) @ArrayMaxSize(BATHS_OPTIONS.length) @IsIn(BATHS_OPTIONS, { each: true })
  baths?: number[];

  @commaList('Area ids', ['new-cairo', 'zayed'])
  @IsOptional() @Transform(toList) @ArrayMaxSize(50) @Matches(AREA_ID, { each: true })
  area?: string[];

  @commaList('"ready" or handover years', ['ready', 2028])
  @IsOptional() @Transform(toList) @ArrayMaxSize(20) @Matches(DELIVERY, { each: true })
  delivery?: string[];

  @commaList('Finishing', FINISHINGS)
  @IsOptional() @Transform(toList) @ArrayMaxSize(FINISHINGS.length) @IsIn(FINISHINGS, { each: true })
  finishing?: Finishing[];

  @commaList('Amenities; a listing must have all of them', FEATURES)
  @IsOptional() @Transform(toList) @ArrayMaxSize(FEATURES.length) @IsIn(FEATURES, { each: true })
  feature?: Feature[];

  @ApiPropertyOptional({ description: 'Has an installment plan' }) @IsOptional() @Transform(toBool) @IsBoolean()
  plan?: boolean;

  @ApiPropertyOptional({ description: 'Ready to move in' }) @IsOptional() @Transform(toBool) @IsBoolean()
  ready?: boolean;

  @ApiPropertyOptional({ description: 'The price has fallen' }) @IsOptional() @Transform(toBool) @IsBoolean()
  dropped?: boolean;
}

/** The query string names one value (`type`, `area`, `feature`); the filters name the lists. */
export function toListingFilters(d: ListingFiltersDto): ListingFilters {
  return {
    category: d.category,
    q: d.q?.trim() || undefined,
    minPrice: d.minPrice,
    maxPrice: d.maxPrice,
    minSize: d.minSize,
    maxSize: d.maxSize,
    types: d.type,
    beds: d.beds,
    baths: d.baths,
    areas: d.area,
    delivery: d.delivery?.map((s): Delivery => (s === 'ready' ? 'ready' : Number(s))),
    finishing: d.finishing,
    features: d.feature,
    plan: d.plan,
    ready: d.ready,
    dropped: d.dropped,
  };
}

/** `GET /v1/properties` query. */
export class PropertiesQueryDto extends ListingFiltersDto {
  @ApiPropertyOptional({ enum: SORTS, default: 'newest' }) @IsOptional() @IsIn(SORTS)
  sort: Sort = 'newest';

  /** Capped so the database offset ((page - 1) * limit) stays a normal number. */
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: PAGE_MAX })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(PAGE_MAX)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: PAGE_LIMIT_MAX })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(PAGE_LIMIT_MAX)
  limit = 20;
}
