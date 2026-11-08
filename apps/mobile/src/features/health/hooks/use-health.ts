import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../api/health.api';

export const healthKeys = { all: ['health'] as const };

/** Whether the API and its database are up. */
export function useHealth() {
  return useQuery({ queryKey: healthKeys.all, queryFn: fetchHealth });
}
