import type { NotificationItem, NotificationsResponse, PushTokenBody } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const listNotifications = () => apiFetch<NotificationsResponse>('/notifications');

export const readAllRequest = () => apiFetch<void>('/notifications/read-all', { method: 'POST' });

export const readOneRequest = (id: number) => apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' });

/** Puts a "notifications are on" entry in the inbox and on the phone. */
export const sendTestRequest = () => apiFetch<NotificationItem>('/notifications/test', { method: 'POST' });

export const savePushTokenRequest = (body: PushTokenBody) => apiFetch<void>('/me/push-tokens', { method: 'POST', body });

export const deletePushTokenRequest = (token: string) =>
  apiFetch<void>('/me/push-tokens', { method: 'DELETE', body: { token } });
