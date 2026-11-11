import { Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { interestFirst, listingStats } from '../insights/insights.schema.js';
import { cairoClock } from '../viewings/slots.js';
import { favorites } from './favorites.schema.js';

@Injectable()
export class FavoritesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** The listing ids a client saved, most recently saved first. */
  async findIds(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ propertyId: favorites.propertyId })
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt), desc(favorites.propertyId));
    return rows.map((r) => r.propertyId);
  }

  /**
   * Saving again changes nothing: the home keeps its place in the list. True when it is a new save.
   * A new save commits the favorite, the day's saves and the first-interest record at once, so the
   * insights numbers cannot lose the save when a later write fails.
   */
  async add(userId: number, propertyId: number): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [res] = await tx.insert(favorites).ignore().values({ userId, propertyId });
      if (res.affectedRows !== 1) return false;
      const day = cairoClock(new Date()).date;
      await tx
        .insert(listingStats)
        .values({ propertyId, day, saves: 1 })
        .onDuplicateKeyUpdate({ set: { saves: sql`${listingStats.saves} + 1` } });
      await tx
        .insert(interestFirst)
        .values({ propertyId, clientId: userId, kind: 'saved', day })
        .onDuplicateKeyUpdate({ set: { day: sql`${interestFirst.day}` } });
      return true;
    });
  }

  async remove(userId: number, propertyId: number): Promise<void> {
    await this.db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId)));
  }
}
