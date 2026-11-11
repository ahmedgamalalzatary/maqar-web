import { ConflictException } from '@nestjs/common';
import { vi } from 'vitest';
import { ViewingsService } from '../../../../src/modules/viewings/viewings.service.js';
import type { ViewingRow } from '../../../../src/modules/viewings/viewings.schema.js';

const row = (over: Partial<ViewingRow> = {}): ViewingRow =>
  ({
    id: 9,
    propertyId: 7,
    clientId: 21,
    agentId: 3,
    startsAt: new Date(Date.now() + 86_400_000),
    status: 'confirmed',
    mode: 'visit',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as unknown as ViewingRow;

const user = { id: 21, role: 'client' } as never;

describe('viewing transitions', () => {
  it('refuses a cancellation that lost a race with another change', async () => {
    const repo = {
      findById: vi.fn(async () => row()),
      cancel: vi.fn(async () => 0),
    };
    const service = new ViewingsService(repo as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.update(user, 9, { action: 'cancel' } as never)).rejects.toMatchObject({ status: 409 });
  });

  it('refuses a reschedule that lost a race with a cancellation', async () => {
    const repo = {
      findById: vi.fn(async () => row()),
      // An agent bookable at any hour, so the chosen day/hour is always free.
      schedule: vi.fn(async () => ({ hours: new Map([0, 1, 2, 3, 4, 5, 6].map((d) => [d, { from: 0, to: 23 }])), daysOff: new Set<string>() })),
      takenTimes: vi.fn(async () => []),
      reschedule: vi.fn(async () => false),
    };
    const service = new ViewingsService(repo as never, {} as never, {} as never, {} as never, {} as never);
    const date = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    await expect(
      service.update(user, 9, { action: 'reschedule', date, time: '12:00' } as never),
    ).rejects.toMatchObject({ status: 409 });
    expect(repo.reschedule).toHaveBeenCalledTimes(1);
  });

  it('still refuses an already-inactive viewing with the same conflict', () => {
    expect(new ConflictException('This viewing is not active any more').getStatus()).toBe(409);
  });
});
