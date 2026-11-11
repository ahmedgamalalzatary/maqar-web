import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { KeyboardAvoiding } from './keyboard-avoiding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDir, useT } from '@/core/i18n';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { radius, useTheme } from '@/core/theme';
import { Txt } from './text';

/**
 * A bottom sheet for confirmations (contract §6.3). Tapping the backdrop closes it. It never grows
 * under the status bar; with `scroll`, a long body scrolls inside it under a fixed title.
 */
export function Sheet({
  open,
  onClose,
  title,
  scroll = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  scroll?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const dir = useDir();
  const t = useT();
  const reduceMotion = useReduceMotion();
  return (
    <Modal visible={open} transparent animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoiding style={styles.fill}>
        <Pressable accessibilityLabel={t('اقفل', 'Close')} style={styles.backdrop} onPress={onClose} />
        <View
          testID="sheet"
          style={[
            styles.sheet,
            { direction: dir, backgroundColor: colors.surface, paddingBottom: insets.bottom + 16, maxHeight: height - insets.top - 24 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.line2 }]} />
          <Txt size={18} weight="semibold">
            {title}
          </Txt>
          {scroll ? (
            <ScrollView testID="sheet-body" style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </View>
      </KeyboardAvoiding>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4, 21, 37, 0.45)' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20, gap: 14 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  body: { flexShrink: 1 },
  bodyContent: { gap: 14 },
});
