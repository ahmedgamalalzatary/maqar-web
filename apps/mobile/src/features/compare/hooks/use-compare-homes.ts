import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getCompare } from '../api/compare.api';
import { useCompare } from '../store/compare.store';

/** The picked homes' details. Homes no longer listed drop out of the list. */
export function useCompareHomes() {
  const key = useCompare((s) => s.homes.map((h) => h.id).join(','));
  const keepOnly = useCompare((s) => s.keepOnly);
  const ids = key ? key.split(',').map(Number) : [];
  const query = useQuery({
    queryKey: ['compare', key],
    queryFn: ({ signal }) => getCompare(ids, signal),
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
  });
  // Only a fresh answer for these ids may drop homes: a placeholder is the answer for the old ids.
  const fresh = query.isSuccess && !query.isPlaceholderData ? query.data : undefined;
  useEffect(() => {
    if (fresh) keepOnly(fresh.map((h) => h.id));
  }, [fresh, keepOnly]);
  return { ids, query };
}
