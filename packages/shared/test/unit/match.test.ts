import { describe, expect, it } from 'vitest';
import {
  BUDGET_SCALE,
  budgetScale,
  comparablePrice,
  DEFAULT_PREFS,
  matchScore,
  type MatchListing,
  type Prefs,
} from '../../src/match.js';

// Contract §8.3: every listing scores 32–99 with up to two reasons.
const area = { id: 'new-cairo', nameAr: 'التجمع الخامس', nameEn: 'New Cairo' };

/** A listing that earns nothing beyond the price rule, unless a test says so. */
const listing = (over: Partial<MatchListing> = {}): MatchListing => ({
  category: 'sale',
  type: 'apartment',
  price: 5_000_000,
  area,
  beds: 2,
  features: [],
  plan: false,
  tour: false,
  ...over,
});

const prefs = (over: Partial<Prefs> = {}): Prefs => ({
  purpose: ['rent'],
  budgetMax: 10_000_000,
  areas: ['zayed'],
  types: [],
  beds: 0,
  interests: [],
  ...over,
});

// 40 to start, +18 within budget. Purpose rent and area elsewhere earn nothing.
const BASE = 58;

describe('matchScore', () => {
  it('starts at 40 and adds 18 within budget', () => {
    expect(matchScore(listing(), prefs())).toEqual({ score: BASE, reasons: [{ ar: 'ضمن ميزانيتك', en: 'Within budget' }] });
  });

  it('adds 14 when the category is one of the purposes', () => {
    expect(matchScore(listing(), prefs({ purpose: ['rent', 'sale'] })).score).toBe(BASE + 14);
  });

  describe('budget', () => {
    it('counts the budget itself as within it', () => {
      expect(matchScore(listing({ price: 10_000_000 }), prefs()).score).toBe(BASE);
    });

    it('adds 6 up to 15% over, with "Near your budget"', () => {
      const m = matchScore(listing({ price: 11_500_000 }), prefs());
      expect(m.score).toBe(40 + 6);
      expect(m.reasons).toEqual([{ ar: 'قريب من ميزانيتك', en: 'Near your budget' }]);
    });

    it('takes 18 more than 15% over, with no reason', () => {
      // 40 - 18 = 22, under the floor; the beds bonus shows the 18 was taken.
      expect(matchScore(listing({ price: 11_500_001 }), prefs())).toEqual({ score: 32, reasons: [] });
      const rich = prefs({ purpose: ['sale'], areas: ['new-cairo'], types: ['apartment'] });
      expect(matchScore(listing({ price: 11_500_001 }), rich).score).toBe(40 + 14 - 18 + 14 + 8);
    });
  });

  describe('areas', () => {
    it('adds 14 and names the area when it is one of the client\'s', () => {
      const m = matchScore(listing(), prefs({ areas: ['zayed', 'new-cairo'] }));
      expect(m.score).toBe(BASE + 14);
      expect(m.reasons).toEqual([
        { ar: 'ضمن ميزانيتك', en: 'Within budget' },
        { ar: 'التجمع الخامس', en: 'New Cairo' },
      ]);
    });

    it('adds 4 when the client picked no areas', () => {
      expect(matchScore(listing(), prefs({ areas: [] })).score).toBe(BASE + 4);
    });
  });

  it('adds 8 for a picked unit type', () => {
    expect(matchScore(listing(), prefs({ types: ['villa', 'apartment'] })).score).toBe(BASE + 8);
    expect(matchScore(listing(), prefs({ types: ['villa'] })).score).toBe(BASE);
  });

  it('adds 4 when the bedrooms reach the minimum, and nothing with no minimum', () => {
    expect(matchScore(listing({ beds: 3 }), prefs({ beds: 3 })).score).toBe(BASE + 4);
    expect(matchScore(listing({ beds: 2 }), prefs({ beds: 3 })).score).toBe(BASE);
    expect(matchScore(listing({ beds: 2 }), prefs({ beds: 0 })).score).toBe(BASE);
  });

  it('adds 4 per must-have the listing has, up to 12', () => {
    const interests = prefs({ interests: ['pool', 'gym', 'garden', 'sea'] });
    expect(matchScore(listing({ features: ['pool', 'parking'] }), interests).score).toBe(BASE + 4);
    expect(matchScore(listing({ features: ['pool', 'gym', 'garden', 'sea'] }), interests).score).toBe(BASE + 12);
  });

  it('adds 2 for a payment plan only when the client picked must-haves', () => {
    expect(matchScore(listing({ plan: true }), prefs()).score).toBe(BASE);
    expect(matchScore(listing({ plan: true }), prefs({ interests: ['pool'] })).score).toBe(BASE + 2);
  });

  it('adds 2 for a 360° tour', () => {
    expect(matchScore(listing({ tour: true }), prefs()).score).toBe(BASE + 2);
  });

  it('never goes below 32 or above 99', () => {
    expect(matchScore(listing({ price: 50_000_000 }), prefs()).score).toBe(32);
    const best = matchScore(
      listing({ features: ['pool', 'gym', 'garden'], plan: true, tour: true, beds: 3 }),
      prefs({ purpose: ['sale'], areas: ['new-cairo'], types: ['apartment'], beds: 3, interests: ['pool', 'gym', 'garden'] }),
    );
    // 40 + 14 + 18 + 14 + 8 + 4 + 12 + 2 + 2 = 114
    expect(best.score).toBe(99);
  });

  it('gives at most two reasons', () => {
    expect(matchScore(listing(), prefs({ areas: ['new-cairo'] })).reasons).toHaveLength(2);
  });
});

