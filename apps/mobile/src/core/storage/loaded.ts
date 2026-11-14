import { create } from 'zustand';

/** Which saved stores have finished loading from storage, whether the read worked or not. */
export const useLoadedStores = create<{ loading: Record<string, boolean> }>(() => ({ loading: {} }));

/**
 * For a persisted store's `onRehydrateStorage`. zustand's own `hasHydrated()` stays false after a
 * failed read (a storage error, broken JSON), which would hold the app at the splash for good;
 * this marks the store loaded either way, and the store keeps its defaults (phase 29 review).
 */
export const trackLoad = (name: string) => () => {
  useLoadedStores.setState((s) => ({ loading: { ...s.loading, [name]: true } }));
  return () => useLoadedStores.setState((s) => ({ loading: { ...s.loading, [name]: false } }));
};

/** Whether every one of these stores has finished a load and is not loading again. */
export const allLoaded = (loading: Record<string, boolean>, names: readonly string[]) => names.every((n) => loading[n] === false);
