import { bigint, date, int, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';
import { properties } from '../properties/properties.schema.js';

/**
 * A listing's numbers for one Cairo day (phase 19): property page views and saves made that day.
 * Saves are counted when made, so the history stays when a client unsaves.
 */
export const listingStats = mysqlTable(
  'listing_stats',
  {
    propertyId: bigint('property_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    views: int('views', { unsigned: true }).notNull().default(0),
    saves: int('saves', { unsigned: true }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.day] })],
);
