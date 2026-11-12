import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { type AdminOverview, OVERVIEW_RANGES, type OverviewRange } from '@maqar/shared';
import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { OverviewService } from './overview.service.js';

export class OverviewQueryDto {
  @ApiPropertyOptional({ enum: OVERVIEW_RANGES, default: 30 }) @IsOptional() @Type(() => Number) @IsIn(OVERVIEW_RANGES)
  days: OverviewRange = 30;
}

/** Router for `/v1/admin/overview` (phase 25, contract §11): the business at a glance. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/overview')
export class AdminOverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  get(@Query() q: OverviewQueryDto): Promise<AdminOverview> {
    return this.overview.get(q.days);
  }
}
