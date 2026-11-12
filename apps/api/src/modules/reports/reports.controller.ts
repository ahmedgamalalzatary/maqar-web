import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { ReportResult } from '@maqar/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ReportParamDto, ReportQueryDto } from './reports.dto.js';
import { ReportsService } from './reports.service.js';

/** Router for `/v1/admin/analytics` (phase 27, contract §11): the standard reports (`/admin/reports` is chat reports, phase 24). */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(':id')
  get(@Param() p: ReportParamDto, @Query() q: ReportQueryDto): Promise<ReportResult> {
    return this.reports.get(p.id, q);
  }
}
