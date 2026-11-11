import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller.js';
import { InsightsRepository } from './insights.repository.js';
import { InsightsService, ListingCounter } from './insights.service.js';

@Module({
  controllers: [InsightsController],
  providers: [InsightsRepository, InsightsService, ListingCounter],
  exports: [ListingCounter],
})
export class InsightsModule {}
