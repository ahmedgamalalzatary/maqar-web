import AsyncStorage from '@react-native-async-storage/async-storage';
import { type AppSettings, DEFAULT_APP_SETTINGS, homeSectionOrder } from '@maqar/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { apiFetch } from '@/core/api/api';
import { trackLoad } from '@/core/storage/loaded';

type AppConfig = {
  /** What an admin set for the app, as of the last time the server answered. */
  config: AppSettings;
  /** Asks the server; a failure keeps what there is. */
  refresh: () => Promise<void>;
};

/** Whatever the server (or storage) holds over the defaults, so a part it lacks still has a value. */
const complete = (v: Partial<AppSettings> | undefined): AppSettings => ({
  splash: { ...DEFAULT_APP_SETTINGS.splash, ...v?.splash },
  calculator: { ...DEFAULT_APP_SETTINGS.calculator, ...v?.calculator },
  home: { sections: homeSectionOrder(v?.home?.sections ?? []) },
  contact: { ...DEFAULT_APP_SETTINGS.contact, ...v?.contact },
});

/**
 * The app settings an admin controls (phase 29): the opening screen, the calculator's limits and
 * the Home order. They are kept on the phone, because the opening screen shows before any answer
 * can arrive: a start uses what the last start fetched.
 */
export const useAppConfig = create<AppConfig>()(
  persist(
    (set) => ({
      config: DEFAULT_APP_SETTINGS,
      refresh: async () => {
        try {
          set({ config: complete(await apiFetch<Partial<AppSettings>>('/settings', { anonymous: true })) });
        } catch {
          // Offline or a server problem: the saved settings stay.
        }
      },
    }),
    {
      name: 'maqar.app-config',
      onRehydrateStorage: trackLoad('maqar.app-config'),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ config }) => ({ config }),
      merge: (stored, current) => ({ ...current, config: complete((stored as { config?: Partial<AppSettings> } | undefined)?.config) }),
    },
  ),
);

export const useCalculatorLimits = () => useAppConfig((s) => s.config.calculator);
export const useHomeOrder = () => useAppConfig((s) => s.config.home.sections);
export const useContact = () => useAppConfig((s) => s.config.contact);
