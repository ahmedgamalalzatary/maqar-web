import { type AdminOverview, fmtDate, fmtNum, OVERVIEW_RANGES, type OverviewAgent, type OverviewRange } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { Flag } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { ListingsError } from '@/features/listings/components/list-states';
import { useOverview } from '../hooks/use-people';

type Metric = 'clients' | 'leads' | 'viewings';
const METRIC_LABEL: Record<Metric, { ar: string; en: string }> = {
  clients: { ar: 'عملاء جداد', en: 'New clients' },
  leads: { ar: 'عملاء محتملين', en: 'New leads' },
  viewings: { ar: 'معاينات اتحجزت', en: 'Viewings booked' },
};

/** The admin's first tab (phase 25): what happened in the last 7, 30 or 90 days, and each advisor against the target. */
export function OverviewScreen() {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<OverviewRange>(30);
  const overview = useOverview(days);
  const o = overview.data;
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={<RefreshControl refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()} tintColor={colors.accent} />}
    >
      <Txt accessibilityRole="header" size={24} weight="semibold">
        {t('نظرة عامة', 'Overview')}
      </Txt>
      <View style={styles.chips}>
        {OVERVIEW_RANGES.map((d) => (
          <Pressable
            key={d}
            accessibilityRole="radio"
            accessibilityLabel={t(`آخر ${fmtNum(d, 'ar')} يوم`, `Last ${d} days`)}
            accessibilityState={{ checked: days === d }}
            onPress={() => setDays(d)}
            style={[styles.chip, { backgroundColor: days === d ? colors.ink : colors.surface, borderColor: colors.line }]}
          >
            <Txt size={13} weight="medium" style={{ color: days === d ? colors.bg : colors.ink }}>
              {t(`${fmtNum(d, 'ar')} يوم`, `${d} days`)}
            </Txt>
          </Pressable>
        ))}
      </View>
      {overview.isPending ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : overview.isError || !o ? (
        <ListingsError onRetry={() => void overview.refetch()} />
      ) : (
        <Body o={o} />
      )}
    </ScrollView>
  );
}

