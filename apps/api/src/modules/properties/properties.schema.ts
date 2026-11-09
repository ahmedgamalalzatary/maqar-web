import { CATEGORIES, FEATURES, FINISHINGS, PROPERTY_STATUSES, PROPERTY_TYPES } from '@maqar/shared';
import {
  bigint,
  boolean,
  decimal,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  tinyint,
  varchar,
} from 'drizzle-orm/mysql-core';
import { agents } from '../agents/agents.schema.js';
import { areas } from '../areas/areas.schema.js';
import { users } from '../users/users.schema.js';

/** A listing (contract §13). Money is whole EGP: per month for rent, per night for stays. */
export const properties = mysqlTable(
  'properties',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    category: mysqlEnum('category', CATEGORIES).notNull(),
    type: mysqlEnum('type', PROPERTY_TYPES).notNull(),
    titleAr: varchar('title_ar', { length: 200 }).notNull(),
    titleEn: varchar('title_en', { length: 200 }).notNull(),
    areaId: varchar('area_id', { length: 40 })
      .notNull()
      .references(() => areas.id),
    compoundAr: varchar('compound_ar', { length: 150 }).notNull(),
    compoundEn: varchar('compound_en', { length: 150 }).notNull(),
    developerAr: varchar('developer_ar', { length: 150 }),
    developerEn: varchar('developer_en', { length: 150 }),
    price: bigint('price', { mode: 'number', unsigned: true }).notNull(),
    oldPrice: bigint('old_price', { mode: 'number', unsigned: true }),
    beds: tinyint('beds', { unsigned: true }).notNull(),
    baths: tinyint('baths', { unsigned: true }).notNull(),
    sizeM2: smallint('size_m2', { unsigned: true }).notNull(),
    floor: tinyint('floor', { unsigned: true }),
    finishing: mysqlEnum('finishing', FINISHINGS).notNull(),
    /** Null means ready to move in; otherwise the handover year. */
    deliveryYear: smallint('delivery_year', { unsigned: true }),
    agentId: bigint('agent_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => agents.userId),
    ownerId: bigint('owner_id', { mode: 'number', unsigned: true }).references(() => users.id),
    status: mysqlEnum('status', PROPERTY_STATUSES).notNull().default('draft'),
    reviewNote: text('review_note'),
    featured: boolean('featured').notNull().default(false),
    /** Maintenance deposit, % of the price. */
    maintenanceFee: tinyint('maintenance_fee', { unsigned: true }),
    planDownPct: tinyint('plan_down_pct', { unsigned: true }),
    planYears: tinyint('plan_years', { unsigned: true }),
    descAr: text('desc_ar').notNull(),
    descEn: text('desc_en').notNull(),
    /** Where the map pin goes. Null until the owner or agent sets it. */
    lat: decimal('lat', { precision: 9, scale: 6, mode: 'number' }),
    lng: decimal('lng', { precision: 9, scale: 6, mode: 'number' }),
    views: int('views', { unsigned: true }).notNull().default(0),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // The public list: approved, by category and area, newest first.
    index('properties_browse_idx').on(t.status, t.category, t.publishedAt),
    index('properties_area_idx').on(t.status, t.areaId, t.publishedAt),
  ],
);

export const propertyFeatures = mysqlTable(
  'property_features',
  {
    propertyId: bigint('property_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    feature: mysqlEnum('feature', FEATURES).notNull(),
  },
  (t) => [primaryKey({ columns: [t.propertyId, t.feature] })],
);

/** Photos of a listing. `sort` 0 is the cover. */
export const propertyImages = mysqlTable(
  'property_images',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    propertyId: bigint('property_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 255 }).notNull(),
    sort: tinyint('sort', { unsigned: true }).notNull().default(0),
  },
  (t) => [index('property_images_property_idx').on(t.propertyId, t.sort)],
);

export type PropertyRow = typeof properties.$inferSelect;
export type NewPropertyRow = typeof properties.$inferInsert;
