import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { haptic } from '@/core/motion/haptics';
import { BOUNCE, EASE_OUT } from '@/core/motion/motion';
import { useTheme } from '@/core/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** The tick, in a 24-unit box, and its length for drawing it stroke by stroke. */
const TICK = 'M5 12.5 L10 17.5 L19 7.5';
const TICK_LENGTH = 22;

/**
 * A success badge (2026-11-16): the circle lands with a small bounce, then the tick draws itself,
 * and the phone buzzes success once. Used where something was done for good, like a booking.
 */
export function SuccessCheck({ size = 96 }: { size?: number }) {
  const { colors } = useTheme();
  const pop = useSharedValue(0.6);
  const draw = useSharedValue(0);
  useEffect(() => {
    haptic.success();
    pop.set(withSpring(1, BOUNCE));
    draw.set(withDelay(160, withTiming(1, { duration: 380, easing: EASE_OUT })));
  }, [pop, draw]);
  const circle = useAnimatedStyle(() => ({ opacity: Math.min(1, (pop.get() - 0.6) / 0.25), transform: [{ scale: pop.get() }] }));
  const tick = useAnimatedProps(() => ({ strokeDashoffset: TICK_LENGTH * (1 - draw.get()) }));
  const inner = (size * 2) / 3;
  return (
    <Animated.View
      testID="success-check"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.successSoft }, circle]}
    >
      <View style={[styles.center, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.success }]}>
        <Svg width={inner * 0.55} height={inner * 0.55} viewBox="0 0 24 24">
          <AnimatedPath
            d={TICK}
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={TICK_LENGTH}
            animatedProps={tick}
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
