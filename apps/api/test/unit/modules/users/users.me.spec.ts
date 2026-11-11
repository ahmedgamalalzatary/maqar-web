import { vi } from 'vitest';
import { UsersService } from '../../../../src/modules/users/users.service.js';

const user = { id: 5, role: 'agent', name: 'Omar', email: 'o@x.co', phone: '+201000000000', createdAt: new Date('2026-01-01T00:00:00.000Z'), theme: 'system', pushEnabled: false };

const deps = (agent = { userId: 5, nameAr: 'Omar', nameEn: 'Omar', phone: '+201000000000' }) => {
  const repo = {
    findActiveById: vi.fn(async () => user),
    update: vi.fn(async () => undefined),
    findAgentProfile: vi.fn(async () => agent),
    syncAgentProfile: vi.fn(async () => undefined),
    findPrefs: vi.fn(async () => undefined),
    countAreas: vi.fn(async () => 0),
  };
  const service = new UsersService(repo as never, { get: vi.fn(() => 'uploads') } as never);
  return { service, repo };
};

describe('a staff member editing their own profile', () => {
  it('reaches their public advisor profile, not just the account', async () => {
    const { service, repo } = deps();
    await service.updateMe(5, { phone: '+201111111111' });
    expect(repo.syncAgentProfile).toHaveBeenCalledWith(5, { phone: '+201111111111' }, 'Omar');
  });

  it('carries a new name too, so the advisor card follows the account', async () => {
    const { service, repo } = deps();
    await service.updateMe(5, { name: 'Omar Adel' });
    expect(repo.syncAgentProfile).toHaveBeenCalledWith(5, { name: 'Omar Adel' }, 'Omar');
  });
});
