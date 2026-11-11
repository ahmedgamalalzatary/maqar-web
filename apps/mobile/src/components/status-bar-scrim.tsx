import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';

/** The property page and its tour run a photo under the status bar; a chat has its own colored header. */
const FULL_BLEED = /^\/(property\/[^/]+(\/tour)?|(agent\/)?chat\/[^/]+)$/;

export const statusBarScrimShown = (pathname: string): boolean => !FULL_BLEED.test(pathname);

/**
 * The app draws edge to edge, so content scrolled up showed through the status bar. This paints
 * the status bar's strip in the screen's background, above every screen. Render once, at the root.
 */
export function StatusBarScrim() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  if (!insets.top || !statusBarScrimShown(pathname)) return null;
  return <View pointerEvents="none" style={[styles.scrim, { height: insets.top, backgroundColor: colors.bg }]} />;
}

const styles = StyleSheet.create({ scrim: { position: 'absolute', top: 0, left: 0, right: 0 } });
