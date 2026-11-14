import { BadRequestException, ConflictException } from '@nestjs/common';
import { vi } from 'vitest';
import { AgentStateError } from '../../../../src/modules/agents/agents.repository.js';
import { AgentsService } from '../../../../src/modules/agents/agents.service.js';

const row = { userId: 3, active: true, live: 0, email: 'a@x.co', nameAr: 'عمر', nameEn: 'Omar' };

/** The options of the last repo.update call: what that edit does besides the fields. */
const opts = (repo: { update: { mock: { calls: unknown[][] } } }) => repo.update.mock.calls.at(-1)?.[3];

const make = (over: Record<string, unknown> = {}) => {
  const repo = {
    find: vi.fn(async () => row),
    emailTaken: vi.fn(async () => false),
    create: vi.fn(async () => 3),
    countListings: vi.fn(async (ids: number[]) => ids.length),
    update: vi.fn(async () => undefined),
    countExisting: vi.fn(async (ids: number[]) => ids.length),
    hours: vi.fn(async () => []),
    daysOffFrom: vi.fn(async () => []),
    listingIds: vi.fn(async () => []),
    upcomingWork: vi.fn(async () => ({ viewings: 2, threads: 1, leads: 3 })),
    reassign: vi.fn(async () => ({ viewings: 2, threads: 1, leads: 3 })),
    ...over,
  };
  const service = new AgentsService(repo as never);
  return { service, repo };
};

describe('deactivating an agent with open work', () => {
  it('is blocked with the counts until the work moves', async () => {
    const { service, repo } = make();
    await expect(service.update(3, { active: false } as never)).rejects.toMatchObject({ status: 409 });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('moves the upcoming viewings, open chats and open leads, then deactivates', async () => {
    const { service, repo } = make();
    await service.update(3, { active: false, reassignTo: 5 } as never);
    expect(repo.reassign).toHaveBeenCalledWith(3, 5);
    expect(repo.update).toHaveBeenCalled();
    expect(opts(repo)).toMatchObject({ endSessions: true });
  });

  it('refuses to reassign to the same agent or an unknown one', async () => {
    const { service } = make({ find: vi.fn(async () => row) });
    await expect(service.update(3, { active: false, reassignTo: 3 } as never)).rejects.toMatchObject({ status: 400 });
  });

  it('deactivates freely when there is nothing to move', async () => {
    const { service, repo } = make({ upcomingWork: vi.fn(async () => ({ viewings: 0, threads: 0, leads: 0 })) });
    await service.update(3, { active: false } as never);
    expect(repo.reassign).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalled();
  });

  it('moves the work on request, without deactivating anyone', async () => {
    const { service, repo } = make({ find: vi.fn(async (id: number) => ({ ...row, userId: id, active: true })) });
    const moved = await service.reassign(3, 5);
    expect(repo.reassign).toHaveBeenCalledWith(3, 5);
    expect(moved).toMatchObject({ viewings: 2 });
  });

  it('still blocks deactivation while the agent has live listings', async () => {
    const { service } = make({ find: vi.fn(async () => ({ ...row, live: 1 })) });
    await expect(service.update(3, { active: false, reassignTo: 5 } as never)).rejects.toBeInstanceOf(ConflictException);
  });
});

// Phase 29 review: the listings, the account change and the sign-out are one repository call
// (one transaction), and the repository's locked recheck becomes the matching HTTP answer.
describe('giving listings from the agent form', () => {
  it('creates the agent and gives the listings in one repository call', async () => {
    const { service, repo } = make();
    await service.create({ email: 'n@x.co', password: 'Pass-word-1', nameAr: 'ن', nameEn: 'N', phone: '+201000000001', listingIds: [7, 8] } as never);
    expect(repo.create).toHaveBeenCalledWith(expect.anything(), expect.anything(), [7, 8]);
  });

  it('sends the listings and the sign-out with the account change, in one repository call', async () => {
    const { service, repo } = make();
    await service.update(3, { password: 'New-Password-1', listingIds: [7] } as never);
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith(3, expect.objectContaining({ passwordHash: expect.any(String) }), expect.anything(), {
      listingIds: [7],
      endSessions: true,
      touchCredentials: true,
    });
  });

  it('answers 409 when the agent got a live listing while being turned off', async () => {
    const { service } = make({
      upcomingWork: vi.fn(async () => ({ viewings: 0, threads: 0, leads: 0 })),
      update: vi.fn(async () => {
        throw new AgentStateError('live');
      }),
    });
    await expect(service.update(3, { active: false } as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('answers 400 when the agent was turned off before the listings arrived', async () => {
    const { service } = make({
      update: vi.fn(async () => {
        throw new AgentStateError('inactive');
      }),
    });
    await expect(service.update(3, { listingIds: [7] } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('editing an agent whose email did not change', () => {
  it('keeps their sessions when the email field is sent unchanged', async () => {
    const { service, repo } = make();
    await service.update(3, { email: 'a@x.co', colour: '#61766d' } as never);
    expect(opts(repo)).toMatchObject({ endSessions: false, touchCredentials: false });
  });

  it('ends their sessions when the address actually changes', async () => {
    const { service, repo } = make();
    await service.update(3, { email: 'b@x.co', colour: '#61766d' } as never);
    expect(opts(repo)).toMatchObject({ endSessions: true, touchCredentials: true });
  });

  it('ends their sessions on a password change or deactivation, as before', async () => {
    const { service, repo } = make({ upcomingWork: vi.fn(async () => ({ viewings: 0, threads: 0, leads: 0 })) });
    await service.update(3, { password: 'New-Password-1' } as never);
    expect(opts(repo)).toMatchObject({ endSessions: true, touchCredentials: true });
    await service.update(3, { active: false } as never);
    expect(opts(repo)).toMatchObject({ endSessions: true, touchCredentials: false });
  });
});
