import { bigint, boolean, date, decimal, int, mysqlTable, primaryKey, tinyint, varchar } from 'drizzle-orm/mysql-core';
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

/**
 * An agent's bookable hours for one weekday (contract §16.1 #8): the first and last hour a viewing
 * can start (10 and 20 means 10:00 to 20:00). No row for a weekday means the agent does not work
 * that day; an agent with no rows at all uses the default hours. Admins set them in Phase 18.
 */
export const agentHours = mysqlTable(
  'agent_hours',
  {
    agentId: bigint('agent_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => agents.userId, { onDelete: 'cascade' }),
    /** 0 = Sunday … 6 = Saturday. */
    weekday: tinyint('weekday', { unsigned: true }).notNull(),
    fromHour: tinyint('from_hour', { unsigned: true }).notNull(),
    toHour: tinyint('to_hour', { unsigned: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.weekday] })],
);

/** A single date an agent does not work: a holiday or a day off (Cairo calendar day). */
export const agentDaysOff = mysqlTable(
  'agent_days_off',
  {
    agentId: bigint('agent_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => agents.userId, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    reason: varchar('reason', { length: 100 }),
  },
  (t) => [primaryKey({ columns: [t.agentId, t.date] })],
);
