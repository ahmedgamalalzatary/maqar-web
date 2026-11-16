import { type ComponentRef, type RefObject, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { create } from 'zustand';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { haptic } from '@/core/motion/haptics';
import { EASE_IN_OUT, EASE_OUT } from '@/core/motion/motion';
import { dark, light, type Scheme } from '@/core/theme';

type Point = { x: number; y: number };
type Wave = { id: number; at: Point; to: Scheme; apply: () => void };

const useWave = create<{ wave: Wave | null }>(() => ({ wave: null }));
let hosts = 0;
let nextId = 1;

export const SPREAD_MS = 460;
export const FADE_MS = 260;

/**
 * The radius that covers the whole screen from `at`: the distance to the farthest corner.
 * Pure, so it can be tested.
 */
export function coverRadius(at: Point, w: number, h: number) {
  return Math.ceil(Math.hypot(Math.max(at.x, w - at.x), Math.max(at.y, h - at.y)));
}

/**
 * Switches light and dark with the new colour taking over the screen (2026-11-16): a circle of the
 * new page colour spreads from `at` (the button pressed) until it covers everything, the theme
 * changes under it, and it fades to show the app in its new colours. `apply` makes the change (and
 * saves it). Without a host on screen, or with Reduce Motion, it simply applies.
 */
export function switchTheme(to: Scheme, at: Point | null, apply: () => void) {
  if (!hosts || !at) return apply();
  haptic.tap();
  useWave.setState({ wave: { id: nextId++, at, to, apply } });
}

/** The same, spreading from the middle of the view in `ref` (the switch or button pressed). */
export function switchThemeFrom(ref: RefObject<ComponentRef<typeof View> | null>, to: Scheme, apply: () => void) {
  const view = ref.current;
  if (!hosts || !view?.measureInWindow) return apply();
  view.measureInWindow((x, y, w, h) => switchTheme(to, w > 0 ? { x: x + w / 2, y: y + h / 2 } : null, apply));
}

/** Render once, at the root of the app, over everything else. */
export function ThemeSwitchHost() {
  const wave = useWave((s) => s.wave);
  useEffect(() => {
    hosts += 1;
    return () => {
      hosts -= 1;
    };
  }, []);
  return wave ? <Spread key={wave.id} wave={wave} /> : null;
}

function Spread({ wave }: { wave: Wave }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReduceMotion();
  const r = coverRadius(wave.at, width, height);
  const grow = useSharedValue(0);
  const fade = useSharedValue(1);
  const color = (wave.to === 'dark' ? dark : light).bg;

  useEffect(() => {
    const done = () => useWave.setState((s) => (s.wave?.id === wave.id ? { wave: null } : s));
    const covered = () => {
      wave.apply();
      // Let the app draw itself in the new colours under the cover, then lift it.
      fade.set(withDelay(80, withTiming(0, { duration: FADE_MS, easing: EASE_OUT }, () => scheduleOnRN(done))));
    };
    if (reduced) {
      wave.apply();
      done();
      return;
    }
    grow.set(withTiming(1, { duration: SPREAD_MS, easing: EASE_IN_OUT }, () => scheduleOnRN(covered)));
  }, [wave, reduced, grow, fade]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: grow.get() }] }));
  const layer = useAnimatedStyle(() => ({ opacity: fade.get() }));

  return (
    // Holds every touch until the switch is done.
    <Animated.View testID="theme-switch" style={[StyleSheet.absoluteFill, styles.top, layer]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[styles.circle, { left: wave.at.x - r, top: wave.at.y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: color }, circle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { zIndex: 1000, elevation: 1000, overflow: 'hidden' },
  circle: { position: 'absolute' },
});
