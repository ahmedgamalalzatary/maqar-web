import { bigint, char, datetime, index, mysqlTable, timestamp } from 'drizzle-orm/mysql-core';
import { users } from '../users/users.schema.js';

/**
 * One row per issued refresh token. Only the SHA-256 of the token is stored.
 * Tokens rotate on every refresh; reusing a rotated token revokes the user's sessions.
 */
export const refreshTokens = mysqlTable(
  'refresh_tokens',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    userId: bigint('user_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: datetime('expires_at').notNull(),
    revokedAt: datetime('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

export type RefreshTokenRow = typeof refreshTokens.$inferSelect;
