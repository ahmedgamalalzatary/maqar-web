import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { radius, useTheme } from '@/core/theme';
import { Txt } from './text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const { colors } = useTheme();
  const off = !!(disabled || loading);
  const bg = { primary: colors.accent, secondary: colors.surface2, danger: colors.danger, ghost: 'transparent' }[variant];
  const fg = { primary: colors.navy, secondary: colors.ink, danger: '#ffffff', ghost: colors.accentInk }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.base, { backgroundColor: bg, opacity: off ? 0.6 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Txt weight="semibold" align="center" style={{ color: fg }}>
          {label}
        </Txt>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
