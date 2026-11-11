import { vi } from 'vitest';
import { NotificationsService } from '../../../../src/modules/notifications/notifications.service.js';

const make = (repo: Record<string, unknown>, users: Record<string, unknown> = { findActiveById: async () => ({ id: 1, lang: 'ar', pushEnabled: true }) }) =>
  new NotificationsService(repo as never, users as never, { send: async () => [] } as never);

describe('NotificationsService.notify', () => {
  it('never fails the callers committed action when the inbox write fails', async () => {
    const repo = { create: vi.fn(async () => { throw new Error('inbox down'); }), tokens: vi.fn(async () => []) };
    await expect(make(repo).notify(1, { kind: 'system', titleAr: 'ت', titleEn: 't', bodyAr: 'ب', bodyEn: 'b' })).resolves.toBeNull();
  });

  it('never fails the callers committed action when looking the account up fails', async () => {
    const users = { findActiveById: async () => { throw new Error('db down'); } };
    await expect(make({}, users).notify(1, { kind: 'system', titleAr: 'ت', titleEn: 't', bodyAr: 'ب', bodyEn: 'b' })).resolves.toBeNull();
  });
});

