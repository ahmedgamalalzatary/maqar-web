import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { type AdminArea, areaSlug } from '@maqar/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AreasRepository } from './areas.repository.js';
import { AreaDto, UpdateAreaDto } from './dto/areas.dto.js';

/** Router for `/v1/admin/areas` (phase 18, contract §11): the areas clients browse by. */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/areas')
export class AdminAreasController {
  constructor(private readonly areas: AreasRepository) {}

  /** Every area with how many listings use it. */
  @Get()
  list(): Promise<AdminArea[]> {
    return this.areas.findAllWithCounts();
  }

  @Post()
  @ApiConflictResponse({ description: 'The id is taken' })
  async create(@Body() body: AreaDto): Promise<AdminArea> {
    const id = body.id ?? areaSlug(body.nameEn);
    if (id.length < 2) throw new BadRequestException('Give the area an English name, or an id');
    if (await this.areas.find(id)) throw new ConflictException('There is already an area with that id');
    await this.areas.create({ ...body, id });
    return this.one(id);
  }

  @Patch(':id')
  @ApiNotFoundResponse({ description: 'No such area' })
  async update(@Param('id') id: string, @Body() body: UpdateAreaDto): Promise<AdminArea> {
    if (!(await this.areas.find(id))) throw new NotFoundException('Area not found');
    await this.areas.update(id, body);
    return this.one(id);
  }

  /** Only an area no listing uses. */
  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiConflictResponse({ description: 'Listings use it' })
  async remove(@Param('id') id: string): Promise<void> {
    const area = (await this.areas.findAllWithCounts()).find((a) => a.id === id);
    if (!area) throw new NotFoundException('Area not found');
    if (area.listings > 0) throw new ConflictException('Listings use this area: move them first');
    await this.areas.remove(id);
  }

  private async one(id: string): Promise<AdminArea> {
    return (await this.areas.findAllWithCounts()).find((a) => a.id === id)!;
  }
}
