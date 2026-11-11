import type { NotificationItem, NotificationsResponse, PushTokenBody } from '@maqar/shared';
import { NOTIFICATIONS_LIMIT } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const listNotifications = (before?: number, signal?: AbortSignal) =>
  apiFetch<NotificationsResponse>(`/notifications${before ? `?before=${before}` : ''}`, { signal });

export const readAllRequest = () => apiFetch<void>('/notifications/read-all', { method: 'POST' });

export const readOneRequest = (id: number) => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' });

/** Puts a "notifications are on" entry in the inbox and on the phone. */
export const sendTestRequest = () => apiFetch<NotificationItem>('/notifications/test', { method: 'POST' });

export const savePushTokenRequest = (body: PushTokenBody) => apiFetch<void>('/me/push-tokens', { method: 'POST', body });

export const deletePushTokenRequest = (token: string) =>
  apiFetch<void>('/me/push-tokens', { method: 'DELETE', body: { token } });

/** The oldest id loaded, or undefined when nothing (or the end) is reached. */
export const olderCursor = (pages: NotificationsResponse[]): number | undefined => {
  const last = pages.at(-1);
  return last && last.items.length >= NOTIFICATIONS_LIMIT ? last.items.at(-1)?.id : undefined;
};
