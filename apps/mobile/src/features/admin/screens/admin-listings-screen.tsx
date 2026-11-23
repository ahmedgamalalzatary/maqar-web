import { joinParts, fmtNum, PROPERTY_STATUS_LABEL, PROPERTY_STATUSES, type PropertyStatus } from '@mqr/shared';
import { useRouter } from 'expo-router';
import { Building2, Plus, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { m, useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { useDebounced } from '@/features/listings/hooks/use-listings';
import { AdminListingRow } from '../components/admin-parts';
import { useAdminListings } from '../hooks/use-admin';

type Filter = PropertyStatus | 'all';

/** The admin's Listings tab (phase 17): every listing in every status, with search and status chips. */
export function AdminListingsScreen() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const words = useDebounced(q, 300);
  const listings = useAdminListings({ status: filter === 'all' ? undefined : filter, q: words });
  const data = listings.data;
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const counts = data?.pages[0]?.counts;
  const count = (s: Filter) => (counts ? (s === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : counts[s]) : 0);

  return (
    <FlatList
      testID="admin-listings"
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={items}
      keyExtractor={(l) => String(l.id)}
      renderItem={({ item }) => <AdminListingRow item={item} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Txt accessibilityRole="header" size={24} weight="semibold">
                {t(m.admin.listings)}
              </Txt>
              {data ? (
                <Txt size={13} color="ink2">
                  {t(m.admin.listingsAndLive(count('all'), counts?.approved ?? 0))}
                </Txt>
              ) : null}
            </View>
            <IconButton icon={<Plus size={20} color={colors.ink} />} label={t(m.common.addAListing)} onPress={() => router.push('/admin/new')} />
          </View>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Search size={18} color={colors.ink3} />
            <TextInput
              accessibilityLabel={t(m.common.searchByTitleOrOwner)}
              value={q}
              onChangeText={setQ}
              placeholder={t(m.common.searchByTitleOrOwner)}
              placeholderTextColor={colors.ink3}
              autoCorrect={false}
              style={[styles.input, { color: colors.ink }]}
            />
            {q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t(m.common.clearSearch)} onPress={() => setQ('')} hitSlop={8}>
                <X size={16} color={colors.ink3} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
            {(['all', ...PROPERTY_STATUSES] as Filter[]).map((s) => {
              const on = filter === s;
              const label = s === 'all' ? t(m.common.all) : t(PROPERTY_STATUS_LABEL[s]);
              return (
                <Pressable
                  key={s}
                  accessibilityRole="radio"
                  accessibilityLabel={joinParts([label, fmtNum(count(s), lang)], lang)}
                  accessibilityState={{ checked: on }}
                  onPress={() => setFilter(s)}
                  style={[styles.chip, { backgroundColor: on ? colors.ink : colors.surface, borderColor: colors.line }]}
                >
                  <Txt size={13} weight="medium" style={{ color: on ? colors.bg : colors.ink }}>
                    {`${label} | ${fmtNum(count(s), lang)}`}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        listings.isPending ? (
          <CardSkeleton />
        ) : listings.isError ? (
          <ListingsError onRetry={() => void listings.refetch()} />
        ) : (
          <View style={styles.empty}>
            <Building2 size={32} color={colors.ink3} strokeWidth={1.6} />
            <Txt weight="medium" align="center">
              {count('all') ? t(m.common.noListingsHere) : t(m.admin.noListingsYet)}
            </Txt>
            <Txt size={13} color="ink2" align="center">
              {count('all')
                ? t(m.admin.tryAnotherStatusOrClear)
                : t(m.admin.addTheFirstOneWith)}
            </Txt>
          </View>
        )
      }
      ListFooterComponent={
        listings.isFetchingNextPage ? (
          <ActivityIndicator color={colors.accent} style={styles.empty} />
        ) : listings.isError && items.length > 0 ? (
          <ListingsError onRetry={() => listings.fetchNextPage()} />
        ) : undefined
      }
      onEndReached={() => {
        if (listings.hasNextPage && !listings.isFetchingNextPage) listings.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={listings.isRefetching} onRefresh={() => void listings.refetch()} tintColor={colors.accent} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 14, marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  gap: { height: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0 },
  bleed: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, minHeight: 38 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
});
