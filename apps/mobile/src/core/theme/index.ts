import type { ThemePref } from '@maqar/shared';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/core/settings/store';
import { type Colors, dark, light } from './tokens';

export * from './tokens';

export type Scheme = 'light' | 'dark';

export function resolveScheme(pref: ThemePref, system: string | null | undefined): Scheme {
  if (pref !== 'system') return pref;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme(): { scheme: Scheme; colors: Colors } {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const scheme = resolveScheme(pref, system);
  return { scheme, colors: scheme === 'dark' ? dark : light };
}
