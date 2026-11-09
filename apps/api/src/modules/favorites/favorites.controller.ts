import { Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { PropertyCard } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { FavoritesService } from './favorites.service.js';

/** Router for `/v1/favorites`: a client's saved homes (contract §8.9, §14). */
@ApiTags('favorites')
@ApiBearerAuth()
@Roles('client')
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  /** Every saved home, most recently saved first. */
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<PropertyCard[]> {
    return this.favorites.list(user.id);
  }

  /** Saving a saved home again does nothing. */
  @Put(':propertyId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Saved' })
  @ApiNotFoundResponse({ description: 'Missing or not approved' })
  save(@CurrentUser() user: AuthUser, @Param('propertyId', ParseIntPipe) propertyId: number): Promise<void> {
    return this.favorites.save(user.id, propertyId);
  }

  /** Removing a home that is not saved does nothing. */
  @Delete(':propertyId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Not saved any more' })
  remove(@CurrentUser() user: AuthUser, @Param('propertyId', ParseIntPipe) propertyId: number): Promise<void> {
    return this.favorites.remove(user.id, propertyId);
  }
}
