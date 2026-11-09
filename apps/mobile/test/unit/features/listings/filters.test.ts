import {
  activeFilterCount,
  clearFilters,
  type ExploreFilters,
  listingParams,
  parseDigits,
  withCategory,
} from '@/features/listings/filters';

const params = (f: Parameters<typeof listingParams>[0]) => Object.fromEntries(listingParams(f));

describe('listingParams', () => {
  it('sends only what is set, with lists comma-separated under the API names', () => {
    expect(
      params({
        category: 'sale',
        q: ' villa ',
        minPrice: 1_000_000,
        types: ['villa', 'chalet'],
        beds: [5],
        areas: ['zayed', 'maadi'],
        delivery: ['ready', 2028],
        features: ['pool', 'sea'],
        plan: true,
        tour: true,
        dropped: false,
        sort: 'low',
        page: 2,
        limit: 20,
      }),
    ).toEqual({
      category: 'sale',
      q: 'villa',
      minPrice: '1000000',
      type: 'villa,chalet',
      beds: '5',
      area: 'zayed,maadi',
      delivery: 'ready,2028',
      feature: 'pool,sea',
      tour: 'true',
      plan: 'true',
      sort: 'low',
      page: '2',
      limit: '20',
    });
  });

  it('leaves out the default sort, empty lists and a blank search', () => {
    expect(params({ sort: 'newest', types: [], q: '  ' })).toEqual({});
  });
});

describe('activeFilterCount', () => {
  it('counts each range once and each picked value, but not the category, search, sort or quick filters', () => {
    const f: ExploreFilters = {
      category: 'rent',
      q: 'maadi',
      sort: 'high',
      plan: true,
      minPrice: 5_000,
      maxPrice: 50_000,
      maxSize: 200,
      beds: [1, 2],
      features: ['pool'],
    };
    expect(activeFilterCount(f)).toBe(5);
    expect(activeFilterCount({ sort: 'newest' })).toBe(0);
  });
});

describe('clearFilters', () => {
  it('keeps the category, search and sort, and drops every filter including the quick ones', () => {
    expect(clearFilters({ category: 'sale', q: 'villa', sort: 'low', ready: true, beds: [3], minPrice: 1 })).toEqual({
      category: 'sale',
      q: 'villa',
      sort: 'low',
    });
  });
});

describe('withCategory', () => {
  it('drops the price range, because the price scale changes with the category', () => {
    expect(withCategory({ sort: 'newest', category: 'sale', minPrice: 1_000_000, beds: [2] }, 'rent')).toEqual({
      sort: 'newest',
      category: 'rent',
      beds: [2],
    });
  });
});

describe('parseDigits', () => {
  it('reads Arabic and Latin digits and ignores separators', () => {
    expect(parseDigits('١٢٬٥٠٠')).toBe(12_500);
    expect(parseDigits('3,000,000')).toBe(3_000_000);
    expect(parseDigits('٢5٠')).toBe(250);
  });

  it('is undefined when there are no digits', () => {
    expect(parseDigits('')).toBeUndefined();
    expect(parseDigits('أي سعر')).toBeUndefined();
  });
});
