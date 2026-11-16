import type { Lang } from '@maqar/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSettings } from '@/core/settings/store';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Renders with the app's providers. Queries do not retry, so error states show at once.
 * The providers are a wrapper, so `rerender` keeps the same query cache.
 */
export function renderWithProviders(ui: ReactElement, opts: { lang?: Lang; theme?: 'light' | 'dark' } = {}) {
  useSettings.setState({ lang: opts.lang ?? 'ar', theme: opts.theme ?? 'light' });
  // gcTime Infinity starts no cleanup timer; the 5-minute default kept Jest alive after the run.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  const Providers = ({ children }: { children: React.ReactNode }) => (
    <SafeAreaProvider initialMetrics={metrics}>
      {/* The app's providers hold a gesture root too (swipes, drags). */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
  return render(ui, { wrapper: Providers });
}
