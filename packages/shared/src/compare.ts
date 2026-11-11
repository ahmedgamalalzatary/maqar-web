import type { Category } from './enums.js';
import { fmtMoney, fmtNum, fmtPct } from './format.js';
import { installment } from './installment.js';
import type { Bi } from './labels.js';

// Compare two homes (contract §8.10): which value is better in each row, and the short verdict.

/** At most this many homes are compared. */
export const COMPARE_MAX = 2;

/** Which side wins a row: the lower value, the higher one, or neither (the row is informational). */
export type Better = 'low' | 'high' | null;

/** The side that has the better value: 0, 1, or null on a tie, a missing value or no better side. */
export function winner(vals: readonly [number | null, number | null], better: Better): 0 | 1 | null {
  const [a, b] = vals;
  if (!better || a === null || b === null || a === b) return null;
  return (better === 'low' ? a < b : a > b) ? 0 : 1;
}

/** What the verdict needs to know about a home. */
export type CompareHome = {
  category: Category;
  price: number;
  sizeM2: number;
  plan: { downPct: number; years: number } | null;
  delivery: 'ready' | number;
};

/** A plan for homes without one, as the demo shows. */
const FALLBACK_PLAN = { downPct: 20, years: 5 };

/** The monthly installment of a home to buy, on its plan — or, without one, on the assumed 20%
 *  over 5 years, flagged `estimated` so nobody takes invented terms for the seller's. */
export function compareMonthly(h: Pick<CompareHome, 'category' | 'price' | 'plan'>) {
  if (h.category !== 'sale' && h.category !== 'project') return null;
  const plan = h.plan ?? FALLBACK_PLAN;
  return { payment: installment(h.price, plan.downPct, plan.years).payment, ...plan, estimated: h.plan === null };
}

/** Price per m² only counts as a difference above this share. */
const PER_M2_MIN_GAP = 0.03;

export type VerdictLine = { who: 0 | 1; text: Bi };

/**
 * The short verdict, as in the demo: cheaper per m², bigger, lower installment, ready now,
 * and (for a signed-in client) the better fit. `scores` are the two match scores.
 */
export function compareVerdict(a: CompareHome, b: CompareHome, scores?: readonly [number, number]): VerdictLine[] {
  const out: VerdictLine[] = [];

  const perA = a.price / a.sizeM2;
  const perB = b.price / b.sizeM2;
  const gap = Math.abs(perA - perB) / Math.max(perA, perB);
  if (a.category === b.category && gap > PER_M2_MIN_GAP) {
    const pct = Math.round(gap * 100);
    out.push({
      who: perA < perB ? 0 : 1,
      text: { ar: `أرخص في سعر المتر بـ ${fmtPct(pct, 'ar')}`, en: `${pct}% cheaper per m²` },
    });
  }

  if (a.sizeM2 !== b.sizeM2) {
    const diff = Math.abs(a.sizeM2 - b.sizeM2);
    out.push({ who: a.sizeM2 > b.sizeM2 ? 0 : 1, text: { ar: `أكبر بـ ${fmtNum(diff, 'ar')} م²`, en: `${fmtNum(diff, 'en')} m² bigger` } });
  }

  const ma = compareMonthly(a);
  const mb = compareMonthly(b);
  if (ma && mb && Math.round(ma.payment) !== Math.round(mb.payment)) {
    const diff = Math.round(Math.abs(ma.payment - mb.payment));
    const assumed = ma.estimated || mb.estimated;
    out.push({
      who: ma.payment < mb.payment ? 0 : 1,
      text: assumed
        ? { ar: `قسط شهري أقل بـ ${fmtMoney(diff, 'ar')} (بتقدير ٢٠٪ مقدم على ٥ سنين)`, en: `${fmtMoney(diff, 'en')} less per month (on an assumed 20% over 5 years)` }
        : { ar: `قسط شهري أقل بـ ${fmtMoney(diff, 'ar')}`, en: `${fmtMoney(diff, 'en')} less per month` },
    });
  }

  if ((a.delivery === 'ready') !== (b.delivery === 'ready')) {
    out.push({ who: a.delivery === 'ready' ? 0 : 1, text: { ar: 'جاهزة للسكن فوراً', en: 'Ready to move in now' } });
  }

  if (scores && scores[0] !== scores[1]) {
    const best = Math.max(scores[0], scores[1]);
    out.push({
      who: scores[0] > scores[1] ? 0 : 1,
      text: { ar: `أنسب لتفضيلاتك (${fmtNum(best, 'ar')}٪ تطابق)`, en: `Better fit for you (${best}% match)` },
    });
  }
  return out;
}
