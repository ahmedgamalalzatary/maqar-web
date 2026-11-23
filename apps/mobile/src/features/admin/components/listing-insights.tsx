import {
  type AdminListing,
  fmtDate,
  fmtNum,
  INSIGHT_RANGES,
  type InsightRange,
  INTEREST_LABEL,
  insightsSummary,
  type ListingDay,
  rangeTotals,
  pickField,
} from '@mqr/shared';
import { Phone } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Segmented } from '@/components/segmented';
import { Txt } from '@/components/text';
import { m, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useInterested, useListingStats } from '../hooks/use-admin';

const RANGE_KEYS = INSIGHT_RANGES.map(String) as `${InsightRange}`[];

/** Phase 19: the listing's views chart, its numbers and its interested clients, to pass to the owner. */
export function ListingInsights({ l }: { l: AdminListing }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [range, setRange] = useState<InsightRange>(30);
  const stats = useListingStats(l.id, range);
  const people = useInterested(l.id);
  const n = (v: number) => fmtNum(v, lang);
  const r = stats.data ? rangeTotals(stats.data.days) : undefined;
  const total = stats.data?.totals;
  const share = () => {
    if (stats.data && !stats.isPlaceholderData)
      void Share.share({ message: insightsSummary(stats.data, pickField(l, 'title', lang), lang) });
  };
  const updating = stats.isPlaceholderData || stats.isFetching;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.row}>
        <Txt accessibilityRole="header" size={17} weight="semibold" style={styles.flex}>
          {t(m.admin.listingInsights)}
        </Txt>
        <Button label={t(m.admin.sendToTheOwner)} variant="ghost" disabled={!stats.data || updating} onPress={share} />
      </View>
      <Segmented
        options={RANGE_KEYS.map((d) => ({ value: d, label: t(m.common.days(Number(d))) }))}
        value={String(range) as `${InsightRange}`}
        onChange={(v) => setRange(Number(v) as InsightRange)}
      />

      {stats.isError ? (
        <View style={styles.row}>
          <Txt size={13} color="danger" style={styles.flex}>
            {t(m.admin.weCouldntLoadTheNumbers)}
          </Txt>
          <Button label={t(m.common.tryAgain)} variant="ghost" onPress={() => void stats.refetch()} />
        </View>
      ) : !stats.data || !r || !total ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <>
          <View style={styles.tiles}>
            <Tile label={t(m.admin.views)} value={n(r.views)} all={t(m.admin.allTime(total.views))} />
            <Tile label={t(m.admin.saves)} value={n(r.saves)} all={t(m.admin.savedNow(total.saves))} />
            <Tile label={t(m.admin.newInterested)} value={n(r.interested)} all={t(m.admin.allTime(total.interested))} />
          </View>
          {updating ? (
            <Txt size={11} color="ink3">
              {t(m.admin.updatingToTheSelectedRange)}
            </Txt>
          ) : null}
          <ViewsChart days={stats.data.days} />
          {stats.data.since ? (
            <Txt size={11} color="ink3">
              {t(m.admin.recordedFrom(stats.data.since))}
            </Txt>
          ) : null}
          <Txt size={12} color="ink3">
            {t(m.admin.insightTotals(total.followers, total.chats, total.viewings))}
          </Txt>
        </>
      )}

      <View style={[styles.rule, { backgroundColor: colors.line }]} />
      <Txt weight="semibold">{t(m.admin.interestedClients)}</Txt>
      <Txt size={12} color="ink3">
        {t(m.admin.clientsWhoSavedItFollow)}
      </Txt>
      {people.isPending ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : people.isError ? (
        <View style={styles.row}>
          <Txt size={13} color="danger" style={styles.flex}>
            {t(m.admin.weCouldntLoadTheClients)}
          </Txt>
          <Button label={t(m.common.tryAgain)} variant="ghost" onPress={() => void people.refetch()} />
        </View>
      ) : (
        <FlatList
          data={people.data.pages.flat()}
          keyExtractor={(c) => String(c.id)}
          renderItem={({ item: c }) => (
            <View style={[styles.person, { borderTopColor: colors.line }]}>
              <View style={styles.flex}>
                <Txt weight="medium">{c.name}</Txt>
                <Txt size={12} color="ink2">
                  {c.kinds.map((k) => t(INTEREST_LABEL[k])).join(' | ')}
                </Txt>
                <Txt size={11} color="ink3">
                  {t(m.admin.lastActive(new Date(c.lastAt)))}
                </Txt>
              </View>
              {c.phone ? <IconButton label={t(m.common.callName(c.name))} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${c.phone}`)} /> : null}
            </View>
          )}
          ListEmptyComponent={
            <Txt size={13} color="ink2">
              {t(m.admin.nobodyHasShownInterestYet)}
            </Txt>
          }
          ListFooterComponent={people.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.loading} /> : undefined}
          onEndReached={() => people.hasNextPage && !people.isFetchingNextPage && void people.fetchNextPage()}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}

function Tile({ label, value, all }: { label: string; value: string; all: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}, ${all}`} style={[styles.tile, { backgroundColor: colors.surface2 }]}>
      <Txt size={11} color="ink2">
        {label}
      </Txt>
      <Txt size={20} weight="semibold">
        {value}
      </Txt>
      <Txt size={10} color="ink3">
        {all}
      </Txt>
    </View>
  );
}

/** Views per Cairo day as bars in a sideways scroll, so every day's tap target is finger-sized;
 *  tapping a bar shows that day's views, saves and new interested. */
function ViewsChart({ days }: { days: ListingDay[] }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const top = Math.max(1, ...days.map((d) => d.views));
  const date = (day: string) => fmtDate(day, lang);
  const shown = days.find((d) => d.day === pickedDay) ?? days[days.length - 1]!;
  return (
    <View style={styles.chart}>
      <Txt size={12} color="ink2">
        {shown.day === pickedDay ? date(shown.day) : t(m.admin.viewsPerDayTapA)}
      </Txt>
      <Txt size={12} weight="medium">
        {t(m.admin.insightShown(shown.views, shown.saves, shown.interested))}
      </Txt>
      {/* Every day shares the width, so the whole range (and today) is always in view: a scrolling
          chart opened on its oldest days, which hid today's bar on a phone. */}
      <View style={[styles.bars, { borderBottomColor: colors.line2, gap: days.length > 31 ? 1 : 2 }]}>
        {days.map((d) => (
          <Pressable
            key={d.day}
            accessibilityRole="button"
            accessibilityState={{ selected: d.day === pickedDay }}
            accessibilityLabel={t(m.admin.insightDay(d.day, d.views, d.saves, d.interested))}
            onPress={() => setPickedDay(d.day === pickedDay ? null : d.day)}
            style={styles.barSlot}
          >
            <View
              style={[
                styles.bar,
                { height: d.views ? `${Math.max(2, (d.views / top) * 100)}%` : 0, backgroundColor: d.day === pickedDay ? colors.accentInk : colors.accent },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        <Txt size={10} color="ink3" style={styles.flex}>
          {date(days[0]!.day)}
        </Txt>
        <Txt size={10} color="ink3">
          {date(days[days.length - 1]!.day)}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  loading: { paddingVertical: 24 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: radius.md, padding: 10, gap: 2 },
  chart: { gap: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, borderBottomWidth: 1 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  rule: { height: StyleSheet.hairlineWidth },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
