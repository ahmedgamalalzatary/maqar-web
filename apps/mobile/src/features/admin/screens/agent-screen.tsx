import { type AdminAgentDetail, fmtDate, fmtNum, fmtTime, weekdayName } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Phone, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { Toggle } from '@/components/toggle';
import { ApiError } from '@/core/api/api';
import { initialsOf, useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { ListingsError } from '@/features/listings/components/list-states';
import { draftOf } from '../components/week-editor';
import { useAgent, useRemoveDayOff, useSaveAgent } from '../hooks/use-admin';
import { DaysOffSheet, HoursSheet } from './agents-screen';

/** Saturday first, as the week runs in Egypt. */
const ORDER = [6, 0, 1, 2, 3, 4, 5];
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** `/admin/agent/:id` (phase 18): the agent's profile, whether they are on, their week and days off. */
export function AgentScreen({ id }: { id: number }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const agent = useAgent(id);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/agents'));
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
      </View>
      {agent.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : agent.isError ? (
        <View style={styles.pad}>
          {agent.error instanceof ApiError && agent.error.status === 404 ? <Txt align="center">{t('المسؤول ده مش موجود.', 'This agent does not exist.')}</Txt> : <ListingsError onRetry={() => void agent.refetch()} />}
        </View>
      ) : (
        <Body a={agent.data} />
      )}
    </View>
  );
}

function Body({ a }: { a: AdminAgentDetail }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const save = useSaveAgent(a.id);
  const removeDay = useRemoveDayOff(a.id);
  const [sheet, setSheet] = useState<'hours' | 'off' | null>(null);
  const name = lang === 'ar' ? a.nameAr : a.nameEn;
  const byDay = new Map(a.hours.map((h) => [h.weekday, h]));

  const setActive = (active: boolean) =>
    save.mutate(
      { active },
      {
        onSuccess: () => toast.show({ title: active ? t('المسؤول رجع يشتغل', 'The agent is on again') : t('المسؤول اتوقف واتعمله خروج', 'The agent is turned off and signed out'), tone: 'sage' }),
        onError: (e) =>
          toast.show({
            title: e instanceof ApiError && e.status === 409 ? t('انقل عقاراته المنشورة لمسؤول تاني الأول', 'Move their live listings to someone else first') : t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'),
            tone: 'danger',
          }),
      },
    );

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: a.colour }]}>
          <Txt size={20} weight="semibold" style={styles.white}>
            {initialsOf(name, lang, 2)}
          </Txt>
        </View>
        <View style={styles.flex}>
          <Txt accessibilityRole="header" size={22} weight="semibold">
            {name}
          </Txt>
          <Txt size={13} color="ink2">
            {lang === 'ar' ? a.roleTitleAr : a.roleTitleEn}
          </Txt>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.line}>
          <View style={styles.flex}>
            <Txt size={13}>{a.email}</Txt>
            <Txt size={13} color="ink2">
              {a.phone}
            </Txt>
          </View>
          <IconButton label={t('اتصال', 'Call')} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${a.phone}`)} />
        </View>
        <Txt size={12} color="ink3">
          {t(
            `${fmtNum(a.live, 'ar')} عقار منشور | ${fmtNum(a.openLeads, 'ar')} عميل مفتوح | الهدف ${fmtNum(a.monthlyTarget, 'ar')} في الشهر`,
            `${a.live} live | ${a.openLeads} open leads | target ${a.monthlyTarget} a month`,
          )}
        </Txt>
        <View style={styles.line}>
          <Txt size={14} style={styles.flex}>
            {t('شغال (يقدر يدخل ويتحطله عقارات)', 'On (can sign in and get listings)')}
          </Txt>
          <Toggle label={t('شغال (يقدر يدخل ويتحطله عقارات)', 'On (can sign in and get listings)')} value={a.active} disabled={save.isPending} onChange={setActive} />
        </View>
        <Button label={t('عدّل البيانات', 'Edit details')} variant="secondary" onPress={() => router.push(`/admin/agent/${a.id}/edit`)} />
      </View>

      <View style={styles.section}>
        <View style={styles.line}>
          <Txt size={16} weight="semibold" style={styles.flex}>
            {t('مواعيد الشغل', 'Working hours')}
          </Txt>
          <Button label={t('غيّر', 'Change')} variant="ghost" onPress={() => setSheet('hours')} />
        </View>
        {a.defaultHours ? (
          <Txt size={12} color="ink3">
            {t('المواعيد الافتراضية: كل يوم ١٠ لـ ٨، والجمعة من ٢.', 'The default week: every day 10 to 8, Friday from 2.')}
          </Txt>
        ) : null}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {ORDER.map((d) => {
            const h = byDay.get(d);
            return (
              <View key={d} style={styles.dayRow}>
                <Txt size={13} style={styles.dayName}>
                  {weekdayName(d, lang)}
                </Txt>
                <Txt size={13} color={h ? 'ink' : 'ink3'}>
                  {h ? `${fmtTime(hh(h.from), lang)} – ${fmtTime(hh(h.to), lang)}` : t('إجازة', 'Day off')}
                </Txt>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.line}>
          <Txt size={16} weight="semibold" style={styles.flex}>
            {t('الإجازات الجاية', 'Coming days off')}
          </Txt>
          <Button label={t('أضف', 'Add')} variant="ghost" onPress={() => setSheet('off')} />
        </View>
        {a.daysOff.length ? (
          a.daysOff.map((d) => (
            <View key={d.date} style={[styles.offRow, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={styles.flex}>
                <Txt size={14}>{fmtDate(d.date, lang, 'weekday')}</Txt>
                {d.reason ? (
                  <Txt size={12} color="ink2">
                    {d.reason}
                  </Txt>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(`شيل إجازة ${fmtDate(d.date, 'ar', 'weekday')}`, `Remove the day off on ${fmtDate(d.date, 'en', 'weekday')}`)}
                onPress={() => removeDay.mutate(d.date, { onError: () => toast.show({ title: t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'), tone: 'danger' }) })}
                hitSlop={8}
              >
                <Trash2 size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))
        ) : (
          <Txt size={13} color="ink3">
            {t('مفيش إجازات جاية.', 'No days off coming up.')}
          </Txt>
        )}
      </View>

      <HoursSheet open={sheet === 'hours'} agentIds={[a.id]} start={draftOf(a.hours)} onClose={() => setSheet(null)} onDone={() => setSheet(null)} />
      <DaysOffSheet open={sheet === 'off'} agentIds={[a.id]} onClose={() => setSheet(null)} onDone={() => setSheet(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  top: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row' },
  loading: { marginTop: 48 },
  pad: { padding: 24 },
  content: { paddingHorizontal: 16, gap: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  section: { gap: 8 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayName: { width: 90 },
  offRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, borderWidth: 1, padding: 12 },
});
