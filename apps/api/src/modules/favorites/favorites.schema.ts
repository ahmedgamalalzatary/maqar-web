import { sql } from 'drizzle-orm';
import { bigint, mysqlTable, primaryKey, timestamp } from 'drizzle-orm/mysql-core';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';

/** A home a client saved (contract §8.9). Milliseconds keep quick saves in the order they were made. */
export const favorites = mysqlTable(
  'favorites',
  {
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    propertyId: bigint('property_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.propertyId] })],
);
