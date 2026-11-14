import { allLoaded, useLoadedStores } from '@/core/storage/loaded';
// Imported so both stores exist (and start loading) before anything waits for them.
import '@/core/app-config/store';
import '@/core/settings/store';

/** The saved stores the app waits for before it shows: the language and theme, and what an admin set (phase 29). */
const STORES = ['maqar.settings', 'maqar.app-config'] as const;

/** Whether the saved stores have loaded from storage; a failed read counts, so it never holds the splash. */
export function useStoresReady() {
  return useLoadedStores((s) => allLoaded(s.loading, STORES));
}
