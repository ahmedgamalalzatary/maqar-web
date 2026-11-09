import type { Category, Feature, PropertyType } from './enums.js';
import type { Bi } from './labels.js';
import type { Scale } from './search.js';

// Preferences and the match score (contract §8.1 and §8.3).

/** A client's preferences. `beds` 0 means no minimum. */
export type Prefs = {
  /** What the client is looking for. The first one decides how the budget reads. */
  purpose: Category[];
  /** Whole EGP: per month when the first purpose is rent, otherwise a purchase price. */
  budgetMax: number;
  areas: string[];
  types: PropertyType[];
  beds: number;
  /** Must-haves. */
  interests: Feature[];
};

/** What onboarding starts from, and what a client who skipped it is scored with (as in the demo). */
export const DEFAULT_PREFS: Prefs = { purpose: ['sale'], budgetMax: 12_000_000, areas: [], types: [], beds: 0, interests: [] };

/** The budget slider: monthly for a renter, a purchase price for everyone else (as in the demo). */
export const BUDGET_SCALE = {
  rent: { min: 10_000, max: 200_000, step: 5_000, presets: [25_000, 50_000, 90_000, 150_000] },
  buy: { min: 2_000_000, max: 40_000_000, step: 250_000, presets: [5_000_000, 8_000_000, 12_000_000, 20_000_000] },
} as const satisfies Record<string, Scale & { presets: readonly number[] }>;

export const budgetScale = (purpose: readonly Category[]) => (purpose[0] === 'rent' ? BUDGET_SCALE.rent : BUDGET_SCALE.buy);

/** The most bedrooms onboarding offers; 5 means 5 or more. */
export const PREFS_BEDS_MAX = 5;

/** What the score needs to know about a listing. */
export type MatchListing = {
  category: Category;
  type: PropertyType;
  /** Per month for rent, per night for stays. */
  price: number;
  area: { id: string; nameAr: string; nameEn: string };
  beds: number;
  features: Feature[];
  plan: boolean;
  tour: boolean;
};

export type Match = { score: number; reasons: Bi[] };

export const MATCH_MIN = 32;
export const MATCH_MAX = 99;
/** Onboarding counts the homes that match this much or more. */
export const GOOD_MATCH = 70;

/** Points per rule (contract §8.3). The API's SQL uses the same numbers. */
export const MATCH_POINTS = {
  start: 40,
  purpose: 14,
  withinBudget: 18,
  nearBudget: 6,
  overBudget: -18,
  area: 14,
  anyArea: 4,
  type: 8,
  beds: 4,
  perInterest: 4,
  interestsMax: 12,
  plan: 2,
  tour: 2,
} as const;

/** "Near your budget" reaches this far over it, in percent. */
export const NEAR_BUDGET_PCT = 115;

/** Rent and stay prices as the client's budget reads them. */
export const PRICE_FACTOR = {
  rentBudget: { rent: 1, stay: 4 },
  buyBudget: { rent: 144, stay: 300 },
} as const;

/**
 * The listing's price on the client's terms. A renter's budget is monthly, so a stay counts four
 * nights. Anyone else's is a purchase price: 12 years of rent, or 300 nights of a stay.
 */
export function comparablePrice(category: Category, price: number, firstPurpose: Category | undefined): number {
  if (category !== 'rent' && category !== 'stay') return price;
  const factors = firstPurpose === 'rent' ? PRICE_FACTOR.rentBudget : PRICE_FACTOR.buyBudget;
  return price * factors[category];
}

const WITHIN: Bi = { ar: 'ضمن ميزانيتك', en: 'Within budget' };
const NEAR: Bi = { ar: 'قريب من ميزانيتك', en: 'Near your budget' };

/** How well a listing fits a client: 32–99, with up to two reasons (contract §8.3). */
export function matchScore(p: MatchListing, prefs: Prefs): Match {
  const P = MATCH_POINTS;
  let score = P.start;
  const reasons: Bi[] = [];
  const price = comparablePrice(p.category, p.price, prefs.purpose[0]);

  if (prefs.purpose.includes(p.category)) score += P.purpose;
  if (price <= prefs.budgetMax) {
    score += P.withinBudget;
    reasons.push(WITHIN);
  } else if (price * 100 <= prefs.budgetMax * NEAR_BUDGET_PCT) {
    score += P.nearBudget;
    reasons.push(NEAR);
  } else score += P.overBudget;

  if (!prefs.areas.length) score += P.anyArea;
  else if (prefs.areas.includes(p.area.id)) {
    score += P.area;
    reasons.push({ ar: p.area.nameAr, en: p.area.nameEn });
  }
  if (prefs.types.includes(p.type)) score += P.type;
  if (prefs.beds > 0 && p.beds >= prefs.beds) score += P.beds;
  const hits = p.features.filter((f) => prefs.interests.includes(f)).length;
  score += Math.min(P.interestsMax, hits * P.perInterest);
  if (p.plan && prefs.interests.length) score += P.plan;
  if (p.tour) score += P.tour;

  return { score: Math.max(MATCH_MIN, Math.min(MATCH_MAX, score)), reasons: reasons.slice(0, 2) };
}
