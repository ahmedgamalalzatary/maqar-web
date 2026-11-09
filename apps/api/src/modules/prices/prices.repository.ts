import { Injectable } from '@nestjs/common';
import { type PriceChange, applyPriceChange } from '@maqar/shared';
import { and, desc, eq } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { properties } from '../properties/properties.schema.js';
import { priceAlerts, priceHistory } from './prices.schema.js';

/** `changed` is false when the price was already this one: nothing is written then. */
export type ChangedListing = PriceChange & { changed: boolean; was: number; status: string; titleAr: string; titleEn: string };

@Injectable()
export class PricesRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  /** The homes a client follows, most recently followed first. */
  async followedIds(userId: number): Promise<number[]> {
    const rows = await this.db
      .select({ propertyId: priceAlerts.propertyId })
      .from(priceAlerts)
      .where(eq(priceAlerts.userId, userId))
      .orderBy(desc(priceAlerts.createdAt), desc(priceAlerts.propertyId));
    return rows.map((r) => r.propertyId);
  }

  /** Following again changes nothing. */
  async follow(userId: number, propertyId: number): Promise<void> {
    await this.db.insert(priceAlerts).values({ userId, propertyId }).onDuplicateKeyUpdate({ set: { userId } });
  }

  async unfollow(userId: number, propertyId: number): Promise<void> {
    await this.db.delete(priceAlerts).where(and(eq(priceAlerts.userId, userId), eq(priceAlerts.propertyId, propertyId)));
  }

  async followers(propertyId: number): Promise<number[]> {
    const rows = await this.db.select({ userId: priceAlerts.userId }).from(priceAlerts).where(eq(priceAlerts.propertyId, propertyId));
    return rows.map((r) => r.userId);
  }

  /**
   * Sets the new price and records the change, in one transaction with the row locked, so two
   * changes at once cannot both read the same old price. Undefined when the listing is missing.
   */
  async changePrice(propertyId: number, next: number, by: number): Promise<ChangedListing | undefined> {
    return this.db.transaction(async (tx) => {
      const [cur] = await tx
        .select({ price: properties.price, oldPrice: properties.oldPrice, status: properties.status, titleAr: properties.titleAr, titleEn: properties.titleEn })
        .from(properties)
        .where(eq(properties.id, propertyId))
        .for('update');
      if (!cur) return undefined;
      const base = { was: cur.price, status: cur.status, titleAr: cur.titleAr, titleEn: cur.titleEn };
      if (cur.price === next) return { ...base, price: next, oldPrice: cur.oldPrice, dropped: false, dropPct: 0, changed: false };
      const change = applyPriceChange(cur, next);
      await tx.update(properties).set({ price: change.price, oldPrice: change.oldPrice }).where(eq(properties.id, propertyId));
      await tx.insert(priceHistory).values({ propertyId, oldPrice: cur.price, newPrice: next, changedBy: by });
      return { ...base, ...change, changed: true };
    });
  }
}
