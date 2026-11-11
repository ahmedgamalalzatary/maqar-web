import { ChatGateway } from '../../../../src/modules/chat/chat.gateway.js';
import { ChatRealtime } from '../../../../src/modules/chat/chat.realtime.js';
import type { Socket } from 'socket.io';

type FakeSocket = {
  id: string;
  data: { user?: unknown; token?: string };
  handshake: { auth: { token?: string } };
  emit: (event: string, payload?: unknown) => void;
  disconnect: (close: boolean) => void;
  join: (room: string) => Promise<void>;
  emitted: [string, unknown][];
  disconnected: boolean;
};

const socket = (token?: string): FakeSocket & Socket => {
  const s: FakeSocket = {
    id: 's1',
    data: { token },
    handshake: { auth: { token } },
    emit: (event, payload) => s.emitted.push([event, payload]),
    disconnect: (close) => {
      s.disconnected = close;
    },
    join: async () => undefined,
    emitted: [],
    disconnected: false,
  };
  return s as unknown as FakeSocket & Socket;
};

const threadOf = (id: number, clientId = 21, agentId = 3) => ({ id, clientId, agentId });

describe('ChatGateway socket revalidation', () => {
  it('connects with a valid token and joins the user room', async () => {
    const tokens = { userOf: async () => ({ id: 21, role: 'client' as const }) };
    const gateway = new ChatGateway(tokens as never, new ChatRealtime(), {} as never);
    const s = socket('good');
    await gateway.handleConnection(s);
    expect(s.data.user).toMatchObject({ id: 21, side: 'client' });
    expect(s.disconnected).toBe(false);
  });

  it('stops an open event from a socket whose token was revoked since connecting', async () => {
    const userOf = vi.fn<(token?: string) => Promise<{ id: number; role: string } | undefined>>()
      .mockResolvedValueOnce({ id: 21, role: 'client' })
      .mockResolvedValue(undefined);
    const tokens = { userOf };
    const realtime = new ChatRealtime();
    const repo = { findThread: async () => threadOf(5) };
    const gateway = new ChatGateway(tokens as never, realtime, repo as never);
    const s = socket('revoked');
    await gateway.handleConnection(s);

    await gateway.open(s as never, { threadId: 5 });
    expect(s.disconnected).toBe(true);
    expect(s.emitted.some(([e]) => e === 'denied')).toBe(true);
    expect(realtime.isOpen(21, 5)).toBe(false);
  });

  it('drops a connected socket whose account was deactivated or whose token expired on the sweep', async () => {
    const userOf = vi.fn<(token?: string) => Promise<{ id: number; role: string } | undefined>>()
      .mockResolvedValueOnce({ id: 3, role: 'agent' })
      .mockResolvedValue(undefined);
    const gateway = new ChatGateway({ userOf } as never, new ChatRealtime(), {} as never);
    const s = socket('old');
    const server = { sockets: { sockets: new Map([[s.id, s]]) } } as never;
    gateway.afterInit(server);
    await gateway.handleConnection(s);

    await gateway.sweep();
    expect(s.disconnected).toBe(true);
    expect(userOf).toHaveBeenLastCalledWith('old');
  });

  it('keeps valid sockets on the sweep', async () => {
    const tokens = { userOf: async () => ({ id: 21, role: 'client' as const }) };
    const gateway = new ChatGateway(tokens as never, new ChatRealtime(), {} as never);
    const s = socket('good');
    gateway.afterInit({ sockets: { sockets: new Map([[s.id, s]]) } } as never);
    await gateway.handleConnection(s);

    await gateway.sweep();
    expect(s.disconnected).toBe(false);
  });
});
