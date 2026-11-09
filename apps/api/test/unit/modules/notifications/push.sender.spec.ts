import { ExpoPushSender, type PushMessage } from '../../../../src/modules/notifications/push.sender.js';

const msg = (to: string): PushMessage => ({ to, title: 'T', body: 'B', data: { id: 1, href: '/' }, badge: 1 });
const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('ExpoPushSender', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the messages to Expo with the sound, channel and access token', async () => {
    const fetch = reply(200, { data: [{ status: 'ok', id: 'a' }] });
    vi.stubGlobal('fetch', fetch);
    expect(await new ExpoPushSender('secret').send([msg('t1')])).toEqual(['sent']);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://exp.host/--/api/v2/push/send');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret');
    expect(JSON.parse(init.body as string)).toEqual([
      { ...msg('t1'), sound: 'default', channelId: 'default', priority: 'high' },
    ]);
  });

  it('sends no Authorization header without an access token', async () => {
    const fetch = reply(200, { data: [{ status: 'ok', id: 'a' }] });
    vi.stubGlobal('fetch', fetch);
    await new ExpoPushSender().send([msg('t1')]);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('marks a dropped token as gone and any other error as failed', async () => {
    vi.stubGlobal(
      'fetch',
      reply(200, {
        data: [
          { status: 'ok', id: 'a' },
          { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
          { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
        ],
      }),
    );
    expect(await new ExpoPushSender().send([msg('a'), msg('b'), msg('c')])).toEqual(['sent', 'gone', 'failed']);
  });

  it('fails every message when Expo errors or cannot be reached, without throwing', async () => {
    vi.stubGlobal('fetch', reply(500, { errors: [{ message: 'down' }] }));
    expect(await new ExpoPushSender().send([msg('a'), msg('b')])).toEqual(['failed', 'failed']);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    expect(await new ExpoPushSender().send([msg('a')])).toEqual(['failed']);
  });

  it('sends at most 100 messages per request', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const n = (JSON.parse(init.body as string) as unknown[]).length;
      return new Response(JSON.stringify({ data: Array.from({ length: n }, () => ({ status: 'ok', id: 'x' })) }));
    });
    vi.stubGlobal('fetch', fetch);
    const out = await new ExpoPushSender().send(Array.from({ length: 230 }, (_, k) => msg(`t${k}`)));
    expect(out).toHaveLength(230);
    expect(fetch.mock.calls.map(([, init]) => (JSON.parse(init.body as string) as unknown[]).length)).toEqual([100, 100, 30]);
  });
});
