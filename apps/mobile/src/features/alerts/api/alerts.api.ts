import type { PropertyCard } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

/** Every home whose price the client follows, most recently followed first. */
export const getAlerts = (signal?: AbortSignal) => apiFetch<PropertyCard[]>('/alerts', { signal });

export const followRequest = (id: number) => apiFetch<void>(`/alerts/${id}`, { method: 'PUT' });

export const unfollowRequest = (id: number) => apiFetch<void>(`/alerts/${id}`, { method: 'DELETE' });
