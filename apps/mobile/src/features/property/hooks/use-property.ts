import { useQuery } from '@tanstack/react-query';
import { getProperty, getSimilar } from '../api/property.api';

/**
 * The property page. Each fetch counts a view on the server, so a visit fetches it once:
 * no refetch when the page opens again soon after, on reconnect or on app focus.
 */
export const useProperty = (id: number) =>
  useQuery({
    queryKey: ['property', id],
    queryFn: ({ signal }) => getProperty(id, signal),
    staleTime: 5 * 60_000,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

export const useSimilar = (id: number, enabled: boolean) =>
  useQuery({ queryKey: ['property', id, 'similar'], queryFn: ({ signal }) => getSimilar(id, signal), enabled });
