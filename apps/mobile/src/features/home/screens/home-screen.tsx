import { type Bi, pickField, type Category, fmtMoney, fmtPct, type HomeSection } from '@mqr/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Award, Building2, Calculator, Home as HomeIcon, KeyRound, type LucideIcon, Moon, Palmtree, Search, Sparkles, Sun, TrendingDown } from 'lucide-react-native';
import { Fragment, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useHomeOrder } from '@/core/app-config/store';
import { m, useLang, useT } from '@/core/i18n';
import { Entrance, useEntranceClock } from '@/core/motion/entrance';
import { radius, useTheme } from '@/core/theme';
import { usePreferences } from '@/features/account/hooks/use-account';
import { useSession } from '@/features/auth/store/session.store';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { dropPct, PropertyCardView } from '@/features/listings/components/property-card';
import { PropertyRow } from '@/features/listings/components/property-row';
import { useAreas, useProperties } from '@/features/listings/hooks/use-listings';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { useIsClient, useRecommended } from '@/features/prefs/hooks/use-prefs';
import { MyPrefs } from '../components/my-prefs';
import { NextViewingCard } from '@/features/viewings/components/next-viewing-card';

const SHORTCUTS: { category: Category; icon: LucideIcon; label: Bi }[] = [
  { category: 'sale', icon: HomeIcon, label: m.home.buy },
  { category: 'rent', icon: KeyRound, label: m.home.rent },
  { category: 'project', icon: Building2, label: m.home.projects },
  { category: 'stay', icon: Palmtree, label: m.home.stays },
];

/**
 * Client home (contract §8.2): headline, search entry, category shortcuts, picks for a signed-in
 * client (phase 6), the next viewing (phase 13), areas, price drops (phase 12) and new launches.
 * The headline and the search entry stay on top; an admin orders the rest (phase 29).
 */
