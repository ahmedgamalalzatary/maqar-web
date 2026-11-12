import { TokenUsers } from '../../../../src/modules/auth/token-users.js';
import { UsersRepository } from '../../../../src/modules/users/users.repository.js';
import type { UserRow } from '../../../../src/modules/users/users.schema.js';

const row = (credentialsChangedAt: Date | null): UserRow =>
  ({ id: 7, role: 'agent', credentialsChangedAt }) as unknown as UserRow;

const make = (user: UserRow | undefined, payload: unknown) =>
  new TokenUsers(
    { verifyAsync: async () => payload } as never,
    { findActiveById: async () => user } as unknown as UsersRepository,
  );

describe('TokenUsers', () => {
  it('accepts a token issued after the credentials last changed', async () => {
    const tokens = make(row(new Date('2026-01-01T00:00:00.000Z')), { sub: 7, iat: 1_800_000_000 });
    await expect(tokens.userOf('t')).resolves.toMatchObject({ id: 7, role: 'agent' });
  });

  it('rejects an access token issued before a password change, so a reset signs out every session', async () => {
    // credentialsChangedAt is 2026-01-01; iat 1767225600 = 2026-01-01T00:00:00Z minus one second.
    const tokens = make(row(new Date('2026-01-01T00:00:00.000Z')), { sub: 7, iat: 1_767_225_599 });
    await expect(tokens.userOf('t')).resolves.toBeUndefined();
  });

  it('accepts tokens for accounts whose credentials never changed', async () => {
    const tokens = make(row(null), { sub: 7, iat: 1_000_000 });
    await expect(tokens.userOf('t')).resolves.toMatchObject({ id: 7 });
  });

  it('rejects a token without an issue time once credentials have changed', async () => {
    const tokens = make(row(new Date('2026-01-01T00:00:00.000Z')), { sub: 7 });
    await expect(tokens.userOf('t')).resolves.toBeUndefined();
  });

  it('within the same second, a token issued before the change is refused and one issued after it is accepted', async () => {
    // The change at .500; tokens carry their issue time in milliseconds (`iatMs`) beside the whole-second `iat`.
    const at = new Date('2026-01-01T00:00:00.500Z');
    const before = make(row(at), { sub: 7, iat: 1_767_225_600, iatMs: at.getTime() - 300 });
    const after = make(row(at), { sub: 7, iat: 1_767_225_600, iatMs: at.getTime() + 300 });
    await expect(before.userOf('t')).resolves.toBeUndefined();
    await expect(after.userOf('t')).resolves.toMatchObject({ id: 7 });
  });

  it('a token without iatMs (issued before this rule) is refused if its second is not wholly after the change', async () => {
    const at = new Date('2026-01-01T00:00:00.500Z');
    await expect(make(row(at), { sub: 7, iat: 1_767_225_600 }).userOf('t')).resolves.toBeUndefined();
    await expect(make(row(at), { sub: 7, iat: 1_767_225_601 }).userOf('t')).resolves.toMatchObject({ id: 7 });
  });
});
