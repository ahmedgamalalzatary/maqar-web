import type { Scale } from '@maqar/shared';
import { useMemo, useRef, useState } from 'react';
import { type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { useDir } from '@/core/i18n';
import { useTheme } from '@/core/theme';

const THUMB = 28;

type Props = {
  scale: Scale;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  /** Histogram bars over the scale, from the API. */
  counts?: number[];
  /** Spoken names of the two thumbs, e.g. "أقل سعر" and "أعلى سعر". */
  minLabel: string;
  maxLabel: string;
  /** Spoken value of a thumb. */
  valueText: (v: number) => string;
  testID?: string;
};

const snap = (v: number, { min, step }: Scale) => min + Math.round((v - min) / step) * step;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Moves one thumb to `next`, on a step, without passing the other thumb. */
function move(which: 0 | 1, next: number, [a, b]: [number, number], change: Props['onChange'], s: Scale) {
  const v = snap(next, s);
  if (which === 0) change([clamp(v, s.min, b - s.step), b]);
  else change([a, clamp(v, a + s.step, s.max)]);
}

/**
 * Two-thumb range slider over a histogram (contract §8.4). The bars inside the range are
 * highlighted. The thumbs sit at a physical `left`, mirrored for Arabic in code, which behaves the
 * same on phones and the web. Each thumb is an adjustable control for screen readers.
 */
export function RangeSlider({ scale, value, onChange, counts, minLabel, maxLabel, valueText, testID }: Props) {
  const { colors } = useTheme();
  const rtl = useDir() === 'rtl';
  const [width, setWidth] = useState(0);
  const track = Math.max(1, width - THUMB);
  const { min, max, step } = scale;
  const [lo, hi] = value;

  // Where the finger went down and the thumb's value then. Only the touch handlers use it.
  const drag = useRef({ x: 0, from: 0 });

  /** Touch handlers for one thumb: the thumb follows the finger, mirrored in Arabic. */
  const touch = (which: 0 | 1) => ({
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => {
      drag.current = { x: e.nativeEvent.pageX, from: value[which] };
    },
    onResponderMove: (e: GestureResponderEvent) => {
      const dx = e.nativeEvent.pageX - drag.current.x;
      move(which, drag.current.from + ((rtl ? -dx : dx) / track) * (max - min), value, onChange, scale);
    },
  });

  const ratio = (v: number) => (v - min) / (max - min);
  /** Distance of a value from the physical left edge. */
  const x = (v: number) => (rtl ? 1 - ratio(v) : ratio(v)) * track;

  const onAction = (which: 0 | 1) => (e: AccessibilityActionEvent) => {
    const current = value[which];
    if (e.nativeEvent.actionName === 'increment') move(which, current + step, value, onChange, scale);
    if (e.nativeEvent.actionName === 'decrement') move(which, current - step, value, onChange, scale);
  };

  const bars = useMemo(() => {
    if (!counts?.length) return null;
    const top = Math.max(...counts, 1);
    const n = counts.length;
    // A row already runs right to left in Arabic, on phones and the web, so the bars need no flipping.
    return counts.map((c, i) => ({
      height: c ? 18 + (c / top) * 82 : 6,
      on: min + ((max - min) * (i + 1)) / n > lo && min + ((max - min) * i) / n < hi,
    }));
  }, [counts, min, max, lo, hi]);

  const left = Math.min(x(lo), x(hi));
  const right = Math.max(x(lo), x(hi));

  return (
    <View testID={testID} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {bars ? (
        <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {bars.map((b, i) => (
            <View
              key={i}
              style={[styles.bar, { height: `${b.height}%`, backgroundColor: b.on ? colors.accent : colors.surface3 }]}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.trackArea}>
        <View style={[styles.rail, { backgroundColor: colors.surface3 }]} />
        <View style={[styles.fill, { left: left + THUMB / 2, width: right - left, backgroundColor: colors.accent }]} />
        {([0, 1] as const).map((which) => {
          const v = value[which];
          return (
            <View
              key={which}
              {...touch(which)}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={which === 0 ? minLabel : maxLabel}
              accessibilityValue={{ min, max, now: v, text: valueText(v) }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={onAction(which)}
              hitSlop={10}
              style={[
                styles.thumb,
                // The max thumb sits above the min one, unless the min one is pushed to the top end.
                { left: x(v), zIndex: which === 1 || lo >= max - step * 2 ? 2 : 1 },
                { backgroundColor: colors.surface, borderColor: colors.accent },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 48, paddingHorizontal: THUMB / 2 },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  trackArea: { height: 36, justifyContent: 'center' },
  rail: { position: 'absolute', left: THUMB / 2, right: THUMB / 2, height: 6, borderRadius: 3 },
  fill: { position: 'absolute', height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute',
    top: (36 - THUMB) / 2,
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
