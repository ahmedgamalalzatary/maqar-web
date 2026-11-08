import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@maqar/shared';
import { HealthRepository } from './health.repository.js';

const VERSION = process.env.npm_package_version ?? '0.0.0';

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
