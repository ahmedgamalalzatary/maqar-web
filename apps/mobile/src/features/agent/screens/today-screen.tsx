import { fmtDate, fmtNum, LEAD_STAGE_COLOUR, LEAD_STAGE_LABEL, LEAD_STAGES, targetProgress } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { Target, TrendingDown, TrendingUp } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { AgentViewingRow, Initials, LeadRow } from '../components/lead-parts';
import { useToday } from '../hooks/use-agent';

/** The agent's Today (contract §10.1): stats, the monthly target, the day's viewings, the pipeline and first calls. */
export function TodayScreen() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useSession((s) => s.user);
  const today = useToday();
  const d = today.data;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 14 }]}
      refreshControl={<RefreshControl refreshing={today.isRefetching} onRefresh={() => void today.refetch()} tintColor={colors.accent} />}
    >
      <View style={styles.head}>
        <Initials name={d ? t({ ar: d.firstNameAr, en: d.firstNameEn }) : (me?.name ?? '')} colour={colors.accent} size={46} />
        <View style={styles.flex}>
          <Txt size={12} color="ink2">
            {fmtDate(new Date(), lang, 'long')}
          </Txt>
          <Txt accessibilityRole="header" size={18} weight="semibold">
            {d ? t(`يومك يا ${d.firstNameAr}`, `Your day, ${d.firstNameEn}`) : t('يومك', 'Your day')}
          </Txt>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.sageSoft }]}>
          <Txt size={11} weight="medium" color="sageInk">
            {t('تطبيق المبيعات', 'Sales app')}
          </Txt>
        </View>
      </View>

      {today.isPending ? (
        <CardSkeleton />
      ) : today.isError || !d ? (
        <ListingsError onRetry={() => void today.refetch()} />
      ) : (
        <>
          <View style={styles.stats}>
            <Stat label={t('معاينات النهارده', 'Today')} value={fmtNum(d.stats.today, lang)} />
            <Stat label={t('عملاء جداد', 'New leads')} value={fmtNum(d.stats.fresh, lang)} gold />
            <Stat label={t('نشطين', 'Active')} value={fmtNum(d.stats.active, lang)} />
          </View>

          <TargetCard won={d.target.won} target={d.target.target} teamAvg={d.target.teamAvg} />

          <Section title={t('معاينات النهارده', 'Today’s viewings')}>
            {d.today.length ? (
              d.today.map((v) => <AgentViewingRow key={v.id} v={v} />)
            ) : (
              <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                <Txt size={13} color="ink2">
                  {t('مفيش معاينات تانية النهارده.', 'No more viewings today.')}
                </Txt>
              </View>
            )}
          </Section>

          {d.upcoming.length ? (
            <Section title={t('الجاية', 'Coming up')}>
              {d.upcoming.map((v) => (
                <AgentViewingRow key={v.id} v={v} showDate />
              ))}
            </Section>
          ) : null}

          <Section
            title={t('حالة العملاء', 'Pipeline')}
            action={{ label: t('كل العملاء', 'All leads'), onPress: () => router.push('/agent/leads') }}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pipeline} style={styles.bleed}>
              {LEAD_STAGES.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`${t(LEAD_STAGE_LABEL[s])}، ${fmtNum(d.pipeline[s], lang)}`}
                  onPress={() => router.push({ pathname: '/agent/leads', params: { stage: s } })}
                  style={({ pressed }) => [styles.stage, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
                >
                  <View style={[styles.dot, { backgroundColor: LEAD_STAGE_COLOUR[s] }]} />
                  <Txt size={22} weight="semibold">
                    {fmtNum(d.pipeline[s], lang)}
                  </Txt>
                  <Txt size={12} color="ink2" numberOfLines={1}>
                    {t(LEAD_STAGE_LABEL[s])}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          </Section>

          {d.firstCall.length ? (
            <Section title={t('محتاجين تتواصل معاهم', 'Needs a first call')}>
              {d.firstCall.map((l) => (
                <LeadRow key={l.id} lead={l} firstCall />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Txt size={22} weight="semibold" color={gold ? 'accentInk' : 'ink'}>
        {value}
      </Txt>
      <Txt size={11.5} color="ink2" numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** Deals won this month against the target, and how that compares with the team's average. */
function TargetCard({ won, target, teamAvg }: { won: number; target: number; teamAvg: number }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const { share, vsTeam } = targetProgress({ won, target, teamAvg });
  const Trend = vsTeam !== null && vsTeam < 0 ? TrendingDown : TrendingUp;
  const vsText =
    vsTeam === null
      ? null
      : vsTeam === 0
        ? t('زي متوسط الفريق', 'Level with the team average')
        : vsTeam > 0
          ? t(`أعلى من متوسط الفريق بـ ${fmtNum(vsTeam, 'ar')}٪`, `${vsTeam}% above team average`)
          : t(`أقل من متوسط الفريق بـ ${fmtNum(-vsTeam, 'ar')}٪`, `${-vsTeam}% below team average`);
  return (
    <View style={[styles.target, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.between}>
        <View style={styles.inline}>
          <Target size={16} color={colors.accent} />
          <Txt size={14} weight="semibold">
            {t('هدف الشهر', 'Monthly target')}
          </Txt>
        </View>
        <Txt size={13} color="ink2">
          {target > 0 ? `${fmtNum(won, lang)} / ${fmtNum(target, lang)} ${t('صفقات', 'deals')}` : `${fmtNum(won, lang)} ${t('صفقات', 'deals')}`}
        </Txt>
      </View>
      {share !== null ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('هدف الشهر', 'Monthly target')}
          accessibilityValue={{ min: 0, max: target, now: Math.min(won, target) }}
          style={[styles.track, { backgroundColor: colors.surface2 }]}
        >
          <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: colors.accent }]} />
        </View>
      ) : (
        <Txt size={12} color="ink3">
          {t('مفيش هدف متحدد للشهر ده.', 'No target set for this month.')}
        </Txt>
      )}
      {vsText ? (
        <View style={styles.inline}>
          <Trend size={14} color={vsTeam! < 0 ? colors.ink3 : colors.success} />
          <Txt size={11.5} style={{ color: vsTeam! < 0 ? colors.ink2 : colors.success }}>
            {vsText}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

function Section({ title, action, children }: { title: string; action?: { label: string; onPress: () => void }; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.between}>
        <Txt accessibilityRole="header" size={17} weight="semibold">
          {title}
        </Txt>
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={10}>
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
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  flex: { flex: 1 },
  badge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: radius.lg, borderWidth: 1, padding: 12, gap: 2 },
  target: { borderRadius: radius.lg, borderWidth: 1, padding: 16, gap: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  track: { height: 10, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  section: { gap: 12, marginTop: 16 },
  note: { borderRadius: radius.lg, borderWidth: 1, padding: 16 },
  bleed: { marginHorizontal: -16 },
  pipeline: { gap: 8, paddingHorizontal: 16 },
  stage: { width: 104, borderRadius: radius.lg, borderWidth: 1, padding: 12, gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
