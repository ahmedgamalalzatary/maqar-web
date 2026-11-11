import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PropertiesModule } from '../properties/properties.module.js';
import { AdminPriceController, AlertsController } from './prices.controller.js';
import { PricesRepository } from './prices.repository.js';
import { PricesService } from './prices.service.js';

/** Price drop alerts and price changes (contract §8.9). */
@Module({
  imports: [PropertiesModule, NotificationsModule, InsightsModule],
  controllers: [AlertsController, AdminPriceController],
  providers: [PricesRepository, PricesService],
  exports: [PricesService],
})
export class PricesModule {}