describe('comparablePrice (the price on the client\'s terms)', () => {
  it('keeps sale and project prices', () => {
    expect(comparablePrice('sale', 4_000_000, 'rent')).toBe(4_000_000);
    expect(comparablePrice('project', 4_000_000, 'sale')).toBe(4_000_000);
  });

  it('on a rent budget: rent as is, a stay night × 4', () => {
    expect(comparablePrice('rent', 30_000, 'rent')).toBe(30_000);
    expect(comparablePrice('stay', 5_000, 'rent')).toBe(20_000);
  });

  it('on a purchase budget: a month of rent × 144, a night × 300', () => {
    expect(comparablePrice('rent', 30_000, 'sale')).toBe(4_320_000);
    expect(comparablePrice('stay', 5_000, 'stay')).toBe(1_500_000);
    expect(comparablePrice('rent', 30_000, undefined)).toBe(4_320_000);
  });

  it('scores a rent listing against a rent budget', () => {
    const renter = prefs({ purpose: ['rent'], budgetMax: 40_000 });
    expect(matchScore(listing({ category: 'rent', price: 35_000 }), renter).score).toBe(BASE + 14);
    expect(matchScore(listing({ category: 'stay', price: 11_000 }), renter).reasons).toEqual([
      { ar: 'قريب من ميزانيتك', en: 'Near your budget' },
    ]);
  });
});

describe('budget slider', () => {
  it('is monthly for a renter and a purchase price for everyone else', () => {
    expect(budgetScale(['rent', 'sale'])).toBe(BUDGET_SCALE.rent);
    expect(budgetScale(['sale', 'rent'])).toBe(BUDGET_SCALE.buy);
    expect(BUDGET_SCALE.rent).toMatchObject({ min: 10_000, max: 200_000, step: 5_000 });
    expect(BUDGET_SCALE.buy).toMatchObject({ min: 2_000_000, max: 40_000_000, step: 250_000 });
  });

  it('starts from the demo\'s defaults', () => {
    expect(DEFAULT_PREFS).toEqual({ purpose: ['sale'], budgetMax: 12_000_000, areas: [], types: [], beds: 0, interests: [] });
  });
});
