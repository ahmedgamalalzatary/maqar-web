import type { AuthResponse, Me } from '@maqar/shared';

/** Replaces global fetch with a mock. Returns it so tests can queue responses and read calls. */
export function mockFetch() {
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export const jsonResponse = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** The request a fetch mock received: method, path after /v1, and parsed JSON body. */
export function requestOf(fetchMock: jest.Mock, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return {
    method: init.method,
    path: url.replace(/^.*\/v1/, ''),
    body: init.body ? JSON.parse(init.body as string) : undefined,
  };
}

export function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: 1,
    role: 'client',
    name: 'Mona Adel',
    email: 'mona@test.maqar',
    phone: null,
    lang: 'ar',
    theme: 'system',
    pushEnabled: true,
    createdAt: '2026-11-08T10:00:00.000Z',
    ...overrides,
  };
}

export function makeAuth(user: Partial<Me> = {}): AuthResponse {
  return { user: makeMe(user), accessToken: 'access', refreshToken: 'refresh-token-1234567890', expiresIn: 900 };
}
