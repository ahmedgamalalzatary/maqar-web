import { ConflictException } from '@nestjs/common';
import { vi } from 'vitest';
import { AgentsService } from '../../../../src/modules/agents/agents.service.js';

const row = { userId: 3, active: true, live: 0, email: 'a@x.co', nameAr: 'عمر', nameEn: 'Omar' };

const make = (over: Record<string, unknown> = {}) => {
  const repo = {
    find: vi.fn(async () => row),
    emailTaken: vi.fn(async () => false),
    update: vi.fn(async () => undefined),
    endSessions: vi.fn(async () => undefined),
    touchCredentials: vi.fn(async () => undefined),
    countExisting: vi.fn(async (ids: number[]) => ids.length),
    hours: vi.fn(async () => []),
    daysOffFrom: vi.fn(async () => []),
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
    expect(repo.endSessions).toHaveBeenCalledWith(3);
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

describe('editing an agent whose email did not change', () => {
  it('keeps their sessions when the email field is sent unchanged', async () => {
    const { service, repo } = make();
    await service.update(3, { email: 'a@x.co', colour: '#61766d' } as never);
    expect(repo.endSessions).not.toHaveBeenCalled();
    expect(repo.touchCredentials).not.toHaveBeenCalled();
  });

  it('ends their sessions when the address actually changes', async () => {
    const { service, repo } = make();
    await service.update(3, { email: 'b@x.co', colour: '#61766d' } as never);
    expect(repo.endSessions).toHaveBeenCalledTimes(1);
    expect(repo.touchCredentials).toHaveBeenCalledTimes(1);
  });

  it('ends their sessions on a password change or deactivation, as before', async () => {
    const { service, repo } = make({ upcomingWork: vi.fn(async () => ({ viewings: 0, threads: 0, leads: 0 })) });
    await service.update(3, { password: 'New-Password-1' } as never);
    expect(repo.endSessions).toHaveBeenCalledTimes(1);
    await service.update(3, { active: false } as never);
    expect(repo.endSessions).toHaveBeenCalledTimes(2);
  });
});
