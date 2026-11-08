import { bigint, boolean, decimal, int, mysqlTable, varchar } from 'drizzle-orm/mysql-core';
import { users } from '../users/users.schema.js';

/** Sales agent profile (contract §13). The account itself is a `users` row with role `agent`. */
export const agents = mysqlTable('agents', {
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  nameAr: varchar('name_ar', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  roleTitleAr: varchar('role_title_ar', { length: 100 }).notNull(),
  roleTitleEn: varchar('role_title_en', { length: 100 }).notNull(),
  rating: decimal('rating', { precision: 2, scale: 1, mode: 'number' }).notNull().default(5),
  dealsCount: int('deals_count').notNull().default(0),
  years: int('years').notNull().default(0),
  languagesAr: varchar('languages_ar', { length: 100 }).notNull(),
  languagesEn: varchar('languages_en', { length: 100 }).notNull(),
  avgReplyMins: int('avg_reply_mins').notNull().default(5),
  phone: varchar('phone', { length: 20 }).notNull(),
  colour: varchar('colour', { length: 7 }).notNull(),
  monthlyTarget: int('monthly_target').notNull().default(0),
  active: boolean('active').notNull().default(true),
});

export type AgentRow = typeof agents.$inferSelect;
