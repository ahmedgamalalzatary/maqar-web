import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/** Retry lost connections and server errors twice; a 4xx will not change on retry. */
export function shouldRetry(count: number, err: unknown): boolean {
  if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
  return count < 2;
}

/** One React Query client for the app. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: shouldRetry } },
});
