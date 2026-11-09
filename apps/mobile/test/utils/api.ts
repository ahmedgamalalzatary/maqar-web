import type { AreaItem, AuthResponse, Me, Page, PropertyCard } from '@maqar/shared';

/**
 * A fetch mock that answers by path (after /v1, without the query). A handler gets the
 * query string's values and returns the JSON body. Unknown paths answer 404.
 */
export function routeFetch(routes: Record<string, (query: URLSearchParams) => unknown>) {
  const fetchMock = mockFetch().mockImplementation(async (url: string) => {
    const [path, qs] = url.replace(/^.*\/v1/, '').split('?');
    const handler = routes[path];
    return handler ? jsonResponse(200, handler(new URLSearchParams(qs))) : jsonResponse(404, { statusCode: 404, message: 'Not found' });
  });
  return fetchMock;
}

/** The query of the fetch mock's nth call, e.g. `{ category: 'rent', page: '1' }`. */
export function queryOf(fetchMock: jest.Mock, call = 0): Record<string, string> {
  const [url] = fetchMock.mock.calls[call] as [string];
  return Object.fromEntries(new URLSearchParams(url.split('?')[1]));
}

export function makeCard(overrides: Partial<PropertyCard> = {}): PropertyCard {
  return {
    id: 1,
    category: 'sale',
    type: 'villa',
    titleAr: 'فيلا مستقلة بحمام سباحة خاص',
    titleEn: 'Standalone villa with private pool',
    area: { id: 'new-cairo', nameAr: 'التجمع الخامس', nameEn: 'New Cairo' },
    compoundAr: 'سيدار هيلز',
    compoundEn: 'Cedar Hills',
    price: 24_500_000,
    oldPrice: null,
    beds: 5,
    baths: 5,
    sizeM2: 420,
    finishing: 'full',
    delivery: 'ready',
    plan: null,
    cover: '/uploads/seed/p1.jpg',
    publishedAt: '2026-11-08T10:00:00.000Z',
    ...overrides,
  };
}

export const page = <T>(items: T[], over: Partial<Page<T>> = {}): Page<T> => ({
  items,
  page: 1,
  limit: 20,
  total: items.length,
  ...over,
});

export const AREAS: AreaItem[] = [
  { id: 'new-cairo', nameAr: 'التجمع الخامس', nameEn: 'New Cairo', cityAr: 'القاهرة', cityEn: 'Cairo', image: '/uploads/seed/p26.jpg' },
  { id: 'zayed', nameAr: 'الشيخ زايد', nameEn: 'Sheikh Zayed', cityAr: 'الجيزة', cityEn: 'Giza', image: '/uploads/seed/p2.jpg' },
];

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
