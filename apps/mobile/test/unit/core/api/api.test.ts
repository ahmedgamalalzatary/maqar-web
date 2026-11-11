import { ApiError, REQUEST_TIMEOUT_MS, apiFetch, apiBaseUrl } from '@/core/api/api';

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
    expect(fetchMock.mock.calls[0][0]).toBe(`${apiBaseUrl()}/health`);
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

  describe('request deadline', () => {
    /** A fetch that answers nothing until its signal is aborted, like a stalled connection. */
    const stalled = () =>
      fetchMock.mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')))),
      );

    it('rejects a request that never resolves, instead of hanging forever', async () => {
      jest.useFakeTimers();
      try {
        stalled();
        const pending = apiFetch('/health', { timeoutMs: 1000 });
        const settled = expect(pending).rejects.toMatchObject({ name: 'ApiError', status: 0, message: 'Request timed out' });
        await jest.advanceTimersByTimeAsync(1001);
        await settled;
      } finally {
        jest.useRealTimers();
      }
    });

    it('bounds every request by default, and lets one that answers in time through', async () => {
      expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } }));
      await expect(apiFetch('/health')).resolves.toEqual({ ok: true });
      const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('still honours a caller abort signal', async () => {
      stalled();
      const caller = new AbortController();
      const pending = apiFetch('/health', { timeoutMs: REQUEST_TIMEOUT_MS * 2, signal: caller.signal });
      caller.abort();
      await expect(pending).rejects.toMatchObject({ name: 'ApiError', status: 0 });
    });
  });
});
