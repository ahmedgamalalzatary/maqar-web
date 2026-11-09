import { CATEGORIES, CATEGORY_LABEL, type Category, fmtNum } from '@maqar/shared';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { CardSkeleton, EmptyListings, ListingsError } from '../components/list-states';
import { PropertyCardView } from '../components/property-card';
import { useAreas, useBrowse } from '../hooks/use-listings';

type Tab = Category | 'all';
const TABS: Tab[] = ['all', ...CATEGORIES];

/**
 * Explore (contract §8.4), phase 3: approved listings, newest first, by category tab and
 * the area picked on Home. Search, filters and sort arrive in phase 5. `category` and `area`
 * are only the starting point; the route remounts the screen when Home sends new ones.
 */
export function ExploreScreen({ category, area: initialArea }: { category?: Category; area?: string }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>(category ?? 'all');
  const [area, setArea] = useState(initialArea);

  const browse = useBrowse({ category: tab === 'all' ? undefined : tab, area });
  const areas = useAreas();
  const areaItem = area ? areas.data?.find((a) => a.id === area) : undefined;
  const areaName = areaItem ? (lang === 'ar' ? areaItem.nameAr : areaItem.nameEn) : area;
  const cards = browse.data?.pages.flatMap((p) => p.items) ?? [];
  const total = browse.data?.pages[0]?.total;

  const header = (
    <View style={styles.header}>
      <Txt accessibilityRole="header" size={24} weight="semibold">
        {t('استكشف', 'Explore')}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {TABS.map((k) => {
          const on = tab === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={k === 'all' ? t('الكل', 'All') : t(CATEGORY_LABEL[k])}
              onPress={() => setTab(k)}
              style={[styles.tab, { backgroundColor: on ? colors.ink : colors.surface, borderColor: colors.line }]}
            >
              <Txt size={13} weight="medium" style={{ color: on ? colors.bg : colors.ink }}>
                {k === 'all' ? t('الكل', 'All') : t(CATEGORY_LABEL[k])}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.meta}>
        {area ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(`شيل فلتر ${areaName}`, `Remove the ${areaName} filter`)}
            onPress={() => setArea(undefined)}
            style={[styles.chip, { backgroundColor: colors.accentSoft }]}
          >
            <Txt size={12} weight="medium" color="accentInk">
              {areaName}
            </Txt>
            <X size={14} color={colors.accentInk} />
          </Pressable>
        ) : null}
        {total !== undefined ? (
          <Txt size={12} color="ink2">
            {t(`${fmtNum(total, 'ar')} وحدة`, `${total} ${total === 1 ? 'home' : 'homes'}`)}
          </Txt>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      testID="explore-list"
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={cards}
      keyExtractor={(c) => String(c.id)}
      renderItem={({ item }) => <PropertyCardView card={item} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        browse.isPending ? (
          <View style={styles.skeletons}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : browse.isError ? (
          <ListingsError onRetry={() => browse.refetch()} />
        ) : (
          <EmptyListings />
        )
      }
      ListFooterComponent={browse.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.more} /> : undefined}
      onEndReached={() => {
        if (browse.hasNextPage && !browse.isFetchingNextPage) browse.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={browse.isRefetching && !browse.isFetchingNextPage} onRefresh={() => void browse.refetch()} tintColor={colors.accent} />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 16 },
  tabs: { gap: 8 },
  tab: { height: 38, paddingHorizontal: 16, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 12, borderRadius: radius.full },
  gap: { height: 24 },
  skeletons: { gap: 24 },
  more: { marginTop: 16 },
});
