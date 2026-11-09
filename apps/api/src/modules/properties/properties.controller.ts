import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { ListingFacets, Page, PropertyCard, PropertyDetail } from '@maqar/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { ListingFiltersDto, PropertiesQueryDto } from './dto/properties-query.dto.js';
import { PropertiesService } from './properties.service.js';

/** Router for `/v1/properties` (contract §14). Browsing needs no sign-in. */
@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  /** Approved listings: search, filters and sort, one page at a time. */
  @Public()
  @Get()
  browse(@Query() query: PropertiesQueryDto): Promise<Page<PropertyCard>> {
    return this.properties.browse(query);
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
