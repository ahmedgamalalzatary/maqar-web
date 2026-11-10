import { Injectable } from '@nestjs/common';
import type { ChatEvents } from '@maqar/shared';
import type { Server } from 'socket.io';

/** Each user's sockets join this room, so a message reaches every phone they are signed in on. */
export const userRoom = (userId: number) => `user:${userId}`;

/**
 * The live side of chat: sends events to users and remembers which conversation each socket has
 * open, so a message there needs no notification. The gateway fills it in.
 */
@Injectable()
export class ChatRealtime {
  private server: Server | null = null;
  /** socket id → the user and the conversation it has open. */
  private readonly sockets = new Map<string, { userId: number; open: number | null }>();

  attach(server: Server): void {
    this.server = server;
  }

  connected(socketId: string, userId: number): void {
    this.sockets.set(socketId, { userId, open: null });
  }

  disconnected(socketId: string): void {
    this.sockets.delete(socketId);
  }

  setOpen(socketId: string, threadId: number | null): void {
    const s = this.sockets.get(socketId);
    if (s) s.open = threadId;
  }

  /** Whether the user has this conversation on screen on any phone. */
  isOpen(userId: number, threadId: number): boolean {
    for (const s of this.sockets.values()) if (s.userId === userId && s.open === threadId) return true;
    return false;
  }

  emit<E extends keyof ChatEvents>(userIds: number[], event: E, payload: ChatEvents[E]): void {
    if (!this.server || !userIds.length) return;
    this.server.to(userIds.map(userRoom)).emit(event, payload);
  }
}
