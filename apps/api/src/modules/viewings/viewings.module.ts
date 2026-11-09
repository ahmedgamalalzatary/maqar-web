import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PropertiesModule } from '../properties/properties.module.js';
import { UsersModule } from '../users/users.module.js';
import { SlotsController, ViewingsController } from './viewings.controller.js';
import { ViewingsRepository } from './viewings.repository.js';
import { ViewingsService } from './viewings.service.js';

/** Viewing booking (contract §8.7, §8.8). */
@Module({
  imports: [PropertiesModule, NotificationsModule, UsersModule],
  controllers: [SlotsController, ViewingsController],
  providers: [ViewingsRepository, ViewingsService],
  exports: [ViewingsService],
})
export class ViewingsModule {}
