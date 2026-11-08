import { resolveApiUrl } from '@/core/api/api-url';

describe('resolveApiUrl', () => {
  it('keeps a real host as it is', () => {
    expect(resolveApiUrl('https://api.maqar.app/v1', '192.168.1.5:8081')).toBe('https://api.maqar.app/v1');
  });

  it('points localhost at the dev machine, so a phone or emulator can reach the API', () => {
    expect(resolveApiUrl('http://localhost:4000/v1', '192.168.1.5:8081')).toBe('http://192.168.1.5:4000/v1');
  });

  it('fails loudly when no URL is configured', () => {
    expect(() => resolveApiUrl(undefined, undefined)).toThrow(/EXPO_PUBLIC_API_URL/);
  });
});
