import { Module } from '@nestjs/common';
import { PropertiesModule } from '../properties/properties.module.js';
import { FavoritesController } from './favorites.controller.js';
import { FavoritesRepository } from './favorites.repository.js';
import { FavoritesService } from './favorites.service.js';

@Module({
  imports: [PropertiesModule],
  controllers: [FavoritesController],
  providers: [FavoritesRepository, FavoritesService],
})
export class FavoritesModule {}
