import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { PropertiesController } from './properties.controller.js';
import { PropertiesRepository } from './properties.repository.js';
import { PropertiesService } from './properties.service.js';

@Module({
  imports: [UsersModule],
  controllers: [PropertiesController],
  providers: [PropertiesRepository, PropertiesService],
})
export class PropertiesModule {}
