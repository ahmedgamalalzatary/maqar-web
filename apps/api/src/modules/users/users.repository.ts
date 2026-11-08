import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { type AgentRow, agents } from '../agents/agents.schema.js';
import { type NewUserRow, type UserRow, users } from './users.schema.js';

/** All database access for accounts. Deleted accounts are never returned. */
@Injectable()
export class UsersRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  async findActiveById(id: number): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
    return row;
  }

  async findActiveByEmail(email: string): Promise<UserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)));
    return row;
  }

  async findAgentProfile(userId: number): Promise<AgentRow | undefined> {
    const [row] = await this.db.select().from(agents).where(eq(agents.userId, userId));
    return row;
  }

  async create(data: NewUserRow): Promise<number> {
    const [{ id }] = await this.db.insert(users).values(data).$returningId();
    return id;
  }

  async update(id: number, data: Partial<NewUserRow>): Promise<void> {
    await this.db
      .update(users)
      .set(data)
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
  }

  /**
   * Deletes an account (contract §15 privacy): personal data is wiped and the email is
   * released so it can sign up again. The row stays so past records keep their links.
   */
  async softDelete(id: number): Promise<void> {
    await this.db
      .update(users)
      .set({ name: '', email: null, phone: null, passwordHash: null, deletedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)));
  }
}
