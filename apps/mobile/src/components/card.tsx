import { StyleSheet, View, type ViewProps } from 'react-native';
import { radius, useTheme } from '@/core/theme';

export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return <View {...rest} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]} />;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
});
