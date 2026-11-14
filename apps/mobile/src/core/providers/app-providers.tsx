import {
  ReadexPro_400Regular,
  ReadexPro_500Medium,
  ReadexPro_600SemiBold,
  ReadexPro_700Bold,
  useFonts,
} from '@expo-google-fonts/readex-pro';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '@/components/toast';
import { useDir } from '@/core/i18n';
import { queryClient } from '@/core/api/query';
import { useAppConfig } from '@/core/app-config/store';
import { useSettings } from '@/core/settings/store';
import { useTheme } from '@/core/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Waits for saved settings to load from storage. Subscribing first means a finish cannot be missed. */
function useSettingsReady() {
  const own = useSyncExternalStore(
    (onChange) => useSettings.persist.onFinishHydration(onChange),
    () => useSettings.persist.hasHydrated(),
  );
  // What an admin set for the app (phase 29): the opening screen is read from it at once.
  const app = useSyncExternalStore(
    (onChange) => useAppConfig.persist.onFinishHydration(onChange),
    () => useAppConfig.persist.hasHydrated(),
  );
  return own && app;
}

/** Runs the app's start-up work (such as resuming the session) once, behind the splash. */
function useBoot(boot?: () => Promise<void>) {
  const [done, setDone] = useState(!boot);
  useEffect(() => {
    if (!boot) return;
    // Promise.resolve().then() also catches a boot() that throws before returning a promise.
    Promise.resolve()
      .then(boot)
      .catch(() => {})
      .finally(() => setDone(true));
    // Start-up runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return done;
}

/** Everything around the routes: fonts, splash, data fetching, theme, direction and toasts. */
export function AppProviders({ children, boot, overlay }: { children: ReactNode; boot?: () => Promise<void>; overlay?: ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    ReadexPro_400Regular,
    ReadexPro_500Medium,
    ReadexPro_600SemiBold,
    ReadexPro_700Bold,
  });
  const settingsReady = useSettingsReady();
  const booted = useBoot(boot);
  const ready = (fontsLoaded || !!fontError) && settingsReady && booted;
  const { scheme, colors } = useTheme();
  const dir = useDir();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          value={{
            ...navTheme,
            colors: { ...navTheme.colors, background: colors.bg, card: colors.surface, text: colors.ink, primary: colors.accent, border: colors.line },
          }}
        >
          {/* Layout direction is set here instead of I18nManager, so switching language needs no restart. */}
          <View style={[styles.root, { direction: dir, backgroundColor: colors.bg }]}>
            {children}
            <ToastHost />
            {/* Over everything: the opening screen (the root layout passes it, so core does not depend on a feature). */}
            {overlay}
          </View>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
