import type { Category } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Building2, Home as HomeIcon, KeyRound, type LucideIcon, Moon, Palmtree, Search, Sun } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { usePreferences } from '@/features/account/hooks/use-account';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { PropertyCardView } from '@/features/listings/components/property-card';
import { useAreas, useProperties } from '@/features/listings/hooks/use-listings';

const SHORTCUTS: { category: Category; icon: LucideIcon; ar: string; en: string }[] = [
  { category: 'sale', icon: HomeIcon, ar: 'شراء', en: 'Buy' },
  { category: 'rent', icon: KeyRound, ar: 'إيجار', en: 'Rent' },
  { category: 'project', icon: Building2, ar: 'مشروعات', en: 'Projects' },
  { category: 'stay', icon: Palmtree, ar: 'إقامة', en: 'Stays' },
];

/**
 * Client home (contract §8.2), phase 3: headline, search entry, category shortcuts, areas and
 * new launches. Picks, price drops, tours and the next viewing arrive with their phases.
 */
export function Home() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { scheme, colors } = useTheme();
  const { setTheme } = usePreferences();
  const { width } = useWindowDimensions();
  const areas = useAreas();
  const launches = useProperties({ category: 'project', limit: 10 });
  const cardWidth = Math.round(width * 0.72);

  return (
    <Screen>
      <View style={styles.header}>
        <Logo width={64} />
        <IconButton
          label={scheme === 'dark' ? t('الوضع الفاتح', 'Light mode') : t('الوضع الداكن', 'Dark mode')}
          onPress={() => setTheme(scheme === 'dark' ? 'light' : 'dark')}
          icon={
            scheme === 'dark' ? (
              <Sun color={colors.accent} size={20} strokeWidth={1.8} />
            ) : (
              <Moon color={colors.ink} size={20} strokeWidth={1.8} />
            )
          }
        />
      </View>

      <View>
        <Txt accessibilityRole="header" size={28} weight="semibold" style={styles.headline}>
          {t('لاقي بيتك،', 'Find your home,')}
        </Txt>
        <Txt size={28} weight="semibold" color="accentInk" style={styles.headline}>
          {t('واحجز معاينته بنفسك.', 'book the viewing yourself.')}
        </Txt>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('منطقة، كمبوند أو نوع الوحدة', 'Area, compound or unit type')}
        onPress={() => router.push('/explore')}
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}
      >
        <Search size={20} color={colors.ink3} />
        <Txt size={14} color="ink3" style={styles.flex}>
          {t('منطقة، كمبوند أو نوع الوحدة', 'Area, compound or unit type')}
        </Txt>
      </Pressable>

      <View style={styles.shortcuts}>
        {SHORTCUTS.map(({ category, icon: Icon, ar, en }) => (
          <Pressable
            key={category}
            accessibilityRole="button"
            accessibilityLabel={t(ar, en)}
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
              {t(ar, en)}
            </Txt>
          </Pressable>
        ))}
      </View>

      <Section title={t('تصفح حسب المنطقة', 'Browse by area')}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {(areas.data ?? []).map((a) => {
            const name = lang === 'ar' ? a.nameAr : a.nameEn;
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

      <Section
        title={t('مشروعات جديدة بالتقسيط', 'New launches on installments')}
        action={{ label: t('الكل', 'See all'), onPress: () => router.push({ pathname: '/explore', params: { category: 'project' } }) }}
      >
        {launches.isError ? (
          <ListingsError onRetry={() => launches.refetch()} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
            {launches.isPending
              ? [0, 1].map((i) => <CardSkeleton key={i} width={cardWidth} />)
              : launches.data.items.map((c) => <PropertyCardView key={c.id} card={c} width={cardWidth} />)}
          </ScrollView>
        )}
      </Section>
    </Screen>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt accessibilityRole="header" size={18} weight="semibold" style={styles.flex}>
          {title}
        </Txt>
        {action ? (
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={8}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  flex: { flex: 1 },
});
