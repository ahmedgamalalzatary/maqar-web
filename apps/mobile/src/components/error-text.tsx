import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { haptic } from '@/core/motion/haptics';
import { Txt } from './text';

const STEP = { duration: 45 };

/**
 * A form's error line (2026-11-16): it shakes once and buzzes when a new message comes in, the
 * way a wrong code or password feels on the phone. Reanimated skips the shake when the phone asks
 * for less motion; the red text still says what went wrong.
 */
export function ErrorText({ message, trigger }: { message: string | undefined; trigger?: unknown }) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (!message) return;
    haptic.error();
    x.set(withSequence(withTiming(-8, STEP), withTiming(8, STEP), withTiming(-6, STEP), withTiming(6, STEP), withTiming(0, STEP)));
    // `trigger` (the attempt's time) shakes it again when the same error comes back.
  }, [message, trigger, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  if (!message) return null;
  return (
    <Animated.View testID="error-text" accessibilityLiveRegion="polite" style={style}>
      <Txt color="danger">{message}</Txt>
    </Animated.View>
  );
}
