import { useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import Animated, { FadeOutUp, SlideInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { EASE_IN_OUT, EASE_OUT } from '@/core/motion/motion';
import { useTheme } from '@/core/theme';
import { Logo } from './logo';

/** Long enough for the logo to finish building, however fast the refresh is. */
export const MIN_SHOW_MS = 900;
const DROP_IN = SlideInUp.duration(260).easing(EASE_OUT);
const LIFT_OUT = FadeOutUp.duration(200).easing(EASE_OUT);

/**
 * Pull to refresh with the Maqar logo (2026-11-16). The list still uses the phone's own pull (so
 * it feels native and works with screen readers), with its spinner made see-through; while it
 * refreshes, the logo drops in at the top, builds itself, breathes until the list is fresh, and
 * lifts away. `top` is where it sits over the list. With Reduce Motion the phone's spinner stays.
 */
export function useLogoRefresh({ refreshing, onRefresh, top = 8 }: { refreshing: boolean; onRefresh: () => void; top?: number }) {
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  // Once a refresh ends, the logo lingers until it has been up MIN_SHOW_MS, so it can finish building.
  const [lingering, setLingering] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!refreshing) return;
    const start = Date.now();
    clearTimeout(timer.current);
    return () => {
      setLingering(true);
      timer.current = setTimeout(() => setLingering(false), Math.max(0, MIN_SHOW_MS - (Date.now() - start)));
    };
  }, [refreshing]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const shown = refreshing || lingering;

  const hide = reduced ? {} : { tintColor: 'transparent', colors: ['transparent'], progressBackgroundColor: 'transparent' };
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} {...hide} />;
  const indicator = shown && !reduced ? <RefreshMark top={top} /> : null;
  return { refreshControl, indicator };
}

function RefreshMark({ top }: { top: number }) {
  const { colors } = useTheme();
  const breath = useSharedValue(1);
  useEffect(() => {
    breath.set(withRepeat(withSequence(withTiming(0.55, { duration: 700, easing: EASE_IN_OUT }), withTiming(1, { duration: 700, easing: EASE_IN_OUT })), -1));
  }, [breath]);
  const breathing = useAnimatedStyle(() => ({ opacity: breath.get() }));
  return (
    <Animated.View
      testID="logo-refresh"
      entering={DROP_IN}
      exiting={LIFT_OUT}
      pointerEvents="none"
      style={[styles.wrap, { top, backgroundColor: colors.surface, borderColor: colors.line }]}
    >
      <Animated.View style={breathing}>
        <Logo width={48} animated />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
