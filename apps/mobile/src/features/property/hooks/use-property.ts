import { useQuery } from '@tanstack/react-query';
import { getProperty, getSimilar } from '../api/property.api';

/** The property page. Opening it counts a view on the server. */
export const useProperty = (id: number) =>
  useQuery({ queryKey: ['property', id], queryFn: ({ signal }) => getProperty(id, signal) });

export const useSimilar = (id: number, enabled: boolean) =>
  useQuery({ queryKey: ['property', id, 'similar'], queryFn: ({ signal }) => getSimilar(id, signal), enabled });
