import type { PropertyCard } from '@mqr/shared';
import { Heart } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { PressableScale } from '@/components/pressable-scale';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { m, useT } from '@/core/i18n';
import { haptic } from '@/core/motion/haptics';
import { EASE_OUT } from '@/core/motion/motion';
import { useTheme } from '@/core/theme';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSession } from '@/features/auth/store/session.store';
import { useToggleSaved } from '../hooks/use-saved';

/** The heart over a home's photo. Guests are asked to sign in; other roles have no saved homes, so no heart. */
export function SaveButton({ card, size = 40, style }: { card: PropertyCard; size?: number; style?: StyleProp<ViewStyle> }) {
  const otherRole = useSession((s) => !!s.user && s.user.role !== 'client');
  if (otherRole) return null;
  return <ToggleHeart card={card} size={size} style={style} />;
}

function ToggleHeart({ card, size, style }: { card: PropertyCard; size: number; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const { colors } = useTheme();
  const requireAuth = useRequireAuth();
  const reduced = useReduceMotion();
  const { saved, toggle } = useToggleSaved(card);
  // Each save gets a fresh burst; taking the home off clears it.
  const [burst, setBurst] = useState(0);
  const pop = useSharedValue(1);
  const heart = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  const press = () =>
    requireAuth(() => {
      if (saved) {
        haptic.select();
        setBurst(0);
      } else {
        // The pop, the burst and the tick land in the same frame (2026-11-16).
        haptic.tap();
        pop.set(withSequence(withTiming(1.3, { duration: 110, easing: EASE_OUT }), withSpring(1, { duration: 350, dampingRatio: 0.45 })));
        if (!reduced) setBurst((n) => n + 1);
      }
      toggle();
    });

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={saved ? t(m.saved.removeFromSaved) : t(m.saved.saveHome)}
      accessibilityState={{ selected: saved }}
      onPress={press}
      hitSlop={6}
      scaleTo={0.88}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      {burst ? <Burst key={burst} color={colors.danger} glint={colors.gold} /> : null}
      <Animated.View style={heart}>
        <Heart size={19} color={saved ? colors.danger : '#fff'} fill={saved ? colors.danger : 'transparent'} strokeWidth={2} />
      </Animated.View>
    </PressableScale>
  );
}

const DOTS = 8;
const RADIUS = 26;

/** Eight dots thrown out from the heart, alternating red and gold, fading as they go. */
function Burst({ color, glint }: { color: string; glint: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: 520, easing: EASE_OUT }));
  }, [p]);
  return (
    <View testID="heart-burst" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.burst}>
      {Array.from({ length: DOTS }, (_, i) => (
        <Dot key={i} p={p} angle={(i / DOTS) * Math.PI * 2} color={i % 2 ? glint : color} />
      ))}
    </View>
  );
}

function Dot({ p, angle, color }: { p: SharedValue<number>; angle: number; color: string }) {
  const style = useAnimatedStyle(() => {
    const d = RADIUS * p.get();
    return {
      opacity: p.get() < 0.15 ? p.get() / 0.15 : 1 - (p.get() - 0.15) / 0.85,
      transform: [{ translateX: Math.cos(angle) * d }, { translateY: Math.sin(angle) * d }, { scale: 1 - p.get() * 0.5 }],
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  button: { backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  burst: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});
