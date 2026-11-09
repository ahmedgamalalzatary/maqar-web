import type { Category, PropertiesQuery } from '@maqar/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getAreas, getProperties } from '../api/listings.api';

/** Areas change rarely: keep them for an hour. */
export const useAreas = () =>
  useQuery({ queryKey: ['areas'], queryFn: ({ signal }) => getAreas(signal), staleTime: 60 * 60_000 });

/** One page of listings, for Home rows. */
export const useProperties = (q: PropertiesQuery) =>
  useQuery({ queryKey: ['properties', q], queryFn: ({ signal }) => getProperties(q, signal) });

/** Explore: listings page by page, filtered by category and area. */
export function useBrowse(filter: { category?: Category; area?: string }) {
  return useInfiniteQuery({
    queryKey: ['properties', 'browse', filter],
    queryFn: ({ pageParam, signal }) => getProperties({ ...filter, page: pageParam, limit: 20 }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });
}
