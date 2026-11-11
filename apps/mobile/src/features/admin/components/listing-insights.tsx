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
  relTime,
} from '@maqar/shared';
import { Phone } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Segmented } from '@/components/segmented';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
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
    if (stats.data) void Share.share({ message: insightsSummary(stats.data, lang === 'ar' ? l.titleAr : l.titleEn, lang) });
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.row}>
        <Txt accessibilityRole="header" size={17} weight="semibold" style={styles.flex}>
          {t('أرقام العقار', 'Listing insights')}
        </Txt>
        <Button label={t('ابعتها للمالك', 'Send to the owner')} variant="ghost" disabled={!stats.data} onPress={share} />
      </View>
      <Segmented
        options={RANGE_KEYS.map((d) => ({ value: d, label: t(`${n(Number(d))} يوم`, `${d} days`) }))}
        value={String(range) as `${InsightRange}`}
        onChange={(v) => setRange(Number(v) as InsightRange)}
      />

      {stats.isError ? (
        <View style={styles.row}>
          <Txt size={13} color="danger" style={styles.flex}>
            {t('مقدرناش نجيب الأرقام', 'We couldn’t load the numbers')}
          </Txt>
          <Button label={t('حاول تاني', 'Try again')} variant="ghost" onPress={() => void stats.refetch()} />
        </View>
      ) : !stats.data || !r || !total ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <>
          <View style={styles.tiles}>
            <Tile label={t('مشاهدات', 'Views')} value={n(r.views)} all={t(`${n(total.views)} من الأول`, `${n(total.views)} all time`)} />
            <Tile label={t('حفظوه', 'Saves')} value={n(r.saves)} all={t(`${n(total.saves)} حافظينه`, `${n(total.saves)} saved now`)} />
            <Tile label={t('مهتمين جداد', 'New interested')} value={n(r.interested)} all={t(`${n(total.interested)} من الأول`, `${n(total.interested)} all time`)} />
          </View>
          <ViewsChart days={stats.data.days} />
          <Txt size={12} color="ink3">
            {t(
              `${n(total.followers)} متابعين السعر | ${n(total.chats)} محادثة | ${n(total.viewings)} معاينة متحجزة`,
              `${n(total.followers)} follow the price | ${n(total.chats)} chats | ${n(total.viewings)} viewings booked`,
            )}
          </Txt>
        </>
      )}

      <View style={[styles.rule, { backgroundColor: colors.line }]} />
      <Txt weight="semibold">{t('العملاء المهتمين', 'Interested clients')}</Txt>
      <Txt size={12} color="ink3">
        {t('اللي حفظوه أو تابعوا سعره أو كلّموا المسؤول أو حجزوا معاينة.', 'Clients who saved it, follow its price, chatted or booked a viewing.')}
      </Txt>
      {people.isPending ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : people.isError ? (
        <View style={styles.row}>
          <Txt size={13} color="danger" style={styles.flex}>
            {t('مقدرناش نجيب العملاء', 'We couldn’t load the clients')}
          </Txt>
          <Button label={t('حاول تاني', 'Try again')} variant="ghost" onPress={() => void people.refetch()} />
        </View>
      ) : !people.data.length ? (
        <Txt size={13} color="ink2">
          {t('لسه محدش اهتم بالعقار ده.', 'Nobody has shown interest yet.')}
        </Txt>
      ) : (
        people.data.map((c) => (
          <View key={c.id} style={[styles.person, { borderTopColor: colors.line }]}>
            <View style={styles.flex}>
              <Txt weight="medium">{c.name}</Txt>
              <Txt size={12} color="ink2">
                {c.kinds.map((k) => t(INTEREST_LABEL[k])).join(' | ')}
              </Txt>
              <Txt size={11} color="ink3">
                {t(`آخر نشاط ${relTime(new Date(c.lastAt), lang)}`, `Last active ${relTime(new Date(c.lastAt), lang)}`)}
              </Txt>
            </View>
            {c.phone ? <IconButton label={t(`اتصل بـ ${c.name}`, `Call ${c.name}`)} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${c.phone}`)} /> : null}
          </View>
        ))
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

/** Views per Cairo day as thin bars; tapping a bar shows that day's numbers. */
function ViewsChart({ days }: { days: ListingDay[] }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [picked, setPicked] = useState<number | null>(null);
  const top = Math.max(1, ...days.map((d) => d.views));
  const date = (day: string) => fmtDate(`${day}T12:00:00Z`, lang);
  const shown = days[picked ?? days.length - 1]!;
  return (
    <View style={styles.chart}>
      <Txt size={12} color="ink2">
        {picked === null ? t('المشاهدات في اليوم، دوس على يوم', 'Views per day: tap a day') : date(shown.day)}
      </Txt>
      <Txt size={12} weight="medium">
        {t(
          `${fmtNum(shown.views, 'ar')} مشاهدة | ${fmtNum(shown.saves, 'ar')} حفظ | ${fmtNum(shown.interested, 'ar')} مهتم جديد`,
          `${shown.views} views | ${shown.saves} saves | ${shown.interested} new interested`,
        )}
      </Txt>
      <View style={[styles.bars, { borderBottomColor: colors.line2 }]}>
        {days.map((d, i) => (
          <Pressable
            key={d.day}
            accessibilityLabel={t(`${date(d.day)}: ${fmtNum(d.views, 'ar')} مشاهدة`, `${date(d.day)}: ${d.views} views`)}
            onPress={() => setPicked(i === picked ? null : i)}
            style={styles.barSlot}
          >
            <View
              style={[
                styles.bar,
                { height: d.views ? `${Math.max(2, (d.views / top) * 100)}%` : 0, backgroundColor: i === picked ? colors.accentInk : colors.accent },
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
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 2, borderBottomWidth: 1 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  rule: { height: StyleSheet.hairlineWidth },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
