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

@Global()
@Module({
  providers: [
    {
      provide: DB_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createPool({ uri: config.get('DATABASE_URL', { infer: true }), connectionLimit: 10, timezone: 'Z' }),
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
