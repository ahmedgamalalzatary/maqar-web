import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AreaItem } from '@maqar/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { AreasRepository } from './areas.repository.js';

/** Router for `/v1/areas` (contract §14): the areas clients browse by. */
@ApiTags('areas')
@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasRepository) {}

  @Public()
  @Get()
  list(): Promise<AreaItem[]> {
    return this.areas.findAll();
  }
}
