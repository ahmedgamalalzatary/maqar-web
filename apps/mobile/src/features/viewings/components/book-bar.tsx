import { fmtMoney, type PropertyCard } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';

/** The bar's height above the bottom safe area, so the page can leave room for it. */
export const BOOK_BAR_HEIGHT = 76;

/** Whether the property page shows the bar: not for stays (no viewings) or staff (they do not book). */
export function useShowsBookBar(card: PropertyCard): boolean {
  const staff = useSession((s) => !!s.user && s.user.role !== 'client');
  return !staff && card.category !== 'stay';
}

/**
 * The property page's bottom bar (contract §8.5, §8.7): the price and "Book a viewing". Anyone can
 * open the booking screen and see the times; confirming asks a guest to sign in.
 */
export function BookBar({ card }: { card: PropertyCard }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const suffix = card.category === 'rent' ? t('/ شهر', '/ mo') : '';
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.line, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.price}>
        <Txt size={16} weight="semibold" numberOfLines={1}>
          {fmtMoney(card.price, lang)}
          {suffix ? (
            <Txt size={11} color="ink3">
              {' '}
              {suffix}
            </Txt>
          ) : null}
        </Txt>
      </View>
      <Button label={t('احجز معاينة', 'Book a viewing')} onPress={() => router.push(`/property/${card.id}/book`)} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  price: { flexShrink: 1 },
  button: { flex: 1 },
});
