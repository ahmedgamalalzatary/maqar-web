import { validateEnv } from '../../../../src/core/config/env.js';

describe('validateEnv', () => {
  it('refuses to start without a MySQL DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: 'postgres://x@y/z' })).toThrow(/DATABASE_URL/);
  });

  it('turns PORT into a number and splits CORS_ORIGINS', () => {
    const env = validateEnv({
      DATABASE_URL: 'mysql://u:p@localhost:3306/maqar',
      PORT: '4010',
      CORS_ORIGINS: 'https://a.com, https://b.com',
    });
    expect(env.PORT).toBe(4010);
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });
});
