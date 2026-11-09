import type { PropertyCard, PropertyDetail } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const getProperty = (id: number, signal?: AbortSignal) => apiFetch<PropertyDetail>(`/properties/${id}`, { signal });

export const getSimilar = (id: number, signal?: AbortSignal) =>
  apiFetch<PropertyCard[]>(`/properties/${id}/similar`, { signal });
