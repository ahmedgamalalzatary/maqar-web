import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PropertiesModule } from '../properties/properties.module.js';
import { UsersModule } from '../users/users.module.js';
import { RemindersJob } from './reminders.job.js';
import { AdminViewingsController, SlotsController, ViewingsController } from './viewings.controller.js';
import { ViewingsRepository } from './viewings.repository.js';
import { ViewingsService } from './viewings.service.js';

/** Viewing booking (contract §8.7, §8.8). */
@Module({
  imports: [PropertiesModule, NotificationsModule, UsersModule, InsightsModule],
  controllers: [SlotsController, ViewingsController, AdminViewingsController],
  // Tests run the reminders by hand, with their own clock.
  providers: [ViewingsRepository, ViewingsService, ...(process.env.NODE_ENV === 'test' ? [] : [RemindersJob])],
  exports: [ViewingsService],
})
export class ViewingsModule {}
