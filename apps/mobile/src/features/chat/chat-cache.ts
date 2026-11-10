import type { ChatMessage, ChatPage, ChatSender } from '@maqar/shared';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

// The chat caches, shared by the screens and the socket. Keyed by the user, so no account ever sees another's.

export const chatKey = (userId: number | null) => ['chat', userId];
export const chatsKey = (userId: number | null) => [...chatKey(userId), 'list'];
export const threadKey = (userId: number | null, id: number) => [...chatKey(userId), 'thread', id];
export const messagesKey = (userId: number | null, id: number) => [...chatKey(userId), 'messages', id];

/** Pages from the newest: `pages[0]` holds the latest messages, oldest first within a page. */
export type Messages = InfiniteData<ChatPage, number | undefined>;

/** Adds a message to its conversation (once: the socket and the reply to a send both bring it). */
export function addMessage(qc: QueryClient, userId: number | null, m: ChatMessage): void {
  qc.setQueryData<Messages>(messagesKey(userId, m.threadId), (data) => {
    if (!data?.pages.length) return data;
    if (data.pages.some((p) => p.items.some((x) => x.id === m.id))) return data;
    const [first, ...rest] = data.pages;
    return { ...data, pages: [{ ...first!, items: [...first!.items, m] }, ...rest] };
  });
}

/** Swaps a message for its new version (a times card once a time is picked), or a sent one for its stand-in. */
export function replaceMessage(qc: QueryClient, userId: number | null, m: ChatMessage, oldId = m.id): void {
  qc.setQueryData<Messages>(messagesKey(userId, m.threadId), (data) => {
    if (!data) return data;
    const known = data.pages.some((p) => p.items.some((x) => x.id === m.id));
    return {
      ...data,
      pages: data.pages.map((p) => ({
        ...p,
        items: p.items.flatMap((x) => (x.id === oldId ? (known && oldId !== m.id ? [] : [m]) : [x])),
      })),
    };
  });
}

export function removeMessage(qc: QueryClient, userId: number | null, threadId: number, id: number): void {
  qc.setQueryData<Messages>(messagesKey(userId, threadId), (data) =>
    data ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.filter((x) => x.id !== id) })) } : data,
  );
}

/** The other side read: `reader`'s counterpart's messages get their read time (the ticks turn gold). */
export function markReadBy(qc: QueryClient, userId: number | null, threadId: number, reader: ChatSender, at: string): void {
  qc.setQueryData<Messages>(messagesKey(userId, threadId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((p) => ({ ...p, items: p.items.map((x) => (x.sender !== reader && !x.readAt ? { ...x, readAt: at } : x)) })),
        }
      : data,
  );
}

/** Newest first, for the inverted list. */
export const newestFirst = (data: { pages: ChatPage[] } | undefined): ChatMessage[] => data?.pages.flatMap((p) => [...p.items].reverse()) ?? [];
