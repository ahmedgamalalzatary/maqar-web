import { LANGS, ROLES, THEMES } from '@maqar/shared';
import { sql } from 'drizzle-orm';
import { bigint, boolean, mysqlEnum, mysqlTable, timestamp, varchar } from 'drizzle-orm/mysql-core';

/** Contract §13. One role per account (§16.1 #9). */
export const users = mysqlTable('users', {
  id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  role: mysqlEnum('role', ROLES).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  /** Null after the account is deleted, so the address can sign up again. */
  email: varchar('email', { length: 255 }).unique(),
  /** Null for accounts that will sign in with Google later. */
  passwordHash: varchar('password_hash', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  lang: mysqlEnum('lang', LANGS).notNull().default('ar'),
  theme: mysqlEnum('theme', THEMES).notNull().default('system'),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
  deletedAt: timestamp('deleted_at'),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
