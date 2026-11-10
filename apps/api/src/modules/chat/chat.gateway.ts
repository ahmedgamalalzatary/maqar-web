import { Logger } from '@nestjs/common';
import { type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { TokenUsers } from '../auth/token-users.js';
import { ChatRealtime, userRoom } from './chat.realtime.js';
import { ChatRepository } from './chat.repository.js';

type Who = { id: number; side: 'client' | 'agent' };

/**
 * The chat socket (contract §8.12, §14) at `/v1/socket.io`, so it goes through the same proxy as the
 * API. It signs in with the same access token as HTTP (`auth: { token }`); anyone else is
 * disconnected, and so is staff other than agents. Messages are sent over HTTP; the socket brings
 * them (and typing and read receipts) to the other side at once.
 */
@WebSocketGateway({ path: '/v1/socket.io', cors: { origin: true } })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly log = new Logger(ChatGateway.name);

  constructor(
    private readonly tokens: TokenUsers,
    private readonly realtime: ChatRealtime,
    private readonly repo: ChatRepository,
  ) {}

  afterInit(server: Server): void {
    this.realtime.attach(server);
  }

  async handleConnection(socket: Socket): Promise<void> {
    const token = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
    const user = await this.tokens.userOf(typeof token === 'string' ? token : undefined).catch(() => undefined);
    if (!user || (user.role !== 'client' && user.role !== 'agent')) {
      socket.emit('denied', { message: 'Sign in again' });
      socket.disconnect(true);
      return;
    }
    socket.data.user = { id: user.id, side: user.role } satisfies Who;
    this.realtime.connected(socket.id, user.id);
    await socket.join(userRoom(user.id));
  }

  handleDisconnect(socket: Socket): void {
    this.realtime.disconnected(socket.id);
  }

  /** The conversation now on screen (null when none), so its messages need no notification. */
  @SubscribeMessage('open')
  async open(socket: Socket, body: { threadId?: unknown }): Promise<void> {
    const thread = await this.mine(socket, body?.threadId);
    this.realtime.setOpen(socket.id, thread?.id ?? null);
  }

  /** "typing…" for the other side of the conversation. */
  @SubscribeMessage('typing')
  async typing(socket: Socket, body: { threadId?: unknown }): Promise<void> {
    const thread = await this.mine(socket, body?.threadId);
    const who = socket.data.user as Who | undefined;
    if (!thread || !who) return;
    const other = who.side === 'client' ? thread.agentId : thread.clientId;
    this.realtime.emit([other], 'typing', { threadId: thread.id, sender: who.side });
  }

  /** The conversation, only when this socket's user is in it. */
  private async mine(socket: Socket, threadId: unknown) {
    const who = socket.data.user as Who | undefined;
    if (!who || typeof threadId !== 'number' || !Number.isInteger(threadId)) return undefined;
    const thread = await this.repo.findThread(threadId).catch((err: unknown) => {
      this.log.warn(`Chat lookup failed: ${String(err)}`);
      return undefined;
    });
    return thread && (who.side === 'client' ? thread.clientId : thread.agentId) === who.id ? thread : undefined;
  }
}
