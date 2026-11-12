import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { ChatThread } from '@maqar/shared';
import { addMessage, chatKey, chatsKey, markReadBy, replaceMessage, threadKey } from '../chat-cache';
import { useChatUser } from '../hooks/use-chat';
import { connectChat, heardTyping, stoppedTyping } from '../socket';

/**
 * Keeps the chat live while a client or agent is signed in: the socket's events go straight into
 * the caches, so open screens update by themselves. Signing out (or switching account) closes it.
 */
export function ChatBridge() {
  const me = useChatUser();
  const qc = useQueryClient();
  const id = me?.id ?? null;
  const side = me?.side ?? null;

  useEffect(() => {
    if (id === null || side === null) return;
    return connectChat({
      message: ({ message }) => {
        addMessage(qc, id, message);
        if (message.sender !== side) stoppedTyping(message.threadId);
        void qc.invalidateQueries({ queryKey: chatsKey(id) });
      },
      read: ({ threadId, reader, at }) => {
        if (reader !== side) markReadBy(qc, id, threadId, reader, at);
      },
      typing: ({ threadId, sender }) => {
        if (sender !== side) heardTyping(threadId);
      },
      updated: ({ message }) => replaceMessage(qc, id, message),
      // Closed (or opened again by an admin): the conversation's banner and composer follow at once.
      blocked: ({ threadId, blocked }) => {
        qc.setQueryData<ChatThread>(threadKey(id, threadId), (t) => (t ? { ...t, blocked } : t));
        void qc.invalidateQueries({ queryKey: chatsKey(id) });
      },
      // Back after a drop (the app in the background, the network gone): load what was missed.
      reconnected: () => void qc.invalidateQueries({ queryKey: chatKey(id) }),
    });
  }, [id, side, qc]);

  return null;
}
