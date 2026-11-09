import { ApiProperty } from '@nestjs/swagger';
import {
  CATEGORIES,
  type Category,
  FEATURES,
  type Feature,
  PREFS_BEDS_MAX,
  type Prefs,
  PROPERTY_TYPES,
  type PropertyType,
} from '@maqar/shared';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, Matches, Max, Min } from 'class-validator';

export const BUDGET_MAX = 10_000_000_000;
export const AREA_ID = /^[a-z0-9-]{1,40}$/;

/** Repeated values are kept once, in their first place. */
export const unique = ({ value }: { value: unknown }) => (Array.isArray(value) ? [...new Set(value)] : value);

/** `PUT /v1/me/prefs` (contract §8.1). Every field is required: the body replaces the saved preferences. */
export class PrefsDto implements Prefs {
  @ApiProperty({ enum: CATEGORIES, isArray: true, description: 'The first one decides how the budget reads' })
  @Transform(unique) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(CATEGORIES.length) @IsIn(CATEGORIES, { each: true })
  purpose!: Category[];

  @ApiProperty({ description: 'Whole EGP: per month when the first purpose is rent, otherwise a purchase price' })
  @IsInt() @Min(1) @Max(BUDGET_MAX)
  budgetMax!: number;

  @ApiProperty({ type: [String], example: ['new-cairo'] })
  @Transform(unique) @IsArray() @ArrayMaxSize(50) @Matches(AREA_ID, { each: true })
  areas!: string[];

  @ApiProperty({ enum: PROPERTY_TYPES, isArray: true })
  @Transform(unique) @IsArray() @ArrayMaxSize(PROPERTY_TYPES.length) @IsIn(PROPERTY_TYPES, { each: true })
  types!: PropertyType[];

  @ApiProperty({ minimum: 0, maximum: PREFS_BEDS_MAX, description: '0 means no minimum' })
  @IsInt() @Min(0) @Max(PREFS_BEDS_MAX)
  beds!: number;

  @ApiProperty({ enum: FEATURES, isArray: true, description: 'Must-haves' })
  @Transform(unique) @IsArray() @ArrayMaxSize(FEATURES.length) @IsIn(FEATURES, { each: true })
  interests!: Feature[];
}
