import type { ChatBody, ChatMessage, ChatSender, SendChatBody } from '@maqar/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSession } from '@/features/auth/store/session.store';
import { VIEWINGS_KEY } from '@/features/viewings/hooks/use-viewings';
import { bookSlotRequest, getChats, getMessages, getThread, readRequest, sendImagesRequest, sendRequest, startChatRequest } from '../api/chat.api';
import { addMessage, chatsKey, type Messages, messagesKey, removeMessage, replaceMessage, threadKey } from '../chat-cache';
import type { PhotoPart } from '../photos';

/** The signed-in client's or agent's id and side; null for guests and admins. */
export function useChatUser(): { id: number; side: ChatSender } | null {
  // Two plain values, so the result only changes when the account does.
  const id = useSession((s) => (s.status === 'signedIn' && (s.user?.role === 'client' || s.user?.role === 'agent') ? s.user.id : null));
  const side = useSession((s) => (s.user?.role === 'agent' ? 'agent' : 'client'));
  return useMemo(() => (id === null ? null : { id, side }), [id, side]);
}

export function useChats() {
  const me = useChatUser();
  return useQuery({ queryKey: chatsKey(me?.id ?? null), queryFn: ({ signal }) => getChats(signal), enabled: !!me });
}

/** Unread messages in every conversation: the chat button's and the Chats tab's badge. */
export function useChatUnread(): number {
  return useChats().data?.reduce((n, t) => n + t.unread, 0) ?? 0;
}

export function useThread(id: number) {
  const me = useChatUser();
  return useQuery({ queryKey: threadKey(me?.id ?? null, id), queryFn: ({ signal }) => getThread(id, signal), enabled: !!me });
}

/** The conversation's messages: the latest page first, older pages as the list scrolls up. */
export function useMessages(id: number) {
  const me = useChatUser();
  return useInfiniteQuery({
    queryKey: messagesKey(me?.id ?? null, id),
    queryFn: ({ pageParam, signal }) => getMessages(id, pageParam, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.items[0]?.id : undefined),
    enabled: !!me,
    // Live updates come over the socket; after a drop the chat bridge refetches what was missed.
    staleTime: Infinity,
  });
}

/** Starts (or opens) the client's conversation about a home. */
export function useStartChat() {
  const me = useChatUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startChatRequest,
    onSuccess: (thread) => qc.setQueryData(threadKey(me?.id ?? null, thread.id), thread),
  });
}

let tempId = 0;

/**
 * Sends a text or a card. A text shows at once, as sending; it becomes the real message when the
 * server answers, or goes away with an error.
 */
export function useSend(threadId: number) {
  const me = useChatUser();
  const qc = useQueryClient();
  const userId = me?.id ?? null;
  return useMutation({
    mutationFn: (body: SendChatBody) => sendRequest(threadId, body),
    onMutate: (body) => {
      if (body.kind !== 'text' || !me) return {};
      const temp: ChatMessage = { id: -++tempId, threadId, sender: me.side, body: { kind: 'text', text: body.text.trim() } as ChatBody, readAt: null, createdAt: new Date().toISOString() };
      addMessage(qc, userId, temp);
      return { temp };
    },
    onSuccess: (m, _body, ctx) => (ctx?.temp ? replaceMessage(qc, userId, m, ctx.temp.id) : addMessage(qc, userId, m)),
    onError: (_err, _body, ctx) => ctx?.temp && removeMessage(qc, userId, threadId, ctx.temp.id),
    onSettled: () => qc.invalidateQueries({ queryKey: chatsKey(userId) }),
  });
}

export function useSendImages(threadId: number) {
  const me = useChatUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photos: PhotoPart[]) => sendImagesRequest(threadId, photos),
    onSuccess: (m) => addMessage(qc, me?.id ?? null, m),
    onSettled: () => qc.invalidateQueries({ queryKey: chatsKey(me?.id ?? null) }),
  });
}

/** Reads the other side's messages; the unread counts go down. */
export function useMarkRead(threadId: number) {
  const me = useChatUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => readRequest(threadId),
    onSuccess: () => {
      const at = new Date().toISOString();
      qc.setQueryData(chatsKey(me?.id ?? null), (list: { id: number; unread: number }[] | undefined) =>
        list?.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t)),
      );
      // Mine are read by the other side only when they say so; theirs are read now.
      if (me) {
        qc.setQueryData(messagesKey(me.id, threadId), (data: Messages | undefined) =>
          data
            ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((x) => (x.sender !== me.side && !x.readAt ? { ...x, readAt: at } : x)) })) }
            : data,
        );
      }
    },
  });
}

/** Books a time from a times card; My viewings and the hours are stale after. */
export function useBookSlot(threadId: number) {
  const me = useChatUser();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, time }: { messageId: number; time: string }) => bookSlotRequest(threadId, messageId, time),
    onSuccess: ({ card }) => replaceMessage(qc, me?.id ?? null, card),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: VIEWINGS_KEY }),
        qc.invalidateQueries({ queryKey: ['slots'] }),
        qc.invalidateQueries({ queryKey: chatsKey(me?.id ?? null) }),
      ]),
  });
}
