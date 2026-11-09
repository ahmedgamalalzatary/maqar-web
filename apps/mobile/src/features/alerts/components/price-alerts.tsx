import { fmtMoney, fmtPct, type PropertyCard } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { BellRing, TrendingDown } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { dropPct } from '@/features/listings/components/property-card';
import { PropertyRow } from '@/features/listings/components/property-row';
import { useProperties } from '@/features/listings/hooks/use-listings';
import { useAlerts } from '../hooks/use-alerts';
import { AlertSwitch } from './follow-price-button';

/** The old price struck through and the drop %, under a row's price. */
export function DropLine({ card }: { card: PropertyCard }) {
  const lang = useLang();
  const drop = dropPct(card);
  if (!card.oldPrice || drop <= 0) return null;
  return (
    <View style={styles.drop}>
      <Txt size={11.5} color="ink3" style={styles.struck}>
        {fmtMoney(card.oldPrice, lang)}
      </Txt>
      <Txt size={11.5} weight="semibold" color="danger">
        {fmtPct(-drop, lang, 0)}
      </Txt>
    </View>
  );
}

/**
 * Saved's "Price alerts" tab (contract §8.9, as in the demo): the homes the client follows, then
 * other homes whose price just fell, each with its alert switch.
 */
export function PriceAlerts() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const alerts = useAlerts();
  const drops = useProperties({ dropped: true, limit: 20 });

  const followed = alerts.data ?? [];
  const followedIds = new Set(followed.map((c) => c.id));
  const others = (drops.data?.items ?? []).filter((c) => c.category !== 'stay' && !followedIds.has(c.id));
  const list = [...followed, ...others];

  return (
    <View style={styles.wrap}>
      <View style={[styles.intro, { backgroundColor: colors.navy }]}>
        <View style={[styles.introIcon, { backgroundColor: 'rgba(179, 137, 89, 0.2)' }]}>
          <TrendingDown size={20} color={colors.gold} />
        </View>
        <Txt size={13} style={[styles.flex, { color: colors.cream, opacity: 0.85 }]}>
          {t('فعّل التنبيه على أي وحدة، وأول ما السعر ينزل هيوصلك إشعار فوراً.', 'Turn on an alert for any home, and the moment its price drops you get a notification.')}
        </Txt>
      </View>

      {!signedIn ? (
        <Empty
          title={t('سجّل دخولك عشان تتابع الأسعار', 'Sign in to follow prices')}
          body={t('هنبلغك أول ما سعر الوحدة اللي بتتابعها ينزل.', 'We’ll tell you the moment a home you follow gets cheaper.')}
          action={{ label: t('تسجيل الدخول', 'Sign in'), onPress: () => router.push('/sign-in') }}
        />
      ) : alerts.isPending || drops.isPending ? (
        <CardSkeleton />
      ) : alerts.isError ? (
        <ListingsError onRetry={() => void alerts.refetch()} />
      ) : list.length === 0 ? (
        <Empty
          title={t('مفيش تنبيهات أسعار لسه', 'No price alerts yet')}
          body={t('دوس "نبهني لو نزل" في صفحة أي وحدة.', 'Tap “Alert on drop” on any home’s page.')}
          action={{ label: t('استكشف', 'Explore'), onPress: () => router.push('/explore') }}
        />
      ) : (
        list.map((c) => <PropertyRow key={c.id} card={c} sub={<DropLine card={c} />} right={<AlertSwitch card={c} />} />)
      )}
    </View>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action: { label: string; onPress: () => void } }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <BellRing size={32} color={colors.ink3} strokeWidth={1.6} />
      <Txt weight="medium" align="center">
        {title}
      </Txt>
      <Txt size={13} color="ink2" align="center">
        {body}
      </Txt>
      <Button label={action.label} variant="secondary" onPress={action.onPress} style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  intro: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: radius.lg, padding: 16, marginBottom: 6 },
  introIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  struck: { textDecorationLine: 'line-through' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 32, paddingHorizontal: 24 },
  action: { marginTop: 8, paddingHorizontal: 24 },
});
