import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AppSettings } from '@maqar/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { SettingsDto } from './dto/settings.dto.js';
import { SettingsService } from './settings.service.js';

/** Router for `/v1/settings` (phase 29): what the app reads when it opens. */
@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** The opening screen, the calculator's limits and the order of the Home sections. */
  @Public()
  @Get()
  get(): Promise<AppSettings> {
    return this.settings.get();
  }
}

/** Router for `/v1/admin/settings` (phase 29, contract §11). */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Changes the parts sent; the others stay. */
  @Put()
  update(@Body() body: SettingsDto): Promise<AppSettings> {
    return this.settings.update(body);
  }
}
