import { type Category, type Feature, LANGS, type PropertyType, ROLES, THEMES } from '@maqar/shared';
import { sql } from 'drizzle-orm';
import { bigint, boolean, json, mysqlEnum, mysqlTable, timestamp, tinyint, varchar } from 'drizzle-orm/mysql-core';

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
  /** Set when the password or email changes: access tokens issued before it stop working at once. */
  credentialsChangedAt: timestamp('credentials_changed_at'),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

/**
 * A client's preferences (contract §8.1). One row per client, written by `PUT /me/prefs`.
 * A client with no row has not been through onboarding yet.
 */
export const clientPrefs = mysqlTable('client_prefs', {
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  purposes: json('purposes').$type<Category[]>().notNull(),
  /** Whole EGP: per month when the first purpose is rent. */
  budgetMax: bigint('budget_max', { mode: 'number', unsigned: true }).notNull(),
  areaIds: json('area_ids').$type<string[]>().notNull(),
  types: json('types').$type<PropertyType[]>().notNull(),
  /** 0 means no minimum. */
  minBeds: tinyint('min_beds', { unsigned: true }).notNull().default(0),
  interests: json('interests').$type<Feature[]>().notNull(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .onUpdateNow(),
});

export type ClientPrefsRow = typeof clientPrefs.$inferSelect;
