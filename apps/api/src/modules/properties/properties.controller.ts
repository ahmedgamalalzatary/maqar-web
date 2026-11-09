import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Page, PropertyCard } from '@maqar/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { PropertiesQueryDto } from './dto/properties-query.dto.js';
import { PropertiesService } from './properties.service.js';

/** Router for `/v1/properties` (contract §14). Browsing needs no sign-in. */
@ApiTags('properties')
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  /** Approved listings, newest first, filtered by category and area, one page at a time. */
  @Public()
  @Get()
  browse(@Query() query: PropertiesQueryDto): Promise<Page<PropertyCard>> {
    return this.properties.browse(query);
  }
}
