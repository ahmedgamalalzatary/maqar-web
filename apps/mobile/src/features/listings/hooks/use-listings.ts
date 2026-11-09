import type { ListingFilters, PropertiesQuery } from '@maqar/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getAreas, getFacets, getProperties } from '../api/listings.api';
import type { ExploreFilters } from '../filters';

/** Areas change rarely: keep them for an hour. */
export const useAreas = () =>
  useQuery({ queryKey: ['areas'], queryFn: ({ signal }) => getAreas(signal), staleTime: 60 * 60_000 });

/** One page of listings, for Home rows. */
export const useProperties = (q: PropertiesQuery) =>
  useQuery({ queryKey: ['properties', q], queryFn: ({ signal }) => getProperties(q, signal) });

/** Explore: listings page by page, for the filters and sort. */
export function useBrowse(filters: ExploreFilters) {
  return useInfiniteQuery({
    queryKey: ['properties', 'browse', filters],
    queryFn: ({ pageParam, signal }) => getProperties({ ...filters, page: pageParam, limit: 20 }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    // Keep the old results on screen while new filters load, so the list does not flash empty.
    placeholderData: keepPreviousData,
  });
}

/** The filter sheet's counts. The last answer stays while the next loads, so the bars do not flicker. */
export const useFacets = (filters: ListingFilters, enabled: boolean) =>
  useQuery({
    queryKey: ['properties', 'facets', filters],
    queryFn: ({ signal }) => getFacets(filters, signal),
    enabled,
    placeholderData: keepPreviousData,
  });

/** `value`, once it has stopped changing for `ms`. For typing and dragging. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(value, settled)) return; // nothing to wait for
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, settled, ms]);
  return settled;
}
