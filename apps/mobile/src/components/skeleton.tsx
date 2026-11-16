import { LinearGradient } from 'expo-linear-gradient';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { useTheme } from '@/core/theme';

/** A band of light crossing the block, left to right, forever. Percentages are of the band's own width. */
const SWEEP = {
  from: { transform: [{ translateX: '-100%' }] },
  to: { transform: [{ translateX: '100%' }] },
} as const;

/**
 * A grey block standing in for content while it loads, with a soft shimmer across it
 * (2026-11-16). With less motion asked for, it stays a plain block.
 */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors, scheme } = useTheme();
  const reduced = useReduceMotion();
  const light = scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)';
  return (
    <View style={[styles.block, { backgroundColor: colors.surface2 }, style]}>
      {reduced ? null : (
        <Animated.View testID="shimmer" pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sweep]}>
          <LinearGradient colors={['transparent', light, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  sweep: {
    animationName: SWEEP,
    animationDuration: '1300ms',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
});
