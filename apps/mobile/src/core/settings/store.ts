import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Lang, ThemePref } from '@maqar/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Settings = {
  lang: Lang;
  theme: ThemePref;
  setLang: (lang: Lang) => void;
  setTheme: (theme: ThemePref) => void;
};

/** On-device settings (contract §6.3, §7). Arabic first; the theme follows the phone until changed. */
export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      lang: 'ar',
      theme: 'system',
      setLang: (lang) => set({ lang }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'maqar.settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ lang, theme }) => ({ lang, theme }),
    },
  ),
);
