import type { PropertyCard } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { Scale } from 'lucide-react-native';
import { type ComponentRef, useRef } from 'react';
import { type StyleProp, StyleSheet, type View, type ViewStyle } from 'react-native';
import { PressableScale } from '@/components/pressable-scale';
import { toast } from '@/components/toast';
import { m, useT } from '@/core/i18n';
import { haptic } from '@/core/motion/haptics';
import { useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { COMPARE_MAX } from '@maqar/shared';
import { useCompare } from '../store/compare.store';
import { useCompareFlight } from '../store/compare-flight';

/** The scale over a home's photo (contract §8.10). For guests and clients, like the heart. */
export function CompareButton({ card, size = 40, style }: { card: PropertyCard; size?: number; style?: StyleProp<ViewStyle> }) {
  const otherRole = useSession((s) => !!s.user && s.user.role !== 'client');
  if (otherRole) return null;
  return <Toggle card={card} size={size} style={style} />;
}

/**
 * Adding a home to compare or taking it off, with the buzz and the toast. `from` is where the bar's
 * new thumbnail flies in from (a point on screen), when there is one.
 */
export function useCompareToggle(card: PropertyCard) {
  const t = useT();
  const router = useRouter();
  const on = useCompare((s) => s.homes.some((h) => h.id === card.id));
  const toggle = useCompare((s) => s.toggle);

  const press = (from?: (land: (point: { x: number; y: number }) => void) => void) => {
    const result = toggle({ id: card.id, cover: card.cover });
    if (result === 'removed') {
      haptic.select();
      return;
    }
    haptic.tap();
    // The bar's new thumbnail flies in from here (2026-11-16).
    from?.((point) => useCompareFlight.getState().launch(card.id, point));
    if (useCompare.getState().homes.length < COMPARE_MAX) {
      toast.show({
        title: t(m.compare.addedToCompare),
        body: t(m.compare.pickOneMoreHomeTo),
        tone: 'sage',
      });
      return;
    }
    toast.show({
      title: t(m.compare.readyToCompare),
      body:
        result === 'replaced'
          ? t(m.compare.weSwappedOutTheOldest)
          : t(m.compare.tapToSeeThemSide),
      tone: 'sage',
      onPress: () => router.push('/compare'),
    });
  };
  return { on, press };
}

function Toggle({ card, size, style }: { card: PropertyCard; size: number; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const { colors } = useTheme();
  const { on, press: toggle } = useCompareToggle(card);
  const button = useRef<ComponentRef<typeof View>>(null);
  const press = () => toggle((land) => button.current?.measureInWindow((x, y, w, h) => land({ x: x + w / 2, y: y + h / 2 })));

  return (
    <PressableScale
      ref={button}
      accessibilityRole="button"
      accessibilityLabel={on ? t(m.compare.removeFromCompare) : t(m.common.compare)}
      accessibilityState={{ selected: on }}
      onPress={press}
      hitSlop={6}
      scaleTo={0.88}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }, on && { backgroundColor: colors.accent }, style]}
    >
      <Scale size={18} color={on ? colors.navy : '#fff'} strokeWidth={2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    transitionProperty: ['backgroundColor', 'transform', 'opacity'],
    transitionDuration: 160,
  },
});
