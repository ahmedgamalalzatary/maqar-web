import { useEffect } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { usePanGesture } from 'react-native-gesture-handler';
import { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { rubberband, shouldDismiss } from '@/core/motion/drag';
import { haptic } from '@/core/motion/haptics';
import { EASE_OUT, SETTLE } from '@/core/motion/motion';

/**
 * Drag a bottom sheet down to close it (2026-11-16). The sheet follows the finger down, resists
 * going up, and on release closes on a flick or a long drag, or springs home with the finger's
 * speed. Put `pan` on the sheet's handle and title (not its scrolling body), `sheet` on the sheet,
 * `backdrop` on the dimmed layer, and `onLayout` on the sheet so it knows its height.
 */
export function useDragToClose(open: boolean, onClose: () => void) {
  const y = useSharedValue(0);
  const height = useSharedValue(600);
  // Each opening starts in place, whatever the last one ended on.
  useEffect(() => {
    if (open) y.set(0);
  }, [open, y]);

  const pan = usePanGesture({
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      y.set(e.translationY > 0 ? e.translationY : rubberband(e.translationY, height.get()));
    },
    onDeactivate: (e) => {
      if (shouldDismiss(y.get(), e.velocityY, height.get())) {
        y.set(
          withTiming(height.get(), { duration: 200, easing: EASE_OUT }, (done) => {
            if (done) scheduleOnRN(onClose);
          }),
        );
      } else {
        if (y.get() > 24) scheduleOnRN(haptic.tap);
        y.set(withSpring(0, { ...SETTLE, velocity: e.velocityY }));
      }
    },
  });

  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [0, height.get()], [1, 0], 'clamp') }));
  const onLayout = (e: LayoutChangeEvent) => height.set(e.nativeEvent.layout.height);
  return { pan, sheet, backdrop, onLayout };
}
