import { ApiError, apiFetch } from '@/core/api/api';

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('apiFetch', () => {
  it('calls the API base URL from .env.test and returns the JSON body', async () => {
    fetchMock.mockResolvedValue(json(200, { status: 'ok' }));
    await expect(apiFetch('/health')).resolves.toEqual({ status: 'ok' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4001/v1/health');
  });

  it('throws an ApiError with the status and the server message', async () => {
    fetchMock.mockResolvedValue(json(409, { statusCode: 409, message: 'Email already used', error: 'Conflict' }));
    const err = await apiFetch('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, message: 'Email already used' });
  });

  it('keeps the status when an error page is not JSON (a proxy 502)', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }));
    await expect(apiFetch('/x')).rejects.toMatchObject({ name: 'ApiError', status: 502 });
  });

  it('turns a network failure into an ApiError with status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 0 });
  });
});
