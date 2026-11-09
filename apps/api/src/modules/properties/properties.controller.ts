import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { ListingFacets, MatchCount, Page, PropertyCard, PropertyDetail } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { MatchCountQueryDto, prefsOfQuery } from './dto/match-count-query.dto.js';
import { ListingFiltersDto, PropertiesQueryDto } from './dto/properties-query.dto.js';
import { PropertiesService } from './properties.service.js';

/** Router for `/v1/properties` (contract §14). Browsing needs no sign-in. */
@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  /** Approved listings: search, filters and sort, one page at a time. `sort=match` needs a signed-in client. */
  @Public()
  @ApiBearerAuth()
  @Get()
  browse(@Query() query: PropertiesQueryDto, @CurrentUser() user?: AuthUser): Promise<Page<PropertyCard>> {
    return this.properties.browse(query, user);
  }

  /** "Picked for you": the 6 best matches for the signed-in client, with reasons. */
  @ApiBearerAuth()
  @Roles('client')
  @Get('recommended')
  recommended(@CurrentUser() user: AuthUser): Promise<PropertyCard[]> {
    return this.properties.recommended(user);
  }

  /** Onboarding: how many homes fit these preferences 70% or more. */
  @Public()
  @Get('match-count')
  matchCount(@Query() query: MatchCountQueryDto): Promise<MatchCount> {
    return this.properties.matchCount(prefsOfQuery(query));
  }

  /** Counts for the filter sheet, for the same filters as the list. Before `:id`, so "facets" is not read as an id. */
  @Public()
  @Get('facets')
  facets(@Query() query: ListingFiltersDto): Promise<ListingFacets> {
    return this.properties.facets(query);
  }

  /** The property page. Each request counts as a view. */
  @Public()
  @Get(':id')
  @ApiNotFoundResponse({ description: 'Missing or not approved' })
  detail(@Param('id', ParseIntPipe) id: number): Promise<PropertyDetail> {
    return this.properties.detail(id);
  }

  /** Up to 6 approved homes like this one. */
  @Public()
  @Get(':id/similar')
  @ApiNotFoundResponse({ description: 'Missing or not approved' })
  similar(@Param('id', ParseIntPipe) id: number): Promise<PropertyCard[]> {
    return this.properties.similar(id);
  }
}
