import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { AREA_ID, BUDGET_MAX } from '../../users/dto/prefs.dto.js';
import { toList } from './properties-query.dto.js';

/** `GET /v1/properties/match-count`: preferences being picked in onboarding, as a query. Lists are comma-separated. */
export class MatchCountQueryDto {
  @ApiProperty({ type: String, example: 'sale,project' })
  @Transform(toList) @ArrayMinSize(1) @ArrayMaxSize(CATEGORIES.length) @IsIn(CATEGORIES, { each: true })
  purpose!: Category[];

  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(BUDGET_MAX)
  budgetMax!: number;

  @ApiPropertyOptional({ type: String, example: 'new-cairo,zayed' })
  @IsOptional() @Transform(toList) @ArrayMaxSize(50) @Matches(AREA_ID, { each: true })
  area?: string[];

  @ApiPropertyOptional({ type: String, example: 'apartment' })
  @IsOptional() @Transform(toList) @ArrayMaxSize(PROPERTY_TYPES.length) @IsIn(PROPERTY_TYPES, { each: true })
  type?: PropertyType[];

  @ApiPropertyOptional({ default: 0 }) @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(PREFS_BEDS_MAX)
  beds = 0;

  @ApiPropertyOptional({ type: String, example: 'pool,gym' })
  @IsOptional() @Transform(toList) @ArrayMaxSize(FEATURES.length) @IsIn(FEATURES, { each: true })
  interest?: Feature[];
}

export const prefsOfQuery = (q: MatchCountQueryDto): Prefs => ({
  purpose: [...new Set(q.purpose)],
  budgetMax: q.budgetMax,
  areas: q.area ?? [],
  types: q.type ?? [],
  beds: q.beds,
  interests: q.interest ?? [],
});
