import { Module } from '@nestjs/common';
import { AdminOverviewController } from './overview.controller.js';
import { OverviewRepository } from './overview.repository.js';
import { OverviewService } from './overview.service.js';

/** The admin's overview (phase 25). */
@Module({
  controllers: [AdminOverviewController],
  providers: [OverviewRepository, OverviewService],
})
export class OverviewModule {}
