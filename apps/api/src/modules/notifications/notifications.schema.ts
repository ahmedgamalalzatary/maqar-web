import { NOTIFICATION_KINDS, PUSH_PLATFORMS } from '@maqar/shared';
import { sql } from 'drizzle-orm';
import { bigint, index, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../users/users.schema.js';

/** One inbox entry (contract §8.13, §13), in both languages so a change of language shows it right. */
export const notifications = mysqlTable(
  'notifications',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: mysqlEnum('kind', NOTIFICATION_KINDS).notNull(),
    titleAr: varchar('title_ar', { length: 160 }).notNull(),
    titleEn: varchar('title_en', { length: 160 }).notNull(),
    bodyAr: varchar('body_ar', { length: 500 }).notNull(),
    bodyEn: varchar('body_en', { length: 500 }).notNull(),
    /** The app screen a tap opens, e.g. `/property/4`. */
    href: varchar('href', { length: 255 }),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.id)],
);

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotificationRow = typeof notifications.$inferInsert;

/**
 * A phone that gets this account's pushes (contract §13). A token belongs to one phone, so when
 * someone else signs in on it, the token moves to their account.
 */
export const pushTokens = mysqlTable('push_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  platform: mysqlEnum('platform', PUSH_PLATFORMS).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
});
