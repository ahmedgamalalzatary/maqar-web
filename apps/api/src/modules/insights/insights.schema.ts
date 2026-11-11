import { bigint, date, int, mysqlEnum, mysqlTable, primaryKey } from 'drizzle-orm/mysql-core';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';

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

/**
 * The first time a client became interested in a listing, per kind (phase 19): saved, followed
 * its price, chatted or booked. Written once and never removed, so the daily "new interested"
 * history survives unsaves, unfollows, cancelled bookings and account deletion.
 */
export const interestFirst = mysqlTable(
  'interest_first',
  {
    propertyId: bigint('property_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    clientId: bigint('client_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: mysqlEnum('kind', ['saved', 'followed', 'chatted', 'booked']).notNull(),
    day: date('day', { mode: 'string' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.clientId, t.kind] })],
);
