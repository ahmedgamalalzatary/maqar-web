import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
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

// On phones, coming back to the app counts as focus: stale data (such as the inbox) refreshes,
// and timed refreshes pause while the app is in the background. The web uses the window's focus.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
    return () => sub.remove();
  });
}
