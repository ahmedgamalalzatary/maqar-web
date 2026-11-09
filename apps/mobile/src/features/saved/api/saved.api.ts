import type { PropertyCard } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

/** Every saved home, most recently saved first. */
export const getSaved = (signal?: AbortSignal) => apiFetch<PropertyCard[]>('/favorites', { signal });

export const saveRequest = (id: number) => apiFetch<void>(`/favorites/${id}`, { method: 'PUT' });

export const unsaveRequest = (id: number) => apiFetch<void>(`/favorites/${id}`, { method: 'DELETE' });
