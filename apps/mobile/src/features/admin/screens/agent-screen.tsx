import { pickField, type AdminAgentDetail, fmtDate, fmtTime, weekdayName, ltrPhone } from '@mqr/shared';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Phone, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { Toggle } from '@/components/toggle';
import { ApiError } from '@/core/api/api';
import { m, initialsOf, useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { ListingsError } from '@/features/listings/components/list-states';
import { draftOf } from '../components/week-editor';
import { useAdminAgents, useAgent, useRemoveDayOff, useSaveAgent } from '../hooks/use-admin';
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
        <IconButton label={t(m.common.back)} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
      </View>
      {agent.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : agent.isError ? (
        <View style={styles.pad}>
          {agent.error instanceof ApiError && agent.error.status === 404 ? <Txt align="center">{t(m.common.thisAgentDoesNotExist)}</Txt> : <ListingsError onRetry={() => void agent.refetch()} />}
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
  // 'handover' opens when the server refuses to turn off an advisor who still has open work.
  const [sheet, setSheet] = useState<'hours' | 'off' | 'handover' | null>(null);
  const others = (useAdminAgents(sheet === 'handover').data ?? []).filter((x) => x.id !== a.id);
  const name = pickField(a, 'name', lang);
  const byDay = new Map(a.hours.map((h) => [h.weekday, h]));

  const setActive = (active: boolean, reassignTo?: number) =>
    save.mutate(
      { active, ...(reassignTo === undefined ? {} : { reassignTo }) },
      {
        onSuccess: () => {
          setSheet(null);
          toast.show({ title: active ? t(m.admin.theAgentIsOnAgain) : t(m.admin.theAgentIsTurnedOff), tone: 'sage' });
        },
        onError: (e) => {
          // Upcoming viewings, chats or open leads: the admin picks who takes them over.
          if (!active && e instanceof ApiError && e.status === 409 && /reassignTo/.test(e.message)) return setSheet('handover');
          toast.show({
            title: e instanceof ApiError && e.status === 409 ? t(m.admin.moveTheirLiveListingsTo) : t(m.common.somethingWentWrongTryAgain),
            tone: 'danger',
          });
        },
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
            {pickField(a, 'roleTitle', lang)}
          </Txt>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.line}>
          <View style={styles.flex}>
            <Txt size={13}>{a.email}</Txt>
            <Txt size={13} color="ink2">
              {a.phone ? ltrPhone(a.phone) : null}
            </Txt>
          </View>
          <IconButton label={t(m.common.call)} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${a.phone}`)} />
        </View>
        <Txt size={12} color="ink3">
          {t(m.admin.agentStats(a.live, a.openLeads, a.monthlyTarget))}
        </Txt>
        <View style={styles.line}>
          <Txt size={14} style={styles.flex}>
            {t(m.common.onCanSignInAnd)}
          </Txt>
          <Toggle label={t(m.common.onCanSignInAnd)} value={a.active} disabled={save.isPending} onChange={setActive} />
        </View>
        <Button label={t(m.common.editDetails)} variant="secondary" onPress={() => router.push(`/admin/agent/${a.id}/edit`)} />
      </View>

      <View style={styles.section}>
        <View style={styles.line}>
          <Txt size={16} weight="semibold" style={styles.flex}>
            {t(m.common.workingHours)}
          </Txt>
          <Button label={t(m.common.change)} variant="ghost" onPress={() => setSheet('hours')} />
        </View>
        {a.defaultHours ? (
          <Txt size={12} color="ink3">
            {t(m.admin.theDefaultWeekEveryDay)}
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
                  {h ? `${fmtTime(hh(h.from), lang)} – ${fmtTime(hh(h.to), lang)}` : t(m.common.dayOff)}
                </Txt>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.line}>
          <Txt size={16} weight="semibold" style={styles.flex}>
            {t(m.admin.comingDaysOff)}
          </Txt>
          <Button label={t(m.common.add)} variant="ghost" onPress={() => setSheet('off')} />
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
                accessibilityLabel={t(m.admin.removeDayOff(d.date))}
                onPress={() => removeDay.mutate(d.date, { onError: () => toast.show({ title: t(m.common.somethingWentWrongTryAgain), tone: 'danger' }) })}
                hitSlop={8}
              >
                <Trash2 size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))
        ) : (
          <Txt size={13} color="ink3">
            {t(m.admin.noDaysOffComingUp)}
          </Txt>
        )}
      </View>

      <HoursSheet open={sheet === 'hours'} agentIds={[a.id]} start={draftOf(a.hours)} onClose={() => setSheet(null)} onDone={() => setSheet(null)} />
      <DaysOffSheet open={sheet === 'off'} agentIds={[a.id]} onClose={() => setSheet(null)} onDone={() => setSheet(null)} />
      <Sheet open={sheet === 'handover'} onClose={() => setSheet(null)} title={t(m.admin.whoTakesTheirWork)} scroll>
        <Txt size={13} color="ink2">
          {t(m.admin.theyStillHaveUpcomingViewings)}
        </Txt>
        {others.map((x) => (
          <Pressable
            key={x.id}
            accessibilityRole="button"
            accessibilityLabel={pickField(x, 'name', lang)}
            disabled={save.isPending}
            onPress={() => setActive(false, x.id)}
            style={({ pressed }) => [styles.offRow, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 }]}
          >
            <Txt weight="medium" style={styles.flex}>
              {pickField(x, 'name', lang)}
            </Txt>
            <Txt size={12} color="ink2">
              {t(m.common.liveListings(x.live))}
            </Txt>
          </Pressable>
        ))}
      </Sheet>
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