function Body({ o }: { o: AdminOverview }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const n = (v: number) => fmtNum(v, lang);
  return (
    <>
      <Txt size={12} color="ink2">
        {`${fmtDate(o.from, lang)} – ${fmtDate(o.to, lang)}`}
      </Txt>
      {o.chats.openReports ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`${fmtNum(o.chats.openReports, 'ar')} بلاغ مفتوح على الشات`, `${o.chats.openReports} open chat reports`)}
          onPress={() => router.push('/admin/chats')}
          style={[styles.alert, { backgroundColor: colors.dangerSoft }]}
        >
          <Flag size={16} color={colors.danger} />
          <Txt size={13} color="danger" weight="medium">
            {t(`${fmtNum(o.chats.openReports, 'ar')} بلاغ مفتوح على الشات`, `${o.chats.openReports} open chat reports`)}
          </Txt>
        </Pressable>
      ) : null}
      <View style={styles.grid}>
        <Tile label={t('عملاء جداد', 'New clients')} value={n(o.clients.new)} sub={t(`${fmtNum(o.clients.total, 'ar')} عميل في الكل`, `${o.clients.total} in all`)} />
        <Tile label={t('عملاء محتملين جداد', 'New leads')} value={n(o.leads.new)} sub={t(`${fmtNum(o.leads.won, 'ar')} اتقفلوا بيع`, `${o.leads.won} won`)} />
        <Tile
          label={t('معاينات اتحجزت', 'Viewings booked')}
          value={n(o.viewings.booked)}
          sub={t(`${fmtNum(o.viewings.completed, 'ar')} خلصت | ${fmtNum(o.viewings.cancelled, 'ar')} اتلغت`, `${o.viewings.completed} done | ${o.viewings.cancelled} cancelled`)}
        />
        <Tile label={t('معاينات الأسبوع الجاي', 'Next 7 days')} value={n(o.viewings.next7Days)} sub={t('معاينة مؤكدة', 'confirmed viewings')} />
        <Tile
          label={t('عقارات منشورة', 'Live listings')}
          value={n(o.listings.byStatus.approved)}
          sub={t(`${fmtNum(o.listings.published, 'ar')} اتنشر | ${fmtNum(o.listings.closed, 'ar')} اتقفل`, `${o.listings.published} published | ${o.listings.closed} closed`)}
        />
        <Tile label={t('شاتات جديدة', 'New chats')} value={n(o.chats.new)} sub={t(`${fmtNum(o.chats.messages, 'ar')} رسالة`, `${o.chats.messages} messages`)} />
      </View>
      <DailyChart o={o} />
      <Txt size={16} weight="semibold">
        {t('المسؤولين', 'Advisors')}
      </Txt>
      {o.agents.map((a) => (
        <AgentRow key={a.id} a={a} />
      ))}
    </>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}: ${value}، ${sub}`} style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Txt size={12} color="ink2">
        {label}
      </Txt>
      <Txt size={22} weight="semibold">
        {value}
      </Txt>
      <Txt size={11} color="ink3">
        {sub}
      </Txt>
    </View>
  );
}

/** One metric per Cairo day as bars sharing the width, so the whole range and today are in view. */
function DailyChart({ o }: { o: AdminOverview }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [metric, setMetric] = useState<Metric>('clients');
  const [picked, setPicked] = useState<string | null>(null);
  const top = Math.max(1, ...o.daily.map((d) => d[metric]));
  const shown = o.daily.find((d) => d.date === picked);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.chips}>
        {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityLabel={t(METRIC_LABEL[m])}
            accessibilityState={{ checked: metric === m }}
            onPress={() => setMetric(m)}
            style={[styles.small, { backgroundColor: metric === m ? colors.accentSoft : colors.surface2 }]}
          >
            <Txt size={12} weight="medium" color={metric === m ? 'accentInk' : 'ink2'}>
              {t(METRIC_LABEL[m])}
            </Txt>
          </Pressable>
        ))}
      </View>
      <Txt size={12} color="ink2">
        {shown ? `${fmtDate(shown.date, lang)}: ${fmtNum(shown[metric], lang)}` : t('في اليوم، دوس على يوم', 'Per day: tap a day')}
      </Txt>
      <View style={[styles.bars, { borderBottomColor: colors.line2, gap: o.daily.length > 31 ? 1 : 2 }]}>
        {o.daily.map((d) => (
          <Pressable
            key={d.date}
            accessibilityRole="button"
            accessibilityState={{ selected: d.date === picked }}
            accessibilityLabel={`${fmtDate(d.date, lang)}: ${fmtNum(d[metric], lang)}`}
            onPress={() => setPicked(d.date === picked ? null : d.date)}
            style={styles.barSlot}
          >
            <View style={[styles.bar, { height: d[metric] ? `${Math.max(2, (d[metric] / top) * 100)}%` : 0, backgroundColor: d.date === picked ? colors.accentInk : colors.accent }]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.line}>
        <Txt size={10} color="ink3" style={styles.flex}>
          {fmtDate(o.from, lang)}
        </Txt>
        <Txt size={10} color="ink3">
          {fmtDate(o.to, lang)}
        </Txt>
      </View>
    </View>
  );
}

function AgentRow({ a }: { a: OverviewAgent }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const pct = a.monthlyTarget ? Math.min(1, a.wonThisMonth / a.monthlyTarget) : 0;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.line}>
        <View style={[styles.dot, { backgroundColor: a.colour }]} />
        <Txt weight="medium" style={styles.flex}>
          {lang === 'ar' ? a.nameAr : a.nameEn}
        </Txt>
        <Txt size={13} weight="semibold">
          {a.monthlyTarget ? `${fmtNum(a.wonThisMonth, lang)} / ${fmtNum(a.monthlyTarget, lang)}` : fmtNum(a.wonThisMonth, lang)}
        </Txt>
      </View>
      {a.monthlyTarget ? (
        <View
          accessible
          accessibilityLabel={t(`اتقفل ${fmtNum(a.wonThisMonth, 'ar')} من هدف ${fmtNum(a.monthlyTarget, 'ar')} الشهر ده`, `${a.wonThisMonth} won of a target of ${a.monthlyTarget} this month`)}
          style={[styles.track, { backgroundColor: colors.surface2 }]}
        >
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: pct >= 1 ? colors.sage : colors.accent }]} />
        </View>
      ) : null}
      <Txt size={12} color="ink2">
        {t(
          `${fmtNum(a.live, 'ar')} عقار منشور | ${fmtNum(a.openLeads, 'ar')} عميل مفتوح | ${fmtNum(a.viewings, 'ar')} معاينة اتحجزت`,
          `${a.live} live | ${a.openLeads} open leads | ${a.viewings} viewings booked`,
        )}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 14 },
  loading: { marginTop: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  small: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, borderRadius: radius.lg, borderWidth: 1, padding: 12, gap: 2 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 110, borderBottomWidth: 1 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
