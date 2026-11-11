import { Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
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

  /** Saving again changes nothing: the home keeps its place in the list. True when it is a new save. */
  async add(userId: number, propertyId: number): Promise<boolean> {
    const [res] = await this.db.insert(favorites).ignore().values({ userId, propertyId });
    return res.affectedRows === 1;
  }

  async remove(userId: number, propertyId: number): Promise<void> {
    await this.db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.propertyId, propertyId)));
  }
}
