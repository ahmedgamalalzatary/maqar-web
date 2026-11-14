import type { Scale } from '@maqar/shared';
import { useRef, useState } from 'react';
import { type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { thumbResponder, thumbStyle } from '@/components/slider-thumb';
import { useDir } from '@/core/i18n';
import { useTheme } from '@/core/theme';

const THUMB = 30;

/**
 * To the nearest multiple of the step, kept inside the scale. A minimum off the grid (a least down
 * payment of 11%) is its own first stop: 11, then 15, 20…; a minimum on the grid works as before.
 */
const snap = (v: number, { min, max, step }: Scale) => Math.min(max, Math.max(min, Math.round(v / step) * step));

/**
 * A one-thumb slider for the budget (contract §8.1). The thumb sits at a physical `left`,
 * mirrored for Arabic in code, like the filter sheet's range slider. It is an adjustable
 * control for screen readers.
 */
export function BudgetSlider({
  scale,
  value,
  onChange,
  label,
  valueText,
}: {
  scale: Scale;
  value: number;
  onChange: (v: number) => void;
  label: string;
  valueText: string;
}) {
  const { colors } = useTheme();
  const rtl = useDir() === 'rtl';
  const [width, setWidth] = useState(0);
  const track = Math.max(1, width - THUMB);
  const { min, max, step } = scale;
  // Where the finger went down and the value then. Only the touch handlers use it.
  const drag = useRef({ x: 0, from: 0 });

  const ratio = (Math.min(max, Math.max(min, value)) - min) / (max - min);
  const x = (rtl ? 1 - ratio : ratio) * track;

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') onChange(snap(value + step, scale));
    if (e.nativeEvent.actionName === 'decrement') onChange(snap(value - step, scale));
  };

  return (
    <View style={styles.area} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.rail, { backgroundColor: colors.surface3 }]} />
      <View
        style={[
          styles.fill,
          rtl ? { left: x + THUMB / 2, right: THUMB / 2 } : { left: THUMB / 2, width: x },
          { backgroundColor: colors.accent },
        ]}
      />
      <View
        {...thumbResponder()}
        onResponderGrant={(e: GestureResponderEvent) => {
          drag.current = { x: e.nativeEvent.pageX, from: value };
        }}
        onResponderMove={(e: GestureResponderEvent) => {
          const dx = e.nativeEvent.pageX - drag.current.x;
          onChange(snap(drag.current.from + ((rtl ? -dx : dx) / track) * (max - min), scale));
        }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value, text: valueText }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        hitSlop={12}
        style={[styles.thumb, thumbStyle(), { left: x, backgroundColor: colors.surface, borderColor: colors.accent }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  area: { height: 44, justifyContent: 'center' },
  rail: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 6, borderRadius: 3 },
  fill: { position: 'absolute', height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute',
    top: (44 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    shadowColor: '#041525',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
