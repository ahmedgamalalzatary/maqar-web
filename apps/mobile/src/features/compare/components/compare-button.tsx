import type { PropertyCard } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { Scale } from 'lucide-react-native';
import { type ComponentRef, useRef } from 'react';
import { type StyleProp, StyleSheet, type View, type ViewStyle } from 'react-native';
import { PressableScale } from '@/components/pressable-scale';
import { toast } from '@/components/toast';
import { useT } from '@/core/i18n';
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

function Toggle({ card, size, style }: { card: PropertyCard; size: number; style?: StyleProp<ViewStyle> }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const on = useCompare((s) => s.homes.some((h) => h.id === card.id));
  const toggle = useCompare((s) => s.toggle);
  const button = useRef<ComponentRef<typeof View>>(null);

  const press = () => {
    const result = toggle({ id: card.id, cover: card.cover });
    if (result === 'removed') {
      haptic.select();
      return;
    }
    haptic.tap();
    // The bar's new thumbnail flies in from here (2026-11-16).
    button.current?.measureInWindow((x, y, w, h) => useCompareFlight.getState().launch(card.id, { x: x + w / 2, y: y + h / 2 }));
    if (useCompare.getState().homes.length < COMPARE_MAX) {
      toast.show({
        title: t('اتضافت للمقارنة', 'Added to compare'),
        body: t('اختار وحدة تانية عشان تقارن.', 'Pick one more home to compare.'),
        tone: 'sage',
      });
      return;
    }
    toast.show({
      title: t('جاهزين للمقارنة', 'Ready to compare'),
      body:
        result === 'replaced'
          ? t('استبدلنا أقدم وحدة. دوس هنا عشان تقارن.', 'We swapped out the oldest one. Tap to compare.')
          : t('دوس هنا عشان تشوفهم جنب بعض.', 'Tap to see them side by side.'),
      tone: 'sage',
      onPress: () => router.push('/compare'),
    });
  };

  return (
    <PressableScale
      ref={button}
      accessibilityRole="button"
      accessibilityLabel={on ? t('شيل من المقارنة', 'Remove from compare') : t('قارن', 'Compare')}
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
