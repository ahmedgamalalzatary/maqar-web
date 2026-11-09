import { Injectable } from '@nestjs/common';
import type { Prefs } from '@maqar/shared';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { type AgentRow, agents } from '../agents/agents.schema.js';
import { areas } from '../areas/areas.schema.js';
import { favorites } from '../favorites/favorites.schema.js';
import { notifications, pushTokens } from '../notifications/notifications.schema.js';
import { clientPrefs, type NewUserRow, type UserRow, users } from './users.schema.js';

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
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ name: '', email: null, phone: null, passwordHash: null, deletedAt: new Date() })
        .where(and(eq(users.id, id), isNull(users.deletedAt)));
      // Preferences, saved homes and notifications are personal too, and the phones get no more pushes.
      await tx.delete(clientPrefs).where(eq(clientPrefs.userId, id));
      await tx.delete(favorites).where(eq(favorites.userId, id));
      await tx.delete(notifications).where(eq(notifications.userId, id));
      await tx.delete(pushTokens).where(eq(pushTokens.userId, id));
    });
  }

  /** A client's saved preferences, or undefined before onboarding. */
  async findPrefs(userId: number): Promise<Prefs | undefined> {
    const [row] = await this.db.select().from(clientPrefs).where(eq(clientPrefs.userId, userId));
    return (
      row && {
        purpose: row.purposes,
        budgetMax: row.budgetMax,
        areas: row.areaIds,
        types: row.types,
        beds: row.minBeds,
        interests: row.interests,
      }
    );
  }

  /** Saves a client's preferences, replacing any saved before. */
  async savePrefs(userId: number, p: Prefs): Promise<void> {
    const row = { purposes: p.purpose, budgetMax: p.budgetMax, areaIds: p.areas, types: p.types, minBeds: p.beds, interests: p.interests };
    await this.db
      .insert(clientPrefs)
      .values({ userId, ...row })
      .onDuplicateKeyUpdate({ set: row });
  }

  /** How many of these area ids exist. */
  async countAreas(ids: string[]): Promise<number> {
    if (!ids.length) return 0;
    return this.db.$count(areas, inArray(areas.id, ids));
  }
}
