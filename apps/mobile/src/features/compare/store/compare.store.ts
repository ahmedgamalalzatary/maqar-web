import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMPARE_MAX } from '@maqar/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** A picked home: its id, and its photo for the tray. */
export type PickedHome = { id: number; cover: string | null };

export type ToggleResult = 'added' | 'removed' | 'replaced';

/** Picking a home again takes it out; a third replaces the oldest (contract §8.10). */
export function toggled(homes: PickedHome[], home: PickedHome): { homes: PickedHome[]; result: ToggleResult } {
  if (homes.some((h) => h.id === home.id)) return { homes: homes.filter((h) => h.id !== home.id), result: 'removed' };
  if (homes.length >= COMPARE_MAX) return { homes: [...homes.slice(1), home], result: 'replaced' };
  return { homes: [...homes, home], result: 'added' };
}

type CompareState = {
  homes: PickedHome[];
  toggle: (home: PickedHome) => ToggleResult;
  /** Puts a home in slot 0 or 1. An empty slot 1 takes the next free place. */
  setSlot: (slot: 0 | 1, home: PickedHome) => void;
  remove: (id: number) => void;
  clear: () => void;
  /** Drops homes that are no longer listed. */
  keepOnly: (ids: number[]) => void;
};

/** The homes picked to compare, kept on the device (contract §8.10). Guests can compare too. */
export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      homes: [],
      toggle: (home) => {
        const next = toggled(get().homes, home);
        set({ homes: next.homes });
        return next.result;
      },
      setSlot: (slot, home) => {
        const homes = get().homes.filter((h) => h.id !== home.id);
        if (slot < homes.length) homes[slot] = home;
        else homes.push(home);
        set({ homes: homes.slice(0, COMPARE_MAX) });
      },
      remove: (id) => set({ homes: get().homes.filter((h) => h.id !== id) }),
      clear: () => set({ homes: [] }),
      keepOnly: (ids) => {
        const homes = get().homes.filter((h) => ids.includes(h.id));
        if (homes.length !== get().homes.length) set({ homes });
      },
    }),
    {
      name: 'maqar.compare',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ homes }) => ({ homes }),
    },
  ),
);
