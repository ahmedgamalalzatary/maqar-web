import { vi } from 'vitest';
import { ListingsService } from '../../../../src/modules/listings/listings.service.js';

const cur = {
  id: 7,
  price: 1_000_000,
  area: { id: 'nc', nameAr: 'التجمع', nameEn: 'New Cairo' },
  type: 'apartment',
  beds: 3,
  agent: { id: 3 },
  status: 'approved',
  createdAt: new Date('2026-11-01T10:00:00.000Z'),
  publishedAt: new Date('2026-11-01T10:00:00.000Z'),
  ownerName: 'م',
  ownerPhone: null,
  oldPrice: null,
  featured: false,
  compoundAr: null,
  compoundEn: null,
  sizeM2: 120,
  baths: 2,
  finishing: 'full',
  deliveryYear: null,
  planDownPct: null,
  planYears: null,
  titleAr: 'شقة',
  titleEn: 'Flat',
};

const deps = (over: Record<string, unknown> = {}) => {
  const repo = {
    find: vi.fn(async () => ({ p: cur, area: cur.area, agent: cur.agent })),
    update: vi.fn(
      (over.update as (() => unknown) | undefined) ??
        (async (...args: unknown[]) =>
          args[4] && !(args[4] as { reset?: boolean }).reset
            ? { was: 1_000_000, price: 900_000, oldPrice: null, dropped: true, dropPct: 10, status: 'approved', titleAr: 'شقة', titleEn: 'Flat', changed: true }
            : undefined),
    ),
    isActiveAgent: vi.fn(async () => true),
    move: vi.fn(async () => true),
    agentOptions: vi.fn(async () => [{ id: 3 }]),
    images: vi.fn(async () => new Map()),
    imagesUsedElsewhere: vi.fn(async () => new Set<string>()),
    withTour: vi.fn(async () => new Set()),
    features: vi.fn(async () => []),
    ...Object.fromEntries(Object.entries(over).filter(([k]) => k !== 'update')),
  };
  const prices = { changePrice: vi.fn(async () => ({})), announce: vi.fn(async () => undefined) };
  const uploads = { assertListingFiles: vi.fn(async () => undefined), removeListingFiles: vi.fn(async () => undefined) };
  const service = new ListingsService(repo as never, prices as never, uploads as never);
  return { service, repo, prices, uploads };
};

describe('editing a listing with a price change', () => {
  it('refuses photos that are not on the server, and saves nothing', async () => {
    const { service, repo, uploads } = deps({ images: vi.fn(async () => new Map([[7, ['/uploads/listings/old.jpg']]])) });
    uploads.assertListingFiles.mockRejectedValueOnce(new Error('missing'));
    await expect(service.update(7, { images: ['/uploads/listings/new.jpg'] } as never, 1)).rejects.toBeTruthy();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('collects the photos the edit removed, but only ones no other listing shows', async () => {
    const { service, repo, uploads } = deps({
      images: vi.fn(async () => new Map([[7, ['/uploads/listings/old.jpg', '/uploads/listings/shared.jpg']]])),
    });
    repo.imagesUsedElsewhere = vi.fn(async () => new Set(['/uploads/listings/shared.jpg']));
    await service.update(7, { images: ['/uploads/listings/new.jpg'] } as never, 1);
    expect(repo.imagesUsedElsewhere).toHaveBeenCalledWith(['/uploads/listings/old.jpg', '/uploads/listings/shared.jpg'], 7);
    expect(uploads.removeListingFiles).toHaveBeenCalledWith(['/uploads/listings/old.jpg']);
  });

  it('commits the fields and the price in one repository transaction', async () => {
    const { service, repo, prices } = deps();
    await service.update(7, { price: 900_000, titleAr: 'شقة جديدة' } as never, 1);
    expect(repo.update).toHaveBeenCalledTimes(1);
    const args = repo.update.mock.calls[0] as unknown[];
    expect(args[4]).toMatchObject({ next: 900_000 });
    expect(prices.changePrice).not.toHaveBeenCalled();
  });

  it('announces a drop to followers only after the whole edit committed', async () => {
    const change = { was: 1_000_000, price: 900_000, oldPrice: null, dropped: true, dropPct: 10, status: 'approved', titleAr: 'شقة', titleEn: 'Flat', changed: true };
    const { service, prices } = deps({ update: vi.fn(async () => change) });
    await service.update(7, { price: 900_000 } as never, 1);
    expect(prices.announce).toHaveBeenCalledWith(7, change);
  });

  it("does not announce anything when the edit failed", async () => {
    const { service, prices } = deps({ update: vi.fn(async () => { throw new Error('db down'); }) });
    await expect(service.update(7, { price: 900_000 } as never, 1)).rejects.toThrow('db down');
    expect(prices.announce).not.toHaveBeenCalled();
  });

  it('sends no price change when the price did not change', async () => {
    const { service, repo, prices } = deps();
    await service.update(7, { titleAr: 'شقة جديدة' } as never, 1);
    expect((repo.update.mock.calls[0] as unknown[])[4]).toBeUndefined();
    expect(prices.announce).not.toHaveBeenCalled();
  });

  it('resets the price instead of computing a drop when the category changes in the same edit', async () => {
    const { service, prices } = deps();
    await service.update(7, { category: 'rent', price: 5_000 } as never, 1);
    const args = (service as never as { repo: { update: { mock: { calls: unknown[][] } } } }).repo.update.mock.calls[0] as unknown[];
    expect(args[4]).toMatchObject({ next: 5_000, reset: true });
    expect(prices.announce).not.toHaveBeenCalled();
  });

  it('refuses an installment plan on a listing that is not for sale or a project', async () => {
    const { service } = deps();
    await expect(service.update(7, { category: 'rent', plan: { downPct: 20, years: 5 } } as never, 1)).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a publish that lost a race with another status change', async () => {
    const { service } = deps({ move: vi.fn(async () => false) });
    await expect(service.publish(7, 3)).rejects.toMatchObject({ status: 409 });
  });

  it('writes a publish with the expected source statuses, so a concurrent change cannot be overwritten', async () => {
    cur.status = 'unpublished';
    const { service } = deps();
    await service.publish(7, 3);
    const args = (service as never as { repo: { move: { mock: { calls: unknown[][] } } } }).repo.move.mock.calls[0] as unknown[];
    expect(args[1]).toEqual(expect.anything()); // source statuses
    expect((args[2] as { status: string }).status).toBe('approved');
    cur.status = 'approved';
  });
});
