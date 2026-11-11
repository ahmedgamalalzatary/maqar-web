import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module.js';
import { UsersModule } from '../users/users.module.js';
import { PropertiesController } from './properties.controller.js';
import { PropertiesRepository } from './properties.repository.js';
import { PropertiesService } from './properties.service.js';

@Module({
  imports: [UsersModule, InsightsModule],
  controllers: [PropertiesController],
  providers: [PropertiesRepository, PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
