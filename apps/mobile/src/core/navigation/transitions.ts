import type { Animated } from 'react-native';
import { Platform } from 'react-native';

type Dir = 'rtl' | 'ltr';

/**
 * How a page comes in (2026-11-16): one slide for the whole app, from the side the reader moves
 * towards, so in Arabic it comes from the left. Android gets the iOS-style push (the old page drifts
 * a little); iOS keeps its own push, which also gives the swipe back.
 */
export function pushAnimation(dir: Dir) {
  if (Platform.OS === 'ios') return dir === 'rtl' ? ('slide_from_left' as const) : ('default' as const);
  return dir === 'rtl' ? ('ios_from_left' as const) : ('ios_from_right' as const);
}

/** The stack options every stack shares: no header, the push above. */
export const stackOptions = (dir: Dir) => ({ headerShown: false, animation: pushAnimation(dir) });

/** Something you fill in and leave (sign-in, booking): it rises from the bottom. */
export const RISE = { animation: 'slide_from_bottom' as const };

/**
 * Switching tabs: the new tab fades in while sliding a little from the side of its tab, mirrored
 * in Arabic. The library's own "shift" always slides as if left-to-right.
 */
export function tabShift(dir: Dir) {
  const d = dir === 'rtl' ? -40 : 40;
  return ({ current }: { current: { progress: Animated.AnimatedInterpolation<number> } }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 1, 0] }),
      transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-d, 0, d] }) }],
    },
  });
}
