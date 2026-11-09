import type { Category, ListingFilters, PropertiesQuery, Sort } from '@maqar/shared';

/** What Explore shows: the filters plus the sort. */
export type ExploreFilters = ListingFilters & { sort: Sort };

const LISTS = {
  types: 'type',
  beds: 'beds',
  baths: 'baths',
  areas: 'area',
  delivery: 'delivery',
  finishing: 'finishing',
  features: 'feature',
} as const satisfies Partial<Record<keyof ListingFilters, string>>;

const NUMBERS = ['minPrice', 'maxPrice', 'minSize', 'maxSize'] as const;
const QUICK = ['plan', 'ready', 'dropped'] as const;

/** The query string for `GET /v1/properties` and its facets. Only what is set; lists are comma-separated. */
export function listingParams(q: PropertiesQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.category) p.set('category', q.category);
  const text = q.q?.trim();
  if (text) p.set('q', text);
  for (const k of NUMBERS) if (q[k] !== undefined) p.set(k, String(q[k]));
  for (const [k, name] of Object.entries(LISTS) as [keyof typeof LISTS, string][]) {
    const values = q[k];
    if (values?.length) p.set(name, values.join(','));
  }
  for (const k of QUICK) if (q[k]) p.set(k, 'true');
  if (q.sort && q.sort !== 'newest') p.set('sort', q.sort);
  if (q.page !== undefined) p.set('page', String(q.page));
  if (q.limit !== undefined) p.set('limit', String(q.limit));
  return p;
}

/** The filter button's badge: each range once, plus each picked value. */
export function activeFilterCount(f: ListingFilters & { sort?: Sort }): number {
  const price = f.minPrice !== undefined || f.maxPrice !== undefined ? 1 : 0;
  const size = f.minSize !== undefined || f.maxSize !== undefined ? 1 : 0;
  const picked = Object.keys(LISTS).reduce((n, k) => n + (f[k as keyof typeof LISTS]?.length ?? 0), 0);
  return price + size + picked;
}

/** "Clear filters": keeps the category, the search and the sort. */
export function clearFilters({ category, q, sort }: ExploreFilters): ExploreFilters {
  return { ...(category && { category }), ...(q && { q }), sort };
}

/** Another category has another price scale, so the price range goes. */
export function withCategory(f: ExploreFilters, category: Category | undefined): ExploreFilters {
  const { minPrice: _min, maxPrice: _max, category: _old, ...rest } = f;
  return category ? { ...rest, category } : rest;
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** A typed number in Arabic or Latin digits; separators are ignored. Undefined when there are no digits. */
export function parseDigits(text: string): number | undefined {
  const digits = text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d))).replace(/\D/g, '');
  return digits ? Number(digits) : undefined;
}
