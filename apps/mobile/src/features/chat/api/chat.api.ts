import type { ChatMessage, ChatPage, ChatThread, SendChatBody, ViewingItem } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const getChats = (signal?: AbortSignal) => apiFetch<ChatThread[]>('/chats', { signal });

export const startChatRequest = (propertyId: number) => apiFetch<ChatThread>('/chats', { method: 'POST', body: { propertyId } });

export const getThread = (id: number, signal?: AbortSignal) => apiFetch<ChatThread>(`/chats/${id}`, { signal });

export const getMessages = (id: number, before?: number, signal?: AbortSignal) =>
  apiFetch<ChatPage>(`/chats/${id}/messages${before ? `?before=${before}` : ''}`, { signal });

export const sendRequest = (id: number, body: SendChatBody) => apiFetch<ChatMessage>(`/chats/${id}/messages`, { method: 'POST', body });

/** Photos picked on the phone, as files in a multipart form. */
export function sendImagesRequest(id: number, photos: { uri: string; name: string; type: string }[]) {
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for a file.
  for (const p of photos) form.append('photos', p as unknown as Blob);
  return apiFetch<ChatMessage>(`/chats/${id}/images`, { method: 'POST', body: form });
}

export const readRequest = (id: number) => apiFetch<void>(`/chats/${id}/read`, { method: 'POST' });

export const bookSlotRequest = (id: number, messageId: number, time: string) =>
  apiFetch<{ viewing: ViewingItem; card: ChatMessage }>(`/chats/${id}/messages/${messageId}/book`, { method: 'POST', body: { time } });
