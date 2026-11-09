import type { PropertyCard } from '@maqar/shared';
import { Bell, BellRing } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Toggle } from '@/components/toggle';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSession } from '@/features/auth/store/session.store';
import { useToggleAlert } from '../hooks/use-alerts';

/** Price alerts are for clients, and not for stays (their price is per night). */
function useCanFollow(card: PropertyCard) {
  const otherRole = useSession((s) => !!s.user && s.user.role !== 'client');
  return !otherRole && card.category !== 'stay';
}

/** "Alert on drop" / "Following" beside the price on the property page (contract §8.9). Guests are asked to sign in. */
export function FollowPriceButton({ card }: { card: PropertyCard }) {
  if (!useCanFollow(card)) return null;
  return <FollowButton card={card} />;
}

function FollowButton({ card }: { card: PropertyCard }) {
  const t = useT();
  const { colors } = useTheme();
  const requireAuth = useRequireAuth();
  const { following, toggle } = useToggleAlert(card);
  const Icon = following ? BellRing : Bell;
  const label = following ? t('متابع السعر', 'Following') : t('نبهني لو نزل', 'Alert on drop');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('تنبيه لو سعر الوحدة نزل', 'Get an alert if the price drops')}
      accessibilityState={{ selected: following }}
      onPress={() => requireAuth(toggle)}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: following ? colors.accent : colors.accentSoft, transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}
    >
      <Icon size={16} color={following ? colors.navy : colors.accentInk} />
      <Txt size={12} weight="semibold" style={{ color: following ? colors.navy : colors.accentInk }}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** The on/off switch for a home in Saved's "Price alerts" list. */
export function AlertSwitch({ card }: { card: PropertyCard }) {
  const t = useT();
  const { following, toggle } = useToggleAlert(card);
  return <Toggle label={t('تنبيه السعر', 'Price alert')} value={following} onChange={toggle} />;
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, borderRadius: radius.md, paddingHorizontal: 12 },
});
