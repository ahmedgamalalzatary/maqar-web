import type { PropertyCard } from '@maqar/shared';
import { Heart } from 'lucide-react-native';
import { Pressable, type StyleProp, StyleSheet, type ViewStyle } from 'react-native';
import { useT } from '@/core/i18n';
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
  const { saved, toggle } = useToggleSaved(card);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? t('شيل من المحفوظة', 'Remove from saved') : t('احفظ الوحدة', 'Save home')}
      accessibilityState={{ selected: saved }}
      onPress={() => requireAuth(toggle)}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2, transform: [{ scale: pressed ? 0.9 : 1 }] },
        style,
      ]}
    >
      <Heart size={19} color={saved ? colors.danger : '#fff'} fill={saved ? colors.danger : 'transparent'} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
});
