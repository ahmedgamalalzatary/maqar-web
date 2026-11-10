import { Module } from '@nestjs/common';
import { PricesModule } from '../prices/prices.module.js';
import { AdminListingsController } from './listings.controller.js';
import { ListingsRepository } from './listings.repository.js';
import { ListingsService } from './listings.service.js';

/** Admin listings (phase 17): create, edit, publish, unpublish, close. */
@Module({
  imports: [PricesModule],
  controllers: [AdminListingsController],
  providers: [ListingsRepository, ListingsService],
})
export class ListingsModule {}
