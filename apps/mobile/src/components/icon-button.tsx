import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/core/theme';

/** A round 44pt icon button. `label` is read by screen readers (contract §15). */
export function IconButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
