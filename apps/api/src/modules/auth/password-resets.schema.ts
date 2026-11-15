import { bigint, char, datetime, index, mysqlTable, tinyint } from 'drizzle-orm/mysql-core';
import { users } from '../users/users.schema.js';

/**
 * A password-reset code sent by email (phase 31). At most one per account: asking again replaces
 * it. Only a hash of the code is kept; it dies after its minutes, its wrong tries, or its use.
 */
export const passwordResets = mysqlTable(
  'password_resets',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: char('code_hash', { length: 64 }).notNull(),
    tries: tinyint('tries', { unsigned: true }).notNull().default(0),
    expiresAt: datetime('expires_at').notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (t) => [index('password_resets_expires_idx').on(t.expiresAt)],
);

export type PasswordResetRow = typeof passwordResets.$inferSelect;
