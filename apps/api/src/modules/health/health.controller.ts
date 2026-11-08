import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { HealthResponse } from '@maqar/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { HealthService } from './health.service.js';

/** Router for `/v1/health`. The app's start screen uses it to show the connection. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: 'API and database are up' })
  @ApiServiceUnavailableResponse({ description: 'The database is down' })
  async check(): Promise<HealthResponse> {
    const report = await this.health.check();
    if (report.db === 'down') throw new ServiceUnavailableException(report);
    return report;
  }
}
