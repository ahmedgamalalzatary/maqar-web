import type { PropertyCard } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { Scale } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { toast } from '@/components/toast';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { COMPARE_MAX } from '@maqar/shared';
import { useCompare } from '../store/compare.store';

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

  const press = () => {
    const result = toggle({ id: card.id, cover: card.cover });
    if (result === 'removed') return;
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={on ? t('شيل من المقارنة', 'Remove from compare') : t('قارن', 'Compare')}
      accessibilityState={{ selected: on }}
      onPress={press}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2, transform: [{ scale: pressed ? 0.9 : 1 }] },
        on && { backgroundColor: colors.accent },
        style,
      ]}
    >
      <Scale size={18} color={on ? colors.navy : '#fff'} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
});
