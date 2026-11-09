import { sql } from 'drizzle-orm';
import { bigint, index, mysqlTable, primaryKey, timestamp } from 'drizzle-orm/mysql-core';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';

/** A client following a home's price (contract §8.9, §13). Milliseconds keep quick follows in order. */
export const priceAlerts = mysqlTable(
  'price_alerts',
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
  (t) => [primaryKey({ columns: [t.userId, t.propertyId] }), index('price_alerts_property_idx').on(t.propertyId)],
);

/** Every price change of a listing, and who made it (contract §13). */
export const priceHistory = mysqlTable(
  'price_history',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    propertyId: bigint('property_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    oldPrice: bigint('old_price', { mode: 'number', unsigned: true }).notNull(),
    newPrice: bigint('new_price', { mode: 'number', unsigned: true }).notNull(),
    /** Null once that account is gone. */
    changedBy: bigint('changed_by', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'set null' }),
    at: timestamp('at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index('price_history_property_idx').on(t.propertyId, t.id)],
);
