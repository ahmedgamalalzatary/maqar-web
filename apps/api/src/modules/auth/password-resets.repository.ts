import { Injectable } from '@nestjs/common';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { RESET_CODE_TRIES } from '@maqar/shared';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { type PasswordResetRow, passwordResets } from './password-resets.schema.js';

/** Password-reset codes (phase 31): one per account, looked up by account. */
@Injectable()
export class PasswordResetsRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async find(userId: number): Promise<PasswordResetRow | undefined> {
    const [row] = await this.db.select().from(passwordResets).where(eq(passwordResets.userId, userId));
    return row;
  }

  /** A new code for the account, replacing any earlier one. */
  async replace(userId: number, codeHash: string, createdAt: Date, expiresAt: Date): Promise<void> {
    await this.db
      .insert(passwordResets)
      .values({ userId, codeHash, createdAt, expiresAt, tries: 0 })
      .onDuplicateKeyUpdate({ set: { codeHash, createdAt, expiresAt, tries: 0 } });
  }

  async addTry(id: number): Promise<void> {
    await this.db.update(passwordResets).set({ tries: sql`${passwordResets.tries} + 1` }).where(eq(passwordResets.id, id));
  }

  /**
   * Spends the code: true for exactly one caller, while it is unexpired, under its tries and still
   * this code, so two requests at once cannot both use it.
   */
  async consume(id: number, codeHash: string, now: Date): Promise<boolean> {
    const [res] = await this.db
      .delete(passwordResets)
      .where(and(eq(passwordResets.id, id), eq(passwordResets.codeHash, codeHash), gt(passwordResets.expiresAt, now), lt(passwordResets.tries, RESET_CODE_TRIES)));
    return res.affectedRows === 1;
  }

  async remove(userId: number): Promise<void> {
    await this.db.delete(passwordResets).where(eq(passwordResets.userId, userId));
  }
}
