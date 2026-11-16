import { usePreventRemove, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { m, useDir, useT } from '@/core/i18n';
import { type Origin, propertyKey, takeOrigin } from '@/core/motion/card-origin';
import { haptic } from '@/core/motion/haptics';
import { EASE_IN_OUT, EASE_OUT, SETTLE } from '@/core/motion/motion';

export const OPEN_MS = 420;
export const CLOSE_MS = 320;
/** How much of the screen's width the edge swipe must cover to close (or a flick). */
const CLOSE_AT = 0.3;

/**
 * Where the page is drawn at `t` (0 = the card, 1 = the full screen), with `d` (0 to 1) of an edge
 * swipe on top. Without a card it fades and scales in place. Pure, so it can be tested.
 */
export function pageBox(t: number, d: number, origin: Origin | null, w: number, h: number, dirSign: number) {
  'worklet';
  const lift = 1 - 0.12 * d;
  const shift = dirSign * d * w * 0.2;
  if (!origin) {
    return {
      left: 0,
      top: 0,
      width: w,
      height: h,
      opacity: t,
      borderRadius: 28 * d,
      transform: [{ translateX: shift }, { scale: (0.94 + 0.06 * t) * lift }],
    };
  }
  const r = origin.rect;
  return {
    left: r.x * (1 - t),
    top: r.y * (1 - t),
    width: r.width + (w - r.width) * t,
    height: r.height + (h - r.height) * t,
    opacity: 1,
    borderRadius: Math.max(origin.radius * (1 - t), 28 * d),
    transform: [{ translateX: shift }, { scale: lift }],
  };
}

/** The page inside, drawn at full size and scaled down to the box's width, so it never reflows. */
export function pageScale(t: number, origin: Origin | null, w: number) {
  'worklet';
  return origin ? (origin.rect.width + (w - origin.rect.width) * t) / w : 1;
}

/**
 * The listing page grows out of the card that was tapped (2026-11-16): the whole card (photo,
 * price, corners) widens into the page, and leaving shrinks it back into the same card, whichever
 * way it was left (the back button, the phone's back, the swipe). A swipe from the leading edge
 * pulls the page back with the finger and closes it past a third of the screen. Opened without a
 * card, it fades in. With Reduce Motion it just appears.
 *
 * The page is a see-through screen with no animation of its own (root layout), so the list stays
 * drawn behind it.
 */
export function CardGrow({ id, children }: { id: number; children: ReactNode }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const reduced = useReduceMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [origin] = useState(() => takeOrigin(propertyKey(id)));
  const [size, setSize] = useState({ width: window.width, height: window.height });
  const w = useSharedValue(window.width);
  const h = useSharedValue(window.height);
  const p = useSharedValue(0);
  const drag = useSharedValue(0);
  const sign = dir === 'rtl' ? -1 : 1;

  useEffect(() => {
    p.set(reducedRef.current ? 1 : withTiming(1, { duration: OPEN_MS, easing: EASE_OUT }));
  }, [p]);

  // Any way out (back button, the phone's back, the swipe) shrinks into the card first, then
  // carries on with what was asked.
  const [holding, setHolding] = useState(true);
  usePreventRemove(holding && !reduced, ({ repeat }) => {
    const finish = () => {
      setHolding(false);
      repeat();
    };
    drag.set(withTiming(0, { duration: CLOSE_MS, easing: EASE_IN_OUT }));
    p.set(withTiming(0, { duration: CLOSE_MS, easing: EASE_IN_OUT }, () => scheduleOnRN(finish)));
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === size.width && height === size.height) return;
    w.set(width);
    h.set(height);
    setSize({ width, height });
  };

  const box = useAnimatedStyle(() => pageBox(p.get(), drag.get(), origin, w.get(), h.get(), sign));
  const inner = useAnimatedStyle(() => {
    const s = pageScale(p.get(), origin, w.get());
    return { transform: [{ translateX: (-w.get() * (1 - s)) / 2 }, { translateY: (-h.get() * (1 - s)) / 2 }, { scale: s }] };
  });
  const shade = useAnimatedStyle(() => ({ opacity: 0.35 * p.get() * (1 - drag.get()) }));

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const swipe = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-20, 20],
    onUpdate: (e) => {
      drag.set(Math.min(1, Math.max(0, (sign * e.translationX) / w.get())));
    },
    onDeactivate: (e) => {
      if (drag.get() > CLOSE_AT || sign * e.velocityX > 800) {
        scheduleOnRN(haptic.tap);
        scheduleOnRN(goBack);
      } else {
        drag.set(withSpring(0, { ...SETTLE, velocity: (sign * e.velocityX) / w.get() }));
      }
    },
  });

  return (
    <View style={styles.fill} onLayout={onLayout}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shade]} />
      <Animated.View testID="card-grow" style={[styles.box, box]}>
        <Animated.View style={[{ width: size.width, height: size.height }, inner]}>{children}</Animated.View>
      </Animated.View>
      {reduced ? null : (
        <GestureDetector gesture={swipe}>
          <View
            testID="edge-swipe"
            accessibilityLabel={t(m.common.back)}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.edge, { top: insets.top + 64 }]}
          />
        </GestureDetector>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  shade: { backgroundColor: '#000' },
  box: { position: 'absolute', overflow: 'hidden' },
  // `start`: the leading edge, the right one in Arabic.
  edge: { position: 'absolute', start: 0, bottom: 0, width: 22 },
});
