import { mysqlTable, varchar } from 'drizzle-orm/mysql-core';

/** Contract §13. The id is a readable slug (`new-cairo`), used in links and filters. */
export const areas = mysqlTable('areas', {
  id: varchar('id', { length: 40 }).primaryKey(),
  nameAr: varchar('name_ar', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  cityAr: varchar('city_ar', { length: 100 }).notNull(),
  cityEn: varchar('city_en', { length: 100 }).notNull(),
  /** Path under the API host, for example `/uploads/seed/p2.jpg`. */
  image: varchar('image', { length: 255 }).notNull(),
});

export type AreaRow = typeof areas.$inferSelect;
