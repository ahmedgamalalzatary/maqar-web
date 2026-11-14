import type { AppSettings } from '@maqar/shared';
import { sql } from 'drizzle-orm';
import { json, mysqlTable, timestamp, tinyint } from 'drizzle-orm/mysql-core';

/**
 * What an admin sets for the whole app (phase 29): one row (id 1) holding the opening screen, the
 * calculator's limits and the Home order. No row means the defaults.
 */
export const appSettings = mysqlTable('app_settings', {
  id: tinyint('id').primaryKey(),
  value: json('value').$type<AppSettings>().notNull(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
});
