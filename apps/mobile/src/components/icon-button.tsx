import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/core/theme';
import { PressableScale } from './pressable-scale';

/** A round 44pt icon button. `label` is read by screen readers (contract §15). */
export function IconButton({ label, icon, onPress }: { label: string; icon: ReactNode; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      scaleTo={0.9}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      {icon}
    </PressableScale>
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
