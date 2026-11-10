import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

/** In front of the user: anything but the background or the app switcher (`unknown` while starting counts as in front). */
export const isActive = (state: string | null | undefined = AppState.currentState) => state !== 'background' && state !== 'inactive';

const subscribe = (onChange: () => void) => {
  const sub = AppState.addEventListener('change', onChange);
  return () => sub.remove();
};

/** Whether the app is in front of the user. */
export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, () => isActive());
}
