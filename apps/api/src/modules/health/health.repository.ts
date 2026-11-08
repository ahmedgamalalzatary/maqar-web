import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';

/** Database access for the health check. */
@Injectable()
export class HealthRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** Resolves when MySQL answers; rejects when it cannot be reached. */
  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }
}
