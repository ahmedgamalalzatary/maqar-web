import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { AdminAgentOption, AdminListing, AdminListingsPage } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AdminListingsQueryDto, ListingDto, PublishDto, UpdateListingDto } from './dto/listing.dto.js';
import { ListingsService } from './listings.service.js';

/** Router for `/v1/admin/listings` (phase 17). The price route lives with the price alerts. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/listings')
export class AdminListingsController {
  constructor(private readonly listings: ListingsService) {}

  /** Every status, newest first, with a count per status. */
  @Get()
  page(@Query() q: AdminListingsQueryDto): Promise<AdminListingsPage> {
    return this.listings.page(q);
  }

  /** A draft, with no advisor until it is published. */
  @Post()
  create(@Body() body: ListingDto): Promise<AdminListing> {
    return this.listings.create(body);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'No such listing' })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminListing> {
    return this.listings.get(id);
  }

  @Patch(':id')
  @ApiNotFoundResponse({ description: 'No such listing' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateListingDto): Promise<AdminListing> {
    return this.listings.update(id, body, user.id);
  }

  /** Live in Explore, with a sales advisor. */
  @Post(':id/publish')
  @HttpCode(200)
  @ApiConflictResponse({ description: 'Already live' })
  publish(@Param('id', ParseIntPipe) id: number, @Body() body: PublishDto): Promise<AdminListing> {
    return this.listings.publish(id, body.agentId);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  @ApiConflictResponse({ description: 'Not live' })
  unpublish(@Param('id', ParseIntPipe) id: number): Promise<AdminListing> {
    return this.listings.unpublish(id);
  }

  /** Sold (sale, project) or rented (rent, stay). */
  @Post(':id/close')
  @HttpCode(200)
  @ApiConflictResponse({ description: 'A draft, or already closed' })
  close(@Param('id', ParseIntPipe) id: number): Promise<AdminListing> {
    return this.listings.close(id);
  }
}

/** Router for `/v1/admin/agents`: the advisors a listing can go to. Agents CRUD comes in Phase 18. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/agents')
export class AdminAgentsController {
  constructor(private readonly listings: ListingsService) {}

  /** Active advisors, the one with the fewest live listings first. */
  @Get()
  list(): Promise<AdminAgentOption[]> {
    return this.listings.agentOptions();
  }
}
