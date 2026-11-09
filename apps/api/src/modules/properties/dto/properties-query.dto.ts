import { ApiPropertyOptional } from '@nestjs/swagger';
import { CATEGORIES, type Category, PAGE_LIMIT_MAX, type PropertiesQuery } from '@maqar/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const PAGE_MAX = 1_000_000;

/** `GET /v1/properties` query. Unknown parameters are refused by the global pipe. */
export class PropertiesQueryDto implements PropertiesQuery {
  @ApiPropertyOptional({ enum: CATEGORIES }) @IsOptional() @IsIn(CATEGORIES)
  category?: Category;

  @ApiPropertyOptional({ example: 'new-cairo', description: 'Area id' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  area?: string;

  /** Capped so the database offset ((page - 1) * limit) stays a normal number. */
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: PAGE_MAX })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(PAGE_MAX)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: PAGE_LIMIT_MAX })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(PAGE_LIMIT_MAX)
  limit = 20;
}
