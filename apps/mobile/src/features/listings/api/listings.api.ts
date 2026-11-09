import type { AreaItem, ListingFacets, ListingFilters, Page, PropertiesQuery, PropertyCard } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';
import { listingParams } from '../filters';

export const getAreas = (signal?: AbortSignal) => apiFetch<AreaItem[]>('/areas', { signal });

export function getProperties(q: PropertiesQuery, signal?: AbortSignal) {
  const params = listingParams({ ...q, page: q.page ?? 1, limit: q.limit ?? 20 });
  return apiFetch<Page<PropertyCard>>(`/properties?${params}`, { signal });
}

/** Counts for the filter sheet: matches, histograms and delivery years. */
export function getFacets(f: ListingFilters, signal?: AbortSignal) {
  const params = listingParams(f);
  return apiFetch<ListingFacets>(`/properties/facets${params.size ? `?${params}` : ''}`, { signal });
}
