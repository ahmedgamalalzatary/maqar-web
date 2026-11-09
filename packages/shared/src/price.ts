// Price changes and price drop alerts (contract §8.9).

import { fmtMoney, fmtPct } from './format.js';

export type PriceState = { price: number; oldPrice: number | null };

/** What a price change leaves on the listing, and whether followers are told. */
export type PriceChange = PriceState & {
  /** True only when the price went down: then everyone following the home is notified. */
  dropped: boolean;
  /** This drop, in whole %, at least 1; 0 when it is not a drop. */
  dropPct: number;
};

/**
 * The listing shows the old price struck through while the price is under it. A drop keeps the
 * highest price the home had before it, so a home cut twice shows its whole fall; a rise back up
 * to the old price or above clears it.
 */
export function applyPriceChange(cur: PriceState, next: number): PriceChange {
  if (next < cur.price) {
    const pct = Math.max(1, Math.round(((cur.price - next) / cur.price) * 100));
    return { price: next, oldPrice: Math.max(cur.oldPrice ?? 0, cur.price), dropped: true, dropPct: pct };
  }
  const oldPrice = cur.oldPrice !== null && cur.oldPrice > next ? cur.oldPrice : null;
  return { price: next, oldPrice, dropped: false, dropPct: 0 };
}

/** The "price dropped" notification (contract §8.9): "Price dropped 5%: X is now Y (was Z)". */
export function priceDropText(home: { titleAr: string; titleEn: string }, was: number, now: number, pct: number) {
  return {
    titleAr: `السعر نزل ${fmtPct(pct, 'ar', 0)}`,
    titleEn: `Price dropped ${fmtPct(pct, 'en', 0)}`,
    bodyAr: `${home.titleAr} بقى ${fmtMoney(now, 'ar')} بدل ${fmtMoney(was, 'ar')}`,
    bodyEn: `${home.titleEn} is now ${fmtMoney(now, 'en')} (was ${fmtMoney(was, 'en')})`,
  };
}
