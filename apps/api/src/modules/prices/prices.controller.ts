import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { PriceChangeResponse, PropertyCard } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PriceChangeDto } from './dto/price-change.dto.js';
import { PricesService } from './prices.service.js';

/** Router for `/v1/alerts`: the homes whose price a client follows (contract §8.9, §14). */
@ApiTags('alerts')
@ApiBearerAuth()
@Roles('client')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly prices: PricesService) {}

  /** Every followed home, most recently followed first. */
  @Get()
  list(@CurrentUser() user: AuthUser): Promise<PropertyCard[]> {
    return this.prices.followed(user.id);
  }

  /** Following a followed home again does nothing. */
  @Put(':propertyId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Following' })
  @ApiNotFoundResponse({ description: 'Missing or not approved' })
  follow(@CurrentUser() user: AuthUser, @Param('propertyId', ParseIntPipe) propertyId: number): Promise<void> {
    return this.prices.follow(user.id, propertyId);
  }

  /** Unfollowing a home that is not followed does nothing. */
  @Delete(':propertyId')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Not following any more' })
  unfollow(@CurrentUser() user: AuthUser, @Param('propertyId', ParseIntPipe) propertyId: number): Promise<void> {
    return this.prices.unfollow(user.id, propertyId);
  }
}

/** Router for `/v1/admin/listings/:id/price`. The rest of the admin listing tools come in Phase 17. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/listings')
export class AdminPriceController {
  constructor(private readonly prices: PricesService) {}

  /** Changes the price; a drop notifies everyone following the home. */
  @Patch(':id/price')
  @ApiNotFoundResponse({ description: 'No such listing' })
  change(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: PriceChangeDto): Promise<PriceChangeResponse> {
    return this.prices.changePrice(id, body.price, user.id);
  }
}
