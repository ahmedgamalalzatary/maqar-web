import { validateEnv } from '../../../../src/core/config/env.js';

describe('validateEnv', () => {
  it('refuses to start without a MySQL DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: 'postgres://x@y/z' })).toThrow(/DATABASE_URL/);
  });

  it('turns PORT into a number and splits CORS_ORIGINS', () => {
    const env = validateEnv({
      DATABASE_URL: 'mysql://u:p@localhost:3306/maqar',
      JWT_ACCESS_SECRET: 'x'.repeat(32),
      PORT: '4000',
      CORS_ORIGINS: 'https://a.com, https://b.com',
    });
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('keeps the uploads folder when UPLOADS_DIR is left empty in .env', () => {
    const base = { DATABASE_URL: 'mysql://u:p@localhost:3306/maqar', JWT_ACCESS_SECRET: 'x'.repeat(32) };
    // An empty value would resolve to the API folder itself and serve the source at /uploads.
    expect(validateEnv({ ...base, UPLOADS_DIR: '' }).UPLOADS_DIR).toBe('uploads');
    expect(validateEnv(base).UPLOADS_DIR).toBe('uploads');
    expect(validateEnv({ ...base, UPLOADS_DIR: '/srv/maqar/uploads' }).UPLOADS_DIR).toBe('/srv/maqar/uploads');
  });
});
