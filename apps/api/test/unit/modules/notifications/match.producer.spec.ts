import { vi } from 'vitest';
import { GOOD_MATCH } from '@maqar/shared';
import { NotificationsService } from '../../../../src/modules/notifications/notifications.service.js';

const listing = {
  id: 7,
  category: 'sale' as const,
  type: 'apartment' as const,
  price: 5_000_000,
  area: { id: 'a1', nameAr: 'التجمع', nameEn: 'New Cairo' },
  beds: 3,
  features: [],
  plan: false,
  tour: false,
  titleAr: 'شقة في التجمع',
  titleEn: 'Apartment in New Cairo',
};

/** Scores 98: right purpose, within budget, right area, right type, enough beds. */
const matchPrefs = { purpose: ['sale'], budgetMax: 8_000_000, areas: ['a1'], types: ['apartment'], beds: 3, interests: [] };
/** Scores 40: wrong purpose and over budget, so the area alone must not qualify. */
const offPrefs = { purpose: ['rent'], budgetMax: 100_000, areas: ['a1'], types: [], beds: 0, interests: [] };

const service = (users: Record<string, unknown>, repo: Record<string, unknown>) =>
  new NotificationsService(
    repo as never,
    { findActiveById: async () => ({ id: 1, lang: 'ar', pushEnabled: false }), ...users } as never,
    { send: async () => [] } as never,
  );

const row = (id: number) => ({ id, titleAr: 'ت', titleEn: 't', bodyAr: 'ب', bodyEn: 'b', href: '/property/7', kind: 'match', userId: 1, readAt: null, createdAt: new Date() });

describe('NotificationsService.notifyMatches (a published listing tells matching clients)', () => {
  it('notifies only clients whose saved prefs score GOOD_MATCH or more', async () => {
    const repo = { create: vi.fn(async () => row(1)), notifiedUsers: vi.fn(async () => new Set<number>()), tokens: vi.fn(async () => []) };
    const users = { clientsWithPrefs: async () => [{ userId: 1, prefs: matchPrefs }, { userId: 2, prefs: offPrefs }] };
    const sent = await service(users, repo).notifyMatches(listing);
    expect(sent).toBe(1);
    expect((repo.create as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toMatchObject({ userId: 1, kind: 'match', href: '/property/7' });
  });

  it('skips a client who already has a match notification for this listing', async () => {
    const repo = { create: vi.fn(async () => row(1)), notifiedUsers: vi.fn(async () => new Set<number>([1])), tokens: vi.fn(async () => []) };
    const users = { clientsWithPrefs: async () => [{ userId: 1, prefs: matchPrefs }] };
    await expect(service(users, repo).notifyMatches(listing)).resolves.toBe(0);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('notifies at most 200 clients per listing', async () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ userId: i + 1, prefs: matchPrefs }));
    const repo = { create: vi.fn(async () => row(1)), notifiedUsers: vi.fn(async () => new Set<number>()), tokens: vi.fn(async () => []) };
    const users = { clientsWithPrefs: async () => many };
    await expect(service(users, repo).notifyMatches(listing)).resolves.toBe(200);
    expect(repo.create).toHaveBeenCalledTimes(200);
  });

  it('never fails the caller (the publish) when reading clients fails', async () => {
    const users = { clientsWithPrefs: async () => { throw new Error('db down'); } };
    await expect(service(users, {}).notifyMatches(listing)).resolves.toBe(0);
  });

  it('marks nothing when no client has preferences yet', async () => {
    const repo = { create: vi.fn(), notifiedUsers: vi.fn() };
    const users = { clientsWithPrefs: async () => [] };
    await expect(service(users, repo).notifyMatches(listing)).resolves.toBe(0);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('keeps GOOD_MATCH as the bar', () => {
    expect(GOOD_MATCH).toBe(70);
  });
});