export function Home() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const { setTheme } = usePreferences();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const { width } = useWindowDimensions();
  const areas = useAreas();
  const launches = useProperties({ category: 'project', limit: 10 });
  const launchEntrance = useEntranceClock();
  const cardWidth = Math.round(width * 0.72);
  const order = useHomeOrder();

  // Phase 29: an admin sets the order of these; a section with nothing to show renders nothing.
  const sections: Record<HomeSection, ReactNode> = {
    shortcuts: (
      <View style={styles.shortcuts}>
        {SHORTCUTS.map(({ category, icon: Icon, label }) => (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityLabel={t(label)}
            onPress={() => router.push({ pathname: '/explore', params: { category } })}
            style={({ pressed }) => [
              styles.shortcut,
              { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[styles.shortcutIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon size={20} color={colors.accentInk} strokeWidth={1.8} />
            </View>
            <Txt size={12} weight="medium" align="center">
              {t(label)}
            </Txt>
          </Pressable>
        ))}
      </View>
    ),
    nextViewing: <NextViewingCard />,
    featured: <Featured cardWidth={cardWidth} />,
    prefs: <MyPrefs />,
    picks: <Picks cardWidth={cardWidth} />,
    areas: (
      <Section title={t(m.home.browseByArea)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {(areas.data ?? []).map((a) => {
            const name = pickField(a, 'name', lang);
            const img = mediaUrl(a.image);
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={name}
                onPress={() => router.push({ pathname: '/explore', params: { area: a.id } })}
                style={[styles.area, { backgroundColor: colors.surface, borderColor: colors.line }]}
              >
                <View style={[styles.areaImg, { backgroundColor: colors.surface2 }]}>
                  {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                </View>
                <Txt size={13} weight="medium">
                  {name}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </Section>
    ),
    calculator: (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(m.common.workOutYourMonthlyInstallment)}
        onPress={() => router.push('/calculator')}
        style={({ pressed }) => [styles.calculator, { backgroundColor: colors.navy, opacity: pressed ? 0.9 : 1 }]}
      >
        <View style={[styles.calculatorIcon, { backgroundColor: colors.gold }]}>
          <Calculator size={24} color={colors.navy} />
        </View>
        <View style={styles.flex}>
          <Txt size={15} weight="semibold" style={{ color: colors.cream }}>
            {t(m.common.workOutYourMonthlyInstallment)}
          </Txt>
          <Txt size={12.5} style={{ color: colors.cream, opacity: 0.7 }}>
            {t(m.home.downPaymentYearsInstallmentInstantly)}
          </Txt>
        </View>
      </Pressable>
    ),
    drops: <PriceDrops />,
    launches: (
      <Section
        title={t(m.home.newLaunchesOnInstallments)}
        action={{ label: t(m.common.seeAll), onPress: () => router.push({ pathname: '/explore', params: { category: 'project' } }) }}
      >
        {launches.isError ? (
          <ListingsError onRetry={() => launches.refetch()} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {launches.isPending
              ? [0, 1].map((i) => <CardSkeleton key={i} width={cardWidth} />)
              : launches.data.items.map((c, i) => (
                  <Entrance key={c.id} clock={launchEntrance} index={i}>
                    <PropertyCardView card={c} width={cardWidth} />
                  </Entrance>
                ))}
          </ScrollView>
        )}
      </Section>
    ),
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Logo width={64} />
        <View style={styles.flex} />
        <IconButton
          label={scheme === 'dark' ? t(m.home.lightMode) : t(m.common.darkMode)}
          onPress={() => setTheme(scheme === 'dark' ? 'light' : 'dark')}
          icon={
            scheme === 'dark' ? (
              <Sun color={colors.accent} size={20} strokeWidth={1.8} />
            ) : (
              <Moon color={colors.ink} size={20} strokeWidth={1.8} />
            )
          }
        />
        {signedIn ? <NotificationBell /> : null}
      </View>

      <View>
        <Txt accessibilityRole="header" size={28} weight="semibold" style={styles.headline}>
          {t(m.home.findYourHome)}
        </Txt>
        <Txt size={28} weight="semibold" color="accentInk" style={styles.headline}>
          {t(m.home.bookTheViewingYourself)}
        </Txt>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(m.common.areaCompoundOrUnitType)}
        onPress={() => router.push('/explore')}
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}
      >
        <Search size={20} color={colors.ink3} />
        <Txt size={14} color="ink3" style={styles.flex}>
          {t(m.common.areaCompoundOrUnitType)}
        </Txt>
      </Pressable>

      {order.map((name) => (
        <Fragment key={name}>{sections[name]}</Fragment>
      ))}
    </Screen>
  );
}

/**
 * "Picked for you" (contract §8.2, §8.3): a signed-in client's best matches with their reasons.
 * A guest is invited to sign up for them instead.
 */
function Picks({ cardWidth }: { cardWidth: number }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const isClient = useIsClient();
  const picks = useRecommended(isClient);
  const entrance = useEntranceClock();

  if (!isClient) {
    return (
      <View style={[styles.invite, { backgroundColor: colors.navy }]}>
        <View style={styles.inviteHead}>
          <Sparkles size={20} color={colors.gold} />
          <Txt size={16} weight="semibold" style={{ color: colors.cream }}>
            {t(m.home.picksThatFitYou)}
          </Txt>
        </View>
        <Txt size={13} style={{ color: colors.cream, opacity: 0.75 }}>
          {t(m.home.tellUsYourBudgetAnd)}
        </Txt>
        <Button label={t(m.home.getYourPicks)} onPress={() => router.push('/sign-up')} />
      </View>
    );
  }
  if (picks.isSuccess && !picks.data.length) return null;

  return (
    <Section
      title={t(m.home.pickedForYou)}
      icon={<Sparkles size={18} color={colors.accent} />}
      action={{
        label: t(m.common.seeAll),
        a11y: t(m.home.allPicks),
        onPress: () => router.push({ pathname: '/explore', params: { sort: 'match' } }),
      }}
    >
      {picks.isError ? (
        <ListingsError onRetry={() => picks.refetch()} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {picks.isPending
            ? [0, 1].map((i) => <CardSkeleton key={i} width={cardWidth} />)
            : picks.data.map((c, i) => (
                <Entrance key={c.id} clock={entrance} index={i} style={{ width: cardWidth }}>
                  <PropertyCardView card={c} width={cardWidth} />
                  {c.match?.reasons.length ? (
                    <View style={styles.reasons}>
                      {c.match.reasons.map((r) => (
                        <View key={r.en} style={[styles.reason, { backgroundColor: colors.sageSoft }]}>
                          <Txt size={11} weight="medium" color="sageInk">
                            {t(r)}
                          </Txt>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Entrance>
              ))}
        </ScrollView>
      )}
    </Section>
  );
}

/** "Featured by MQR" (phase 18): homes the MQR team picked, first on Home. Hidden when there are none. */
function Featured({ cardWidth }: { cardWidth: number }) {
  const t = useT();
  const { colors } = useTheme();
  const featured = useProperties({ featured: true, limit: 10 });
  const entrance = useEntranceClock();
  const items = featured.data?.items ?? [];
  if (!items.length) return null;
  return (
    <Section title={t(m.home.featuredByMqr)} icon={<Award size={18} color={colors.accentInk} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {items.map((c, i) => (
          <Entrance key={c.id} clock={entrance} index={i}>
            <PropertyCardView card={c} width={cardWidth} />
          </Entrance>
        ))}
      </ScrollView>
    </Section>
  );
}

/** "Price drops" (contract §8.2, as in the demo): up to three homes whose price just fell. Hidden when there are none. */
function PriceDrops() {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const drops = useProperties({ dropped: true, limit: 3 });
  const items = drops.data?.items ?? [];
  if (!items.length) return null;
  return (
    <Section title={t(m.home.priceDrops)} icon={<TrendingDown size={18} color={colors.danger} />}>
      <View style={styles.rows}>
        {items.map((c) => (
          <PropertyRow
            key={c.id}
            card={c}
            sub={
              c.oldPrice ? (
                <Txt size={11} color="ink3" style={styles.struck}>
                  {fmtMoney(c.oldPrice, lang)}
                </Txt>
              ) : null
            }
            right={
              <View style={[styles.dropBadge, { backgroundColor: colors.dangerSoft }]}>
                <Txt size={12} weight="semibold" color="danger">
                  {fmtPct(-dropPct(c), lang, 0)}
                </Txt>
              </View>
            }
          />
        ))}
      </View>
    </Section>
  );
}

function Section({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: { label: string; a11y?: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {icon}
        <Txt accessibilityRole="header" size={18} weight="semibold" style={styles.flex}>
          {title}
        </Txt>
        {action ? (
          <Pressable accessibilityRole="button" accessibilityLabel={action.a11y ?? action.label} onPress={action.onPress} hitSlop={8}>
            <Txt size={13} weight="medium" color="accentInk">
              {action.label}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  calculator: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: radius.lg, padding: 20 },
  calculatorIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rows: { gap: 10 },
  struck: { textDecorationLine: 'line-through' },
  dropBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  headline: { lineHeight: 34 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shortcuts: { flexDirection: 'row', gap: 8 },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shortcutIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  section: { gap: 12, marginTop: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { gap: 10 },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingStart: 6,
    paddingEnd: 16,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  areaImg: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  cards: { gap: 12 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4, paddingTop: 8 },
  reason: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  invite: { gap: 10, padding: 18, borderRadius: radius.lg, marginTop: 8 },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
