import { apiFetch, setAuthHandlers } from '@/core/api/api';

const fetchMock = jest.fn();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const authHeader = (call: number) => new Headers((fetchMock.mock.calls[call][1] as RequestInit).headers).get('Authorization');

let token: string | null;
const refresh = jest.fn<Promise<boolean>, []>();
const onAuthFailure = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  refresh.mockReset();
  onAuthFailure.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  token = 'old-token';
  setAuthHandlers({ getAccessToken: () => token, refresh, onAuthFailure });
});

describe('apiFetch with a session', () => {
  it('sends the access token', async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await apiFetch('/me');
    expect(authHeader(0)).toBe('Bearer old-token');
  });

  it('on a 401 refreshes once, then retries with the new token', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { statusCode: 401, message: 'Unauthorized' })).mockResolvedValue(json(200, { ok: 1 }));
    refresh.mockImplementation(async () => {
      token = 'new-token';
      return true;
    });

    await expect(apiFetch('/me')).resolves.toEqual({ ok: 1 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(authHeader(1)).toBe('Bearer new-token');
  });

  it('shares one refresh between requests that fail together', async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(401, {}))
      .mockImplementation(async () => json(200, {}));
    refresh.mockImplementation(async () => {
      token = 'new-token';
      return true;
    });
    await Promise.all([apiFetch('/a'), apiFetch('/b')]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a late 401 for a token that was already replaced retries without a second refresh', async () => {
    // The request went out with the old token; another request refreshed meanwhile.
    fetchMock
      .mockImplementationOnce(async () => {
        token = 'new-token';
        return json(401, {});
      })
      .mockImplementation(async () => json(200, {}));
    await apiFetch('/me');
    expect(refresh).not.toHaveBeenCalled();
    expect(authHeader(1)).toBe('Bearer new-token');
  });

  it('signs out when the refresh fails', async () => {
    fetchMock.mockImplementation(async () => json(401, { statusCode: 401, message: 'Unauthorized' }));
    refresh.mockResolvedValue(false);
    await expect(apiFetch('/me')).rejects.toMatchObject({ status: 401 });
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });
});
