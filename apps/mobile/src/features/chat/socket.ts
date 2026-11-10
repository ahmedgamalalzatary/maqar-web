import type { ChatEvents } from '@maqar/shared';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { accessToken, apiBaseUrl, renewAccess } from '@/core/api/api';

/**
 * The chat socket (contract §8.12): one per signed-in session, at the API's `/v1/socket.io`, signed
 * in with the access token. Messages are sent over HTTP; the socket brings the other side's
 * messages, typing and read receipts.
 */
let socket: Socket | null = null;
/** The conversation on screen, told to the server again after a reconnect. */
let openThread: number | null = null;

type Handlers = { [E in keyof ChatEvents]: (payload: ChatEvents[E]) => void };

export function connectChat(on: Handlers): () => void {
  disconnectChat();
  // React Native's URL has no `origin`: the scheme and host of the API's base URL.
  const origin = /^https?:\/\/[^/]+/.exec(apiBaseUrl())?.[0] ?? apiBaseUrl();
  const s = io(origin, {
    path: '/v1/socket.io',
    // Read at every (re)connect, so a renewed token is used.
    auth: (cb) => cb({ token: accessToken() }),
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 10_000,
  });
  socket = s;
  s.on('connect', () => {
    if (openThread !== null) s.emit('open', { threadId: openThread });
  });
  // The token expired: renew it, then come back.
  s.on('denied', () => {
    void renewAccess().then((ok) => {
      if (ok && socket === s) s.connect();
    });
  });
  s.on('message', on.message);
  s.on('read', on.read);
  s.on('typing', on.typing);
  s.on('updated', on.updated);
  return () => {
    if (socket === s) disconnectChat();
  };
}

export function disconnectChat(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/** The conversation now on screen (null when it closes): its messages need no notification. */
export function setOpenThread(threadId: number | null): void {
  openThread = threadId;
  socket?.emit('open', { threadId });
}

let lastTyping = 0;
/** "typing…" for the other side, at most every 2 seconds. */
export function sendTyping(threadId: number): void {
  const now = Date.now();
  if (now - lastTyping < 2000) return;
  lastTyping = now;
  socket?.emit('typing', { threadId });
}

/** When the other side last typed, per conversation. Shown for 4 seconds. */
export const useTyping = create<Record<number, number>>(() => ({}));
export const TYPING_MS = 4000;

export function heardTyping(threadId: number): void {
  useTyping.setState({ [threadId]: Date.now() });
  setTimeout(() => {
    if (Date.now() - (useTyping.getState()[threadId] ?? 0) >= TYPING_MS) useTyping.setState({ [threadId]: 0 });
  }, TYPING_MS);
}

/** Stops the typing dots at once when the other side's message arrives. */
export function stoppedTyping(threadId: number): void {
  useTyping.setState({ [threadId]: 0 });
}
