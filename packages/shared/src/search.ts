import type { Category, Feature, Finishing, PropertyType } from './enums.js';

// Search, filters and sort for Explore (contract §8.4).

/** Newest, lowest price, highest price, and best match (signed-in clients, phase 6). */
export const SORTS = ['newest', 'low', 'high', 'match'] as const;
export type Sort = (typeof SORTS)[number];

/** A slider's scale. The top of the scale means "any", so no upper limit applies. */
export type Scale = { min: number; max: number; step: number };

const RENT_SCALE: Scale = { min: 0, max: 200_000, step: 5_000 };
const STAY_SCALE: Scale = { min: 0, max: 15_000, step: 500 };
const BUY_SCALE: Scale = { min: 0, max: 30_000_000, step: 250_000 };

/** The price slider follows the category: monthly rent, nightly stays, or purchase price. */
export function priceScale(category: Category | undefined): Scale {
  if (category === 'rent') return RENT_SCALE;
  if (category === 'stay') return STAY_SCALE;
  return BUY_SCALE;
}

/** The categories a price filter applies to. With All, that is sale and project listings only. */
export function priceCategories(category: Category | undefined): Category[] {
  return category ? [category] : ['sale', 'project'];
}

/** Size in m². The top of the scale means "and bigger". */
export const SIZE_SCALE: Scale = { min: 50, max: 500, step: 10 };

/** Bars in each slider's histogram. */
export const HISTOGRAM_BINS = 28;

/** The bar a value falls in. Values below or above the scale go to the first or last bar. */
export function histogramBin(value: number, min: number, max: number, bins: number): number {
  const i = Math.floor(((value - min) * bins) / (max - min));
  return Math.min(bins - 1, Math.max(0, i));
}

/** Both thumbs at the ends of the scale: the range filters nothing. */
export const isFullRange = ([lo, hi]: [number, number], scale: Scale) => lo <= scale.min && hi >= scale.max;

/** Bedroom choices. The last one means "5 or more". */
export const BEDS_OPTIONS = [1, 2, 3, 4, 5] as const;
/** Bathroom choices. The last one means "4 or more". */
export const BATHS_OPTIONS = [1, 2, 3, 4] as const;

/** Ready to move in, or a handover year. */
export type Delivery = 'ready' | number;

/** Everything Explore can filter by. Lists match any of their values, except amenities: all must be there. */
export type ListingFilters = {
  category?: Category;
  /** Free text: title, compound, area, developer and unit type, in either language. */
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  types?: PropertyType[];
  beds?: number[];
  baths?: number[];
  areas?: string[];
  delivery?: Delivery[];
  finishing?: Finishing[];
  features?: Feature[];
  /** Has an installment plan. */
  plan?: boolean;
  /** Ready to move in. */
  ready?: boolean;
  /** The price has fallen. */
  dropped?: boolean;
};

/**
 * `GET /v1/properties/facets`: counts for the filter sheet, for the same filters as the list.
 * Each histogram ignores its own range, so moving a thumb does not change the bars under it.
 */
export type ListingFacets = {
  /** Listings that match every filter. */
  total: number;
  /** Over the price scale of the category; counts only the categories the price applies to. */
  price: Scale & { counts: number[] };
  size: Scale & { counts: number[] };
  /** Handover years in this category, for the delivery choices. */
  deliveryYears: number[];
};
