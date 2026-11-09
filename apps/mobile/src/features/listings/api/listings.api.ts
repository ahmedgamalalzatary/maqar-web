import type { AreaItem, Page, PropertiesQuery, PropertyCard } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';

export const getAreas = (signal?: AbortSignal) => apiFetch<AreaItem[]>('/areas', { signal });

export function getProperties(q: PropertiesQuery, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (q.category) params.set('category', q.category);
  if (q.area) params.set('area', q.area);
  params.set('page', String(q.page ?? 1));
  params.set('limit', String(q.limit ?? 20));
  return apiFetch<Page<PropertyCard>>(`/properties?${params}`, { signal });
}
