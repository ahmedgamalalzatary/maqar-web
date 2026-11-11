import { INSIGHT_RANGES, type ListingStats, insightsSummary, lastDays, rangeTotals } from '../../src/insights.js';

const stats = (over: Partial<ListingStats> = {}): ListingStats =>
  ({
    days: [
      { day: '2026-11-10', views: 4, saves: 1, interested: 0 },
      { day: '2026-11-11', views: 6, saves: 2, interested: 3 },
    ],
    totals: { views: 120, saves: 9, followers: 4, interested: 11, chats: 5, viewings: 2 },
    ...over,
  }) as ListingStats;

describe('lastDays', () => {
  it('lists the last n Cairo days ending today, oldest first, across months and years', () => {
    expect(lastDays('2026-11-11', 3)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']);
    expect(lastDays('2027-01-01', 2)).toEqual(['2026-12-31', '2027-01-01']);
    expect(lastDays('2028-03-01', 2)).toEqual(['2028-02-29', '2028-03-01']);
  });
  it('covers each range the screens offer', () => {
    for (const n of INSIGHT_RANGES) expect(lastDays('2026-11-11', n)).toHaveLength(n);
  });
});

describe('rangeTotals', () => {
  it('adds up the days shown', () => {
    expect(rangeTotals(stats().days)).toEqual({ views: 10, saves: 3, interested: 3 });
    expect(rangeTotals([])).toEqual({ views: 0, saves: 0, interested: 0 });
  });
});

describe('insightsSummary', () => {
  it('gives the owner the range and all-time numbers in their language', () => {
    const ar = insightsSummary(stats(), 'فيلا في الشيخ زايد', 'ar');
    expect(ar).toContain('فيلا في الشيخ زايد');
    expect(ar).toContain('آخر ٢ يوم');
    expect(ar).toContain('١٠ مشاهدة');
    expect(ar).toContain('١١ عميل مهتم');
    const en = insightsSummary(stats(), 'Villa in Zayed', 'en');
    expect(en).toContain('Villa in Zayed');
    expect(en).toContain('last 2 days: 10 views, 3 saves, 3 new interested clients');
    expect(en).toContain('120 views');
    expect(en).toContain('11 interested clients');
  });
});
