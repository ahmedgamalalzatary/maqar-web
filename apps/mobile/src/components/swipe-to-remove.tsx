import { Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { projected } from '@/core/motion/drag';
import { haptic } from '@/core/motion/haptics';
import { EASE_OUT, SETTLE } from '@/core/motion/motion';
import { radius, useTheme } from '@/core/theme';
import { Txt } from './text';

/** Whether letting go here removes the row: past 35% of its width either way, counting the flick. */
export function swipeRemoves(x: number, velocity: number, width: number): boolean {
  'worklet';
  return Math.abs(x + projected(velocity)) > width * 0.35 && Math.sign(x) === Math.sign(x + projected(velocity));
}

/**
 * A row that can be swiped off sideways (2026-11-16). It follows the finger over a red "remove"
 * layer; let go far enough (or flicked) and it slides away, then `onRemove` runs; otherwise it
 * springs back. A small buzz marks the point where letting go will remove it. Vertical scrolling
 * wins over a mostly-vertical drag. With Reduce Motion there is no swipe (the row's own buttons remain).
 */
export function SwipeToRemove({ label, onRemove, children }: { label: string; onRemove: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const reduced = useReduceMotion();
  const x = useSharedValue(0);
  const width = useSharedValue(360);
  const past = useSharedValue(0);
  const gone = useSharedValue(0);

  const pan = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      x.set(e.translationX);
      const over = Math.abs(e.translationX) > width.get() * 0.35 ? 1 : 0;
      if (over !== past.get()) {
        past.set(over);
        if (over) scheduleOnRN(haptic.select);
      }
    },
    onDeactivate: (e) => {
      past.set(0);
      if (swipeRemoves(x.get(), e.velocityX, width.get())) {
        const to = Math.sign(x.get()) * (width.get() + 24);
        x.set(
          withTiming(to, { duration: 200, easing: EASE_OUT }, () => {
            gone.set(1);
            scheduleOnRN(onRemove);
          }),
        );
      } else {
        x.set(withSpring(0, { ...SETTLE, velocity: e.velocityX }));
      }
    },
  });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const under = useAnimatedStyle(() => ({ opacity: gone.get() ? 0 : interpolate(Math.abs(x.get()), [0, 40], [0, 1], 'clamp') }));
  const bin = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(Math.abs(x.get()), [40, width.get() * 0.35], [0.7, 1.1], 'clamp') }] }));
  const onLayout = (e: LayoutChangeEvent) => width.set(e.nativeEvent.layout.width);

  if (reduced) return <>{children}</>;
  return (
    <View onLayout={onLayout}>
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: colors.danger }, under]}
      >
        {/* A bin on each side: the row covers one, the swipe uncovers the other. */}
        {[0, 1].map((k) => (
          <Animated.View key={k} style={[styles.bin, bin]}>
            <Trash2 size={22} color="#fff" />
            <Txt size={13} weight="semibold" style={styles.white}>
              {label}
            </Txt>
          </Animated.View>
        ))}
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View testID="swipe-row" style={row}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  under: { borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  bin: { alignItems: 'center', gap: 4 },
  white: { color: '#fff' },
});
