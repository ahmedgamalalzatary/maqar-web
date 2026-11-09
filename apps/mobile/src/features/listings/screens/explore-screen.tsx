import {
  CATEGORIES,
  CATEGORY_LABEL,
  type Category,
  FEATURE_LABEL,
  FINISHING_LABEL,
  fmtNum,
  PROPERTY_TYPE_LABEL,
  type Sort,
} from '@maqar/shared';
import { ArrowDownUp, KeyRound, type LucideIcon, Rotate3d, Search, SlidersHorizontal, Sparkles, TrendingDown, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { useIsClient } from '@/features/prefs/hooks/use-prefs';
import { RemovableChip, ToggleChip } from '../components/chips';
import { bathsLabel, bedsLabel, deliveryLabel, priceRangeText, sizeRangeText } from '../components/filter-labels';
import { FilterSheet } from '../components/filter-sheet';
import { CardSkeleton, EmptyListings, ListingsError } from '../components/list-states';
import { PropertyCardView } from '../components/property-card';
import { SortSheet, sortLabel } from '../components/sort-sheet';
import { activeFilterCount, clearFilters, type ExploreFilters, withCategory } from '../filters';
import { useAreas, useBrowse, useDebounced } from '../hooks/use-listings';

type Tab = Category | 'all';
const TABS: Tab[] = ['all', ...CATEGORIES];
type Quick = 'tour' | 'plan' | 'ready' | 'dropped';

/** Removes one value from a list filter; an empty list is no filter. */
const without = <T,>(list: T[] | undefined, v: T) => {
  const next = list?.filter((x) => x !== v);
  return next?.length ? next : undefined;
};

/**
 * Explore (contract §8.4): search, category tabs, quick filters, the filter and sort sheets,
 * and the active filters as removable chips. `category` and `area` are only the starting point;
 * the route remounts the screen when Home sends new ones.
 */
export function ExploreScreen({ category, area, sort }: { category?: Category; area?: string; sort?: Sort }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isClient = useIsClient();
  const [filters, setFilters] = useState<ExploreFilters>(() => ({
    sort: sort ?? 'newest',
    ...(category && { category }),
    ...(area && { areas: [area] }),
  }));
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);
  const q = useDebounced(text.trim(), 300);
  // Best match needs a client's preferences; anyone else (or after signing out) gets the newest.
  const shown = useMemo<ExploreFilters>(
    () => (filters.sort === 'match' && !isClient ? { ...filters, sort: 'newest' } : filters),
    [filters, isClient],
  );
  const query = useMemo<ExploreFilters>(() => (q ? { ...shown, q } : shown), [shown, q]);

  const browse = useBrowse(query);
  const areas = useAreas();
  const cards = browse.data?.pages.flatMap((p) => p.items) ?? [];
  const total = browse.data?.pages[0]?.total;
  const tab: Tab = filters.category ?? 'all';
  const sheetCount = activeFilterCount(filters);
  const anyQuick = !!(filters.tour || filters.plan || filters.ready || filters.dropped);
  const filtered = sheetCount > 0 || anyQuick || !!q;

  const update = (patch: Partial<ExploreFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const clearAll = () => setFilters(clearFilters(filters));

  const quicks: { k: Quick; icon: LucideIcon; label: string }[] = [
    { k: 'tour', icon: Rotate3d, label: t('جولة ٣٦٠°', '360° tour') },
    { k: 'plan', icon: Sparkles, label: t('تقسيط', 'Installments') },
    { k: 'ready', icon: KeyRound, label: t('استلام فوري', 'Ready to move') },
    { k: 'dropped', icon: TrendingDown, label: t('السعر نزل', 'Price dropped') },
  ];

  const areaName = (id: string) => {
    const a = areas.data?.find((x) => x.id === id);
    return a ? (lang === 'ar' ? a.nameAr : a.nameEn) : id;
  };
  const removeLabel = (name: string) => t(`شيل فلتر ${name}`, `Remove the ${name} filter`);

  /** One chip per active filter; tapping removes that one. */
  const chips: { key: string; text: string; name: string; remove: () => void }[] = [
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? [{ key: 'price', text: priceRangeText(filters.minPrice, filters.maxPrice, t, lang), name: t('السعر', 'price'), remove: () => update({ minPrice: undefined, maxPrice: undefined }) }]
      : []),
    ...(filters.minSize !== undefined || filters.maxSize !== undefined
      ? [{ key: 'size', text: sizeRangeText(filters.minSize ?? 50, filters.maxSize, t, lang), name: t('المساحة', 'size'), remove: () => update({ minSize: undefined, maxSize: undefined }) }]
      : []),
    ...(filters.areas ?? []).map((id) => ({ key: `a-${id}`, text: areaName(id), name: areaName(id), remove: () => update({ areas: without(filters.areas, id) }) })),
    ...(filters.types ?? []).map((k) => ({ key: `t-${k}`, text: t(PROPERTY_TYPE_LABEL[k]), name: t(PROPERTY_TYPE_LABEL[k]), remove: () => update({ types: without(filters.types, k) }) })),
    ...(filters.beds ?? []).map((n) => {
      const { label } = bedsLabel(n, t, lang);
      return { key: `b-${n}`, text: label, name: label, remove: () => update({ beds: without(filters.beds, n) }) };
    }),
    ...(filters.baths ?? []).map((n) => {
      const { label } = bathsLabel(n, t, lang);
      return { key: `h-${n}`, text: label, name: label, remove: () => update({ baths: without(filters.baths, n) }) };
    }),
    ...(filters.delivery ?? []).map((d) => {
      const { label } = deliveryLabel(d, t, lang);
      return { key: `d-${d}`, text: label, name: label, remove: () => update({ delivery: without(filters.delivery, d) }) };
    }),
    ...(filters.finishing ?? []).map((k) => ({ key: `f-${k}`, text: t(FINISHING_LABEL[k]), name: t(FINISHING_LABEL[k]), remove: () => update({ finishing: without(filters.finishing, k) }) })),
    ...(filters.features ?? []).map((k) => ({ key: `m-${k}`, text: t(FEATURE_LABEL[k]), name: t(FEATURE_LABEL[k]), remove: () => update({ features: without(filters.features, k) }) })),
  ];

  const top = (
    <View style={[styles.top, { paddingTop: insets.top + 12, backgroundColor: colors.bg }]}>
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Search size={18} color={colors.ink3} />
          <TextInput
            accessibilityLabel={t('بحث', 'Search')}
            value={text}
            onChangeText={setText}
            placeholder={t('ابحث: التجمع، شاليه، أزور باي…', 'Search: New Cairo, chalet, Azure Bay…')}
            placeholderTextColor={colors.ink3}
            returnKeyType="search"
            autoCorrect={false}
            style={[styles.searchInput, { color: colors.ink }]}
          />
          {text ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('امسح البحث', 'Clear search')}
              onPress={() => setText('')}
              hitSlop={8}
              style={[styles.clear, { backgroundColor: colors.surface2 }]}
            >
              <X size={14} color={colors.ink} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('الفلاتر', 'Filters')}
          accessibilityValue={sheetCount ? { text: fmtNum(sheetCount, lang) } : undefined}
          onPress={() => setSheet('filters')}
          style={({ pressed }) => [styles.filterBtn, { backgroundColor: colors.ink, opacity: pressed ? 0.85 : 1 }]}
        >
          <SlidersHorizontal size={20} color={colors.bg} />
          {sheetCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Txt size={11} weight="semibold" style={{ color: colors.navy }}>
                {fmtNum(sheetCount, lang)}
              </Txt>
            </View>
          ) : null}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
        {TABS.map((k) => {
          const on = tab === k;
          const label = k === 'all' ? t('الكل', 'All') : t(CATEGORY_LABEL[k]);
          return (
            <Pressable
              key={k}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              onPress={() => setFilters((f) => withCategory(f, k === 'all' ? undefined : k))}
              style={[styles.tab, { backgroundColor: on ? colors.ink : colors.surface, borderColor: colors.line }]}
            >
              <Txt size={13} weight="medium" style={{ color: on ? colors.bg : colors.ink }}>
                {label}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {quicks.map(({ k, icon, label }) => (
          <ToggleChip
            key={k}
            tone="quick"
            icon={icon}
            label={label}
            selected={!!filters[k]}
            onPress={() => update({ [k]: filters[k] ? undefined : true })}
          />
        ))}
      </ScrollView>
    </View>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.meta}>
        <View style={[styles.flex, styles.metaStart]}>
          {total !== undefined ? (
            <Txt size={13} color="ink2">
              <Txt size={13} weight="semibold">
                {fmtNum(total, lang)}
              </Txt>{' '}
              {t('وحدة', total === 1 ? 'home' : 'homes')}
            </Txt>
          ) : null}
          {sheetCount > 0 || anyQuick ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('مسح الفلاتر', 'Clear filters')} onPress={clearAll} hitSlop={8}>
              <Txt size={13} weight="medium" color="accentInk">
                {t('مسح الفلاتر', 'Clear filters')}
              </Txt>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`ترتيب: ${sortLabel(shown.sort, t)}`, `Sort: ${sortLabel(shown.sort, t)}`)}
          onPress={() => setSheet('sort')}
          hitSlop={8}
          style={styles.sortBtn}
        >
          <ArrowDownUp size={16} color={colors.ink} />
          <Txt size={13} weight="medium">
            {sortLabel(shown.sort, t)}
          </Txt>
        </Pressable>
      </View>
      {chips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chips.map((c) => (
            <RemovableChip key={c.key} text={c.text} removeLabel={removeLabel(c.name)} onRemove={c.remove} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      {top}
      <FlatList
        testID="explore-list"
        style={{ opacity: browse.isPlaceholderData ? 0.6 : 1 }}
        contentContainerStyle={styles.content}
        data={cards}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <PropertyCardView card={item} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListHeaderComponent={header}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          browse.isPending ? (
            <View style={styles.skeletons}>
              <CardSkeleton />
              <CardSkeleton />
            </View>
          ) : browse.isError ? (
            <ListingsError onRetry={() => browse.refetch()} />
          ) : (
            <EmptyListings
              onClear={
                filtered
                  ? () => {
                      setText('');
                      clearAll();
                    }
                  : undefined
              }
            />
          )
        }
        ListFooterComponent={browse.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.more} /> : undefined}
        onEndReached={() => {
          if (browse.hasNextPage && !browse.isFetchingNextPage) browse.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={browse.isRefetching && !browse.isFetchingNextPage && !browse.isPlaceholderData} onRefresh={() => void browse.refetch()} tintColor={colors.accent} />
        }
      />

      {sheet === 'filters' ? (
        <FilterSheet
          filters={query}
          onClose={() => setSheet(null)}
          onApply={({ q: _typed, ...f }) => {
            setFilters(f);
            setSheet(null);
          }}
        />
      ) : null}
      <SortSheet
        open={sheet === 'sort'}
        value={shown.sort}
        withMatch={isClient}
        onClose={() => setSheet(null)}
        onPick={(sort) => {
          update({ sort });
          setSheet(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  searchRow: { flexDirection: 'row', gap: 8 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 14, padding: 0, textAlign: 'auto' },
  clear: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterBtn: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4,
    end: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { gap: 8 },
  tab: { height: 38, paddingHorizontal: 16, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 10, marginBottom: 16, paddingTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  metaStart: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipRow: { gap: 6 },
  flex: { flex: 1 },
  gap: { height: 24 },
  skeletons: { gap: 24 },
  more: { marginTop: 16 },
});
