import { type ComponentRef, type Ref, useState } from 'react';
import { Pressable, type PressableProps, type StyleProp, StyleSheet, type View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { CSS_EASE_OUT, PRESS_MS } from '@/core/motion/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** How far it shrinks while held: 0.97 for cards and buttons, lower for small round icons. */
  scaleTo?: number;
  ref?: Ref<ComponentRef<typeof View>>;
};

/**
 * A pressable that gives under the finger (2026-11-16): it shrinks on press-in, in 120ms, and
 * comes back on release, so the tap feels physical before anything else happens. With less
 * motion asked for, it dims instead. The transition runs on the UI thread.
 */
export function PressableScale({ ref, style, scaleTo = 0.97, onPressIn, onPressOut, pressRetentionOffset = 16, ...rest }: PressableScaleProps) {
  const reduced = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const held = pressed && !rest.disabled;
  return (
    <AnimatedPressable
      ref={ref}
      {...rest}
      pressRetentionOffset={pressRetentionOffset}
      onPressIn={(e) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={[
        style,
        styles.motion,
        reduced ? { opacity: held ? 0.8 : StyleSheet.flatten(style)?.opacity ?? 1 } : { transform: [{ scale: held ? scaleTo : 1 }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  motion: {
    transitionProperty: ['transform', 'opacity'],
    transitionDuration: PRESS_MS,
    transitionTimingFunction: CSS_EASE_OUT,
  },
});
