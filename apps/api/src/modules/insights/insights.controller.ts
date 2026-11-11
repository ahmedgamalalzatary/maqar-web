import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { INSIGHT_RANGES, type InterestedClient, type ListingStats } from '@maqar/shared';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { InsightsService } from './insights.service.js';

export class InterestedQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit = 20;
}

export class StatsQueryDto {
  @ApiPropertyOptional({ enum: INSIGHT_RANGES, default: 30, description: 'Days, ending today (Cairo)' })
  @IsOptional()
  @Type(() => Number)
  @IsIn(INSIGHT_RANGES)
  days = 30;
}

/** `/v1/admin/listings/:id/stats` and `/interested` (phase 19), for any status. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/listings')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get(':id/stats')
  @ApiNotFoundResponse({ description: 'No such listing' })
  stats(@Param('id', ParseIntPipe) id: number, @Query() q: StatsQueryDto): Promise<ListingStats> {
    return this.insights.stats(id, q.days);
  }

  /** One page of clients who saved, followed, chatted about or booked the listing, with their phone. */
  @Get(':id/interested')
  @ApiNotFoundResponse({ description: 'No such listing' })
  interested(@Param('id', ParseIntPipe) id: number, @Query() q: InterestedQueryDto): Promise<InterestedClient[]> {
    return this.insights.interested(id, q.page, q.limit);
  }
}
