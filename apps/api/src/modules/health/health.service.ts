import { createRequire } from 'node:module';
import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@maqar/shared';
import { HealthRepository } from './health.repository.js';

// apps/api/package.json is three levels up from both src/modules/health and dist/modules/health.
const VERSION: string = createRequire(import.meta.url)('../../../package.json').version;

@Injectable()
export class HealthService {
  constructor(private readonly repo: HealthRepository) {}

  /** Whether the API and its database are up. Never throws. */
  async check(): Promise<HealthResponse> {
    const time = new Date().toISOString();
    try {
      await this.repo.ping();
      return { status: 'ok', db: 'up', version: VERSION, time };
    } catch {
      return { status: 'degraded', db: 'down', version: VERSION, time };
    }
  }
}
