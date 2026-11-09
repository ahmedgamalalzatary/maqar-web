import type { AreaItem, ListingFacets, Page, PropertiesQuery, PropertyCard } from '@maqar/shared';
import { apiFetch } from '@/core/api/api';
import { listingParams } from '../filters';

export const getAreas = (signal?: AbortSignal) => apiFetch<AreaItem[]>('/areas', { signal });

export function getProperties(q: PropertiesQuery, signal?: AbortSignal) {
  const params = listingParams({ ...q, page: q.page ?? 1, limit: q.limit ?? 20 });
  return apiFetch<Page<PropertyCard>>(`/properties?${params}`, { signal });
}

/**
 * Counts for the filter sheet: matches, histograms and delivery years. The sheet's filters also
 * carry Explore's sort, which this endpoint refuses (400), so only the filters are sent.
 */
export function getFacets(f: PropertiesQuery, signal?: AbortSignal) {
  const { sort: _sort, page: _page, limit: _limit, ...filters } = f;
  const params = listingParams(filters);
  return apiFetch<ListingFacets>(`/properties/facets${params.size ? `?${params}` : ''}`, { signal });
}
