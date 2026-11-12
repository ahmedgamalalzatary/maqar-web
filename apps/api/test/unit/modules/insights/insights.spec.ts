import { vi } from 'vitest';
import { FavoritesService } from '../../../../src/modules/favorites/favorites.service.js';
import { InsightsRepository, type InterestRow } from '../../../../src/modules/insights/insights.repository.js';
import { InsightsService } from '../../../../src/modules/insights/insights.service.js';
import { PropertiesService } from '../../../../src/modules/properties/properties.service.js';

const stubRepo = (over: Record<string, unknown> = {}): InsightsRepository =>
  ({
    interest: async (): Promise<InterestRow[]> => [],
    firstInterestDays: async (): Promise<{ day: string; clients: number }[]> => [],
    firstTrackedDay: async (): Promise<string | null> => null,
    totals: async () => ({ views: 0, saves: 0, followers: 0, chats: 0, viewings: 0 }),
    days: async () => [],
    exists: async () => true,
    clients: async () => [],
    ...over,
  }) as unknown as InsightsRepository;

describe('InsightsService daily interest history', () => {
  it('counts each client on the day of their first interest event, which survives unsaves', async () => {
    const repo = stubRepo({
      firstInterestDays: async () => [
        { day: '2026-11-09', clients: 1 },
        { day: '2026-11-10', clients: 2 },
      ],
    });
    const stats = await new InsightsService(repo).stats(7, 30);
    const day = (d: string) => stats.days.find((x) => x.day === d)!.interested;
    expect(day('2026-11-09')).toBe(1);
    expect(day('2026-11-10')).toBe(2);
    expect(stats.totals.interested).toBe(3);
  });

  it('shows zero on days without first-interest events', async () => {
    const stats = await new InsightsService(stubRepo({})).stats(7, 30);
    expect(stats.days.every((d) => d.interested === 0)).toBe(true);
    expect(stats.totals.interested).toBe(0);
  });

  it('reports the first day daily tracking has numbers for, so old days are not presented as zeros', async () => {
    const stats = await new InsightsService(stubRepo({ firstTrackedDay: async () => '2026-11-05' })).stats(7, 30);
    expect(stats.since).toBe('2026-11-05');
  });

  it('reports no tracking start when nothing was recorded yet', async () => {
    const stats = await new InsightsService(stubRepo({})).stats(7, 30);
    expect(stats.since).toBeNull();
  });

  it('paginates the interested clients instead of returning every client at once', async () => {
    const people = [
      { id: 21, name: 'أ', phone: null },
      { id: 22, name: 'ب', phone: null },
      { id: 23, name: 'ج', phone: null },
    ];
    const rows = people.map((p) => ({ clientId: p.id, kind: 'saved' as const, firstAt: new Date('2026-11-09T10:00:00.000Z'), lastAt: new Date('2026-11-09T10:00:00.000Z') }));
    const repo = stubRepo({ clients: async () => people, interest: async () => rows });
    const page2 = await new InsightsService(repo).interested(7, 2, 1);
    expect(page2.map((c) => c.id)).toEqual([22]);
  });
});

describe('Counters commit with their source operation', () => {
  it('saving a home needs no separate counter: favorite, day saves and first interest commit together in the repository', async () => {
    const repo = { add: vi.fn(async () => true), remove: vi.fn(), findIds: vi.fn(async () => []) };
    const properties = { assertApproved: vi.fn(), approvedCards: vi.fn(async () => []) };
    const service = new FavoritesService(repo as never, properties as never);
    await service.save(21, 7);
    expect(repo.add).toHaveBeenCalledWith(21, 7);
  });

  it('viewing a property needs no separate counter: total views and the day count commit together in the repository', async () => {
    const repo = {
      findApprovedById: vi.fn(async () => ({
        p: {
          id: 7,
          category: 'sale',
          type: 'apartment',
          titleAr: 'شقة',
          titleEn: 'Flat',
          compoundAr: null,
          compoundEn: null,
          price: 1_000_000,
          oldPrice: null,
          beds: 3,
          baths: 2,
          sizeM2: 120,
          finishing: 'full',
          deliveryYear: null,
          planDownPct: null,
          planYears: null,
          featured: false,
          publishedAt: new Date('2026-11-01T10:00:00.000Z'),
          createdAt: new Date('2026-11-01T10:00:00.000Z'),
          views: 9,
          developerAr: null,
          developerEn: null,
          floor: null,
          maintenanceFee: null,
          descAr: null,
          descEn: null,
          location: null,
        },
        area: { nameAr: 'التجمع', nameEn: 'New Cairo' },
        agent: {
          userId: 3,
          nameAr: 'عمر',
          nameEn: 'Omar',
          roleTitleAr: null,
          roleTitleEn: null,
          rating: 5,
          dealsCount: 0,
          years: 2,
          languagesAr: 'العربية',
          languagesEn: 'English',
          avgReplyMins: 5,
          phone: '+201001234567',
          colour: '#b38959',
        },
      })),
      findImages: vi.fn(async () => []),
      findFeatures: vi.fn(async () => []),
      findTourRooms: vi.fn(async () => []),
      findVideos: vi.fn(async () => []),
      addView: vi.fn(async () => {}),
    };
    const service = new PropertiesService(repo as never, {} as never);
    await service.detail(7);
    expect(repo.addView).toHaveBeenCalledWith(7);
  });
});
