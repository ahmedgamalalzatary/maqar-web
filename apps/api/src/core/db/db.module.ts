import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { createPool, type Pool } from 'mysql2/promise';
import type { Env } from '../config/env.js';
import * as schema from './schema.js';

export type Db = MySql2Database<typeof schema>;

export const DB = Symbol('DB');
const DB_POOL = Symbol('DB_POOL');

/** Inject the Drizzle database: `constructor(@InjectDb() db: Db)`. */
export const InjectDb = () => Inject(DB);

/**
 * A pool that reads and writes times as UTC (`timezone: 'Z'`), with every MySQL session in UTC too.
 * Without the second part, a server whose MySQL runs in local time (a Windows PC in Cairo) shifts
 * the times MySQL fills in itself, such as `created_at`, by its offset. Production's MySQL is UTC.
 */
export function utcPool(uri: string): Pool {
  const pool = createPool({ uri, connectionLimit: 10, timezone: 'Z' });
  pool.on('connection', (conn) => void conn.query("SET time_zone = '+00:00'"));
  return pool;
}

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => utcPool(config.get('DATABASE_URL', { infer: true })),
    },
    {
      provide: DB,
      inject: [DB_POOL],
      useFactory: (pool: Pool) => drizzle({ client: pool, schema, mode: 'default' }),
    },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
