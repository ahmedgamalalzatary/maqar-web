import { connectChat, disconnectChat, setOpenThread } from '@/features/chat/socket';

type Listener = (...args: unknown[]) => void;
/** A stand-in for the socket.io client: records what is sent and fires events on demand. */
class FakeSocket {
  listeners: Record<string, Listener[]> = {};
  sent: [string, unknown][] = [];
  on(event: string, fn: Listener) {
    (this.listeners[event] ??= []).push(fn);
    return this;
  }
  emit(event: string, payload: unknown) {
    this.sent.push([event, payload]);
    return this;
  }
  fire(event: string, ...args: unknown[]) {
    for (const fn of this.listeners[event] ?? []) fn(...args);
  }
  removeAllListeners() {
    this.listeners = {};
    return this;
  }
  disconnect() {
    return this;
  }
  connect() {
    return this;
  }
}

let mockSocket: FakeSocket;
jest.mock('socket.io-client', () => ({ io: () => mockSocket }));

const handlers = () => ({ message: jest.fn(), read: jest.fn(), typing: jest.fn(), updated: jest.fn(), blocked: jest.fn(), reconnected: jest.fn() });

beforeEach(() => {
  mockSocket = new FakeSocket();
  setOpenThread(null);
});
afterEach(() => disconnectChat());

describe('Chat socket', () => {
  it('asks for missed messages after every reconnect, but not on the first connect', () => {
    const on = handlers();
    connectChat(on);
    mockSocket.fire('connect');
    expect(on.reconnected).not.toHaveBeenCalled();
    mockSocket.fire('connect');
    mockSocket.fire('connect');
    expect(on.reconnected).toHaveBeenCalledTimes(2);
  });

  it('tells the server again which conversation is open when it reconnects', () => {
    connectChat(handlers());
    setOpenThread(7);
    mockSocket.sent = [];
    mockSocket.fire('connect');
    expect(mockSocket.sent).toEqual([['open', { threadId: 7 }]]);
  });
});
