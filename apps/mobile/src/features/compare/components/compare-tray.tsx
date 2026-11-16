import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus, Scale, X } from 'lucide-react-native';
import { type ComponentRef, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { m, useT } from '@/core/i18n';
import { BOUNCE, EASE_OUT } from '@/core/motion/motion';
import { radius, useTheme } from '@/core/theme';
import { type PickedHome, useCompare } from '../store/compare.store';
import { flightFor } from '../store/compare-flight';

/** Room a page keeps under its last line while the bar shows: its height and the gap above the tab bar. */
export const COMPARE_TRAY_SPACE = 80;

// Module scope: layout-animation builders made in render cost every re-render.
const TRAY_IN = FadeInDown.duration(260).easing(EASE_OUT);
const TRAY_OUT = FadeOutDown.duration(200).easing(EASE_OUT);

/** The bar above the tab bar while homes are picked (contract §8.10). `bottom` is the tab bar's height. */
export function CompareTray({ bottom }: { bottom: number }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const homes = useCompare((s) => s.homes);
  const clear = useCompare((s) => s.clear);
  // The bar gives a little bounce each time a home lands in it (2026-11-16).
  const bump = useSharedValue(1);
  const count = useRef(homes.length);
  useEffect(() => {
    if (homes.length > count.current) bump.set(withSequence(withTiming(1.04, { duration: 120, easing: EASE_OUT }), withSpring(1, BOUNCE)));
    count.current = homes.length;
  }, [homes.length, bump]);
  const trayStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.get() }] }));

  if (!homes.length) return null;
  const two = homes.length === 2;
  return (
    <Animated.View entering={TRAY_IN} exiting={TRAY_OUT} pointerEvents="box-none" style={[styles.wrap, { bottom: bottom + 8 }]}>
      <Animated.View style={[styles.tray, { backgroundColor: colors.ink }, trayStyle]}>
        <View style={styles.thumbs}>
          {homes.map((h) => (
            <Thumb key={h.id} home={h} border={colors.ink} bg={colors.surface2} />
          ))}
          {two ? null : (
            <View style={[styles.thumb, styles.empty, { borderColor: colors.bg }]}>
              <Plus size={16} color={colors.bg} />
            </View>
          )}
        </View>
        <View style={styles.text}>
          <Txt size={12.5} weight="semibold" style={{ color: colors.bg }}>
            {two ? t(m.compare.n2HomesPicked) : t(m.compare.pickOneMore)}
          </Txt>
          <Txt size={11.5} style={{ color: colors.bg, opacity: 0.6 }}>
            {t(m.compare.toCompareSideBySide)}
          </Txt>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t(m.common.compare)}
          onPress={() => router.push('/compare')}
          style={[styles.go, { backgroundColor: colors.accent }]}
        >
          <Scale size={16} color={colors.navy} />
          <Txt size={13} weight="semibold" style={{ color: colors.navy }}>
            {t(m.common.compare)}
          </Txt>
        </PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel={t(m.compare.clear)} onPress={clear} hitSlop={6} scaleTo={0.88} style={styles.clear}>
          <X size={16} color={colors.bg} opacity={0.6} />
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * A picked home's photo. A home just picked flies in from its scale button, shrinking as it lands;
 * one that was already there (or with less motion asked for) is simply in place.
 */
function Thumb({ home, border, bg }: { home: PickedHome; border: string; bg: string }) {
  const reduced = useReduceMotion();
  const ref = useRef<ComponentRef<typeof View>>(null);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    // Measured after mount, and after the button measured itself (it asked first): start the
    // thumbnail over the button, then let it fly home.
    ref.current?.measureInWindow((x, y, w, h) => {
      const from = flightFor(home.id);
      if (!from) return;
      dx.set(from.x - (x + w / 2));
      dy.set(from.y - (y + h / 2));
      scale.set(1.4);
      dx.set(withSpring(0, { duration: 550, dampingRatio: 0.75 }));
      dy.set(withTiming(0, { duration: 520, easing: EASE_OUT }));
      scale.set(withSpring(1, BOUNCE));
    });
  }, [home.id, reduced, dx, dy, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: dx.get() }, { translateY: dy.get() }, { scale: scale.get() }] }));
  const uri = mediaUrl(home.cover);
  return (
    <Animated.View ref={ref} style={[styles.thumb, { borderColor: border, backgroundColor: bg }, style]}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16 },
  tray: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, padding: 8 },
  thumbs: { flexDirection: 'row', paddingStart: 4 },
  thumb: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', borderWidth: 2, marginEnd: -10 },
  empty: { borderStyle: 'dashed', opacity: 0.4, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, paddingStart: 14 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, borderRadius: 12, paddingHorizontal: 14 },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
