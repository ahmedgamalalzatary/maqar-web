import { Logger } from '@nestjs/common';
import { type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TokenUsers } from '../auth/token-users.js';
import { ChatRealtime, userRoom } from './chat.realtime.js';
import { ChatRepository } from './chat.repository.js';

type Who = { id: number; side: 'client' | 'agent' };

/** How often connected sockets prove their token is still good. */
const SWEEP_MS = 60_000;

/**
 * The chat socket (contract §8.12, §14) at `/v1/socket.io`, so it goes through the same proxy as the
 * API. It signs in with the same access token as HTTP (`auth: { token }`); anyone else is
 * disconnected, and so is staff other than agents. Messages are sent over HTTP; the socket brings
 * them (and typing and read receipts) to the other side at once. The token is re-checked on every
 * event and by a periodic sweep, so an expired, revoked or deactivated session loses the socket
 * at once instead of keeping it for as long as it happens to stay connected.
 */
@WebSocketGateway({ path: '/v1/socket.io', cors: { origin: true } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(ChatGateway.name);
  private server: Server | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly tokens: TokenUsers,
    private readonly realtime: ChatRealtime,
    private readonly repo: ChatRepository,
  ) {}

  afterInit(server: Server): void {
    this.server = server;
    this.realtime.attach(server);
    if (process.env.NODE_ENV !== 'test') this.sweepTimer = setInterval(() => void this.sweep().catch(() => undefined), SWEEP_MS);
  }

  /** Disconnects every socket whose token no longer proves a live client or agent account. */
  async sweep(): Promise<void> {
    if (!this.server) return;
    for (const [id, socket] of this.server.sockets.sockets) {
      const token = typeof socket.data.token === 'string' ? socket.data.token : undefined;
      const user = await this.tokens.userOf(token).catch(() => undefined);
      if (user && (user.role === 'client' || user.role === 'agent')) continue;
      socket.emit('denied', { message: 'Sign in again' });
      socket.disconnect(true);
      this.realtime.disconnected(id);
    }
  }

  async handleConnection(socket: Socket): Promise<void> {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    const user = await this.tokens.userOf(typeof token === 'string' ? token : undefined).catch(() => undefined);
    if (!user || (user.role !== 'client' && user.role !== 'agent')) {
      socket.emit('denied', { message: 'Sign in again' });
      socket.disconnect(true);
      return;
    }
    socket.data.token = token;
    socket.data.user = { id: user.id, side: user.role } satisfies Who;
    this.realtime.connected(socket.id, user.id);
    await socket.join(userRoom(user.id));
  }

  handleDisconnect(socket: Socket): void {
    this.realtime.disconnected(socket.id);
  }

  /** The socket's user, only while its token still proves a live account. */
  private async revalidate(socket: Socket): Promise<Who | undefined> {
    const user = await this.tokens.userOf(typeof socket.data.token === 'string' ? socket.data.token : undefined).catch(() => undefined);
    if (!user || (user.role !== 'client' && user.role !== 'agent')) {
      socket.emit('denied', { message: 'Sign in again' });
      socket.disconnect(true);
      this.realtime.disconnected(socket.id);
      return undefined;
    }
    return { id: user.id, side: user.role };
  }

  /** The conversation now on screen (null when none), so its messages need no notification. */
  @SubscribeMessage('open')
  async open(socket: Socket, body: { threadId?: unknown }): Promise<void> {
    const who = await this.revalidate(socket);
    const thread = who && typeof body?.threadId === 'number' ? await this.theirs(body.threadId, who) : undefined;
    this.realtime.setOpen(socket.id, thread?.id ?? null);
  }

  /** "typing…" for the other side of the conversation. */
  @SubscribeMessage('typing')
  async typing(socket: Socket, body: { threadId?: unknown }): Promise<void> {
    const who = await this.revalidate(socket);
    const thread = who && typeof body?.threadId === 'number' ? await this.theirs(body.threadId, who) : undefined;
    if (!thread || !who) return;
    const other = who.side === 'client' ? thread.agentId : thread.clientId;
    this.realtime.emit([other], 'typing', { threadId: thread.id, sender: who.side });
  }

  /** The conversation, only when this user is in it. */
  private async theirs(threadId: unknown, who: Who) {
    if (typeof threadId !== 'number' || !Number.isInteger(threadId)) return undefined;
    const thread = await this.repo.findThread(threadId).catch((err: unknown) => {
      this.log.warn(`Chat lookup failed: ${String(err)}`);
      return undefined;
    });
    return thread && (who.side === 'client' ? thread.clientId : thread.agentId) === who.id ? thread : undefined;
  }
}
