import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { addMessage, chatsKey, markReadBy, replaceMessage } from '../chat-cache';
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
    });
  }, [id, side, qc]);

  return null;
}
