import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';
import { COMPARE_TRAY_SPACE } from '@/features/compare/components/compare-tray';
import { useCompare } from '@/features/compare/store/compare.store';
import { KeyboardAvoiding } from './keyboard-avoiding';
import { Txt } from './text';

/** A tab or inner screen: safe-area padding, an optional title and scrolling content. */
export function Screen({ title, right, children }: { title?: string; right?: ReactNode; children?: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // The compare bar floats over tab screens; keep the page's end clear of it while it shows.
  const trayOpen = useCompare((s) => s.homes.length > 0);
  return (
    <KeyboardAvoiding style={{ backgroundColor: colors.bg }}>
      <ScrollView
        testID="screen-scroll"
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12 },
          trayOpen ? { paddingBottom: styles.content.paddingBottom + COMPARE_TRAY_SPACE } : null,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {title || right ? (
          <View style={styles.header}>
            {title ? (
              <Txt accessibilityRole="header" size={24} weight="semibold" style={styles.title}>
                {title}
              </Txt>
            ) : (
              <View style={styles.title} />
            )}
            {right}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoiding>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  title: { flex: 1 },
});
