import type { BookViewingBody, SlotsResponse, UpdateViewingBody, ViewingItem } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

/** The next 14 days of hours. `reschedule`: the viewing being moved, whose own hour shows free. */
export const getSlots = (propertyId: number, reschedule?: number, signal?: AbortSignal) =>
  apiFetch<SlotsResponse>(`/properties/${propertyId}/slots${reschedule ? `?reschedule=${reschedule}` : ''}`, { signal, anonymous: true });

export const getViewings = (signal?: AbortSignal) => apiFetch<ViewingItem[]>('/viewings', { signal });

export const bookRequest = (body: BookViewingBody) => apiFetch<ViewingItem>('/viewings', { method: 'POST', body });

export const updateViewingRequest = (id: number, body: UpdateViewingBody) =>
  apiFetch<ViewingItem>(`/viewings/${id}`, { method: 'PATCH', body });

export const getIcs = (id: number) => apiFetch<string>(`/viewings/${id}/ics`, { text: true });
