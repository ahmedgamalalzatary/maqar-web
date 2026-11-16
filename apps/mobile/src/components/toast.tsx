import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASE_OUT } from '@/core/motion/motion';
import { create } from 'zustand';
import { radius, useTheme } from '@/core/theme';
import { Txt } from './text';

type Tone = 'gold' | 'sage' | 'danger';
export type ToastInput = { title: string; body?: string; tone?: Tone; onPress?: () => void };
type Shown = ToastInput & { id: number };

const SHOW_MS = 3500;
// It leaves the way it came, a little faster (2026-11-16).
const TOAST_IN = FadeInUp.duration(260).easing(EASE_OUT);
const TOAST_OUT = FadeOutUp.duration(200).easing(EASE_OUT);

const useToast = create<{ current: Shown | null }>(() => ({ current: null }));
let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;

/** Quick feedback (contract §12). One toast at a time; a new one replaces the old. */
export const toast = {
  show(input: ToastInput) {
    clearTimeout(timer);
    const id = nextId++;
    useToast.setState({ current: { ...input, id } });
    timer = setTimeout(() => {
      if (useToast.getState().current?.id === id) useToast.setState({ current: null });
    }, SHOW_MS);
  },
  clear() {
    clearTimeout(timer);
    useToast.setState({ current: null });
  },
};

/** Render once, at the root of the app. */
export function ToastHost() {
  const current = useToast((s) => s.current);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!current) return null;
  const dot = { gold: colors.accent, sage: colors.sage, danger: colors.danger }[current.tone ?? 'gold'];
  return (
    <Animated.View key={current.id} entering={TOAST_IN} exiting={TOAST_OUT} pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={() => {
          current.onPress?.();
          toast.clear();
        }}
        style={[styles.toast, { backgroundColor: colors.navy }]}
      >
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <View style={styles.text}>
          <Txt weight="semibold" size={14} style={{ color: colors.cream }}>
            {current.title}
          </Txt>
          {current.body ? (
            <Txt size={12.5} style={{ color: colors.cream, opacity: 0.75 }}>
              {current.body}
            </Txt>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16, zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1 },
});
