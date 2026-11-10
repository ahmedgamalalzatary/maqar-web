import { type AdminAgentItem, fmtNum } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { Check, Plus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { initialsOf, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { DayStrip, draftOf, nextDays, WeekEditor, type WeekDraft, weekOf } from '../components/week-editor';
import { useAddDaysOff, useAgents, useSetHours } from '../hooks/use-admin';

const DEFAULT_WEEK = draftOf([0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, from: weekday === 5 ? 14 : 10, to: 20 })));

/** The admin's Agents tab (phase 18): every agent; pick several to set their hours or days off at once. */
export function AgentsScreen() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const agents = useAgents();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [sheet, setSheet] = useState<'hours' | 'off' | null>(null);
  const list = agents.data ?? [];
  const toggle = (id: number) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const done = () => {
    setSheet(null);
    setPicking(false);
    setPicked([]);
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <FlatList
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        data={agents.isSuccess ? list : []}
        keyExtractor={(a) => String(a.id)}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        renderItem={({ item }) => (
          <AgentRow agent={item} picking={picking} picked={picked.includes(item.id)} onPress={() => (picking ? toggle(item.id) : router.push(`/admin/agent/${item.id}`))} />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <Txt accessibilityRole="header" size={24} weight="semibold">
                  {t('المسؤولين', 'Agents')}
                </Txt>
                {agents.isSuccess ? (
                  <Txt size={13} color="ink2">
                    {t(`${fmtNum(list.filter((a) => a.active).length, 'ar')} شغالين`, `${list.filter((a) => a.active).length} active`)}
                  </Txt>
                ) : null}
              </View>
              <IconButton icon={<Plus size={20} color={colors.ink} />} label={t('أضف مسؤول', 'Add an agent')} onPress={() => router.push('/admin/agent/new')} />
            </View>
            <Button
              label={picking ? t('إلغاء الاختيار', 'Cancel') : t('اختار كذا مسؤول', 'Pick several agents')}
              variant="secondary"
              onPress={() => {
                setPicking(!picking);
                setPicked([]);
              }}
            />
          </View>
        }
        ListEmptyComponent={
          agents.isPending ? (
            <CardSkeleton />
          ) : agents.isError ? (
            <ListingsError onRetry={() => void agents.refetch()} />
          ) : (
            <View style={styles.empty}>
              <Users size={32} color={colors.ink3} strokeWidth={1.6} />
              <Txt weight="medium">{t('لسه مفيش مسؤولين', 'No agents yet')}</Txt>
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={agents.isRefetching} onRefresh={() => void agents.refetch()} tintColor={colors.accent} />}
      />
      {picking ? (
        <View style={[styles.bar, { paddingBottom: 10, borderTopColor: colors.line, backgroundColor: colors.surface }]}>
          <Txt size={13} color="ink2" style={styles.flex}>
            {t(`${fmtNum(picked.length, lang)} مختارين`, `${picked.length} picked`)}
          </Txt>
          <Button label={t('المواعيد', 'Hours')} disabled={!picked.length} onPress={() => setSheet('hours')} />
          <Button label={t('إجازة', 'Day off')} variant="secondary" disabled={!picked.length} onPress={() => setSheet('off')} />
        </View>
      ) : null}
      <HoursSheet open={sheet === 'hours'} agentIds={picked} start={DEFAULT_WEEK} onClose={() => setSheet(null)} onDone={done} />
      <DaysOffSheet open={sheet === 'off'} agentIds={picked} onClose={() => setSheet(null)} onDone={done} />
    </View>
  );
}

/** One agent; in pick mode a checkbox. */
function AgentRow({ agent, picking: pick, picked: on, onPress }: { agent: AdminAgentItem; picking: boolean; picked: boolean; onPress: () => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const name = lang === 'ar' ? agent.nameAr : agent.nameEn;
  return (
    <Pressable
      accessibilityRole={pick ? 'checkbox' : 'button'}
      accessibilityState={pick ? { checked: on } : undefined}
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: on ? colors.accent : colors.line, opacity: pressed ? 0.85 : agent.active ? 1 : 0.6 }]}
    >
      <View style={[styles.avatar, { backgroundColor: agent.colour }]}>
        <Txt weight="semibold" style={styles.white}>
          {initialsOf(name, lang, 2)}
        </Txt>
      </View>
      <View style={styles.flex}>
        <Txt weight="medium">{name}</Txt>
        <Txt size={12} color="ink2" numberOfLines={1}>
          {lang === 'ar' ? agent.roleTitleAr : agent.roleTitleEn}
        </Txt>
        <Txt size={12} color="ink3">
          {agent.active
            ? t(`${fmtNum(agent.live, 'ar')} عقار منشور | ${fmtNum(agent.openLeads, 'ar')} عميل مفتوح`, `${agent.live} live | ${agent.openLeads} open leads`)
            : t('موقوف', 'Turned off')}
        </Txt>
      </View>
      {pick ? <View style={[styles.check, { borderColor: on ? colors.accent : colors.line2, backgroundColor: on ? colors.accent : 'transparent' }]}>{on ? <Check size={14} color={colors.navy} /> : null}</View> : null}
    </Pressable>
  );
}

/** One week for one agent or several. */
export function HoursSheet({ open, agentIds, start, onClose, onDone }: { open: boolean; agentIds: number[]; start: WeekDraft; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [week, setWeek] = useState(start);
  const [shown, setShown] = useState(open);
  if (open !== shown) {
    setShown(open);
    if (open) setWeek(start);
  }
  const save = useSetHours();
  const days = weekOf(week);
  return (
    <Sheet open={open} onClose={onClose} title={agentIds.length > 1 ? t('مواعيد المسؤولين المختارين', 'Hours of the picked agents') : t('مواعيد الشغل', 'Working hours')} scroll>
      <Txt size={13} color="ink2">
        {t('المعاينات ورد الشات الأوتوماتيك بيمشوا على المواعيد دي على طول.', 'Viewing slots and the chat’s away reply follow these hours at once.')}
      </Txt>
      <WeekEditor value={week} onChange={setWeek} />
      <Button
        label={t('احفظ المواعيد', 'Save hours')}
        disabled={!days.length}
        loading={save.isPending}
        onPress={() =>
          save.mutate(
            { agentIds, hours: days },
            {
              onSuccess: () => {
                toast.show({ title: t('المواعيد اتحفظت', 'Hours saved'), tone: 'sage' });
                onDone();
              },
              onError: () => toast.show({ title: t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'), tone: 'danger' }),
            },
          )
        }
      />
    </Sheet>
  );
}

/** A day off or a holiday (a first and a last day) for one agent or several. */
export function DaysOffSheet({ open, agentIds, onClose, onDone }: { open: boolean; agentIds: number[]; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const days = nextDays(60);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const add = useAddDaysOff();
  const bad = !from || (to !== null && to < from);
  return (
    <Sheet open={open} onClose={onClose} title={t('إجازة', 'Day off')} scroll>
      <DayStrip label={t('من يوم', 'From')} days={days} value={from} onChange={(d) => {
          setFrom(d);
          if (to && to < d) setTo(null);
        }} />
      <DayStrip label={t('لحد يوم (اختياري)', 'To (optional)')} days={from ? days.filter((d) => d >= from) : days} value={to} onChange={setTo} />
      <TextField label={t('السبب (اختياري)', 'Reason (optional)')} value={reason} onChangeText={setReason} maxLength={100} />
      <Button
        label={t('احفظ الإجازة', 'Save day off')}
        disabled={bad}
        loading={add.isPending}
        onPress={() =>
          add.mutate(
            { agentIds, from: from!, to: to ?? undefined, reason: reason.trim() || undefined },
            {
              onSuccess: (res) => {
                const booked = res.booked.reduce((n, b) => n + b.viewings, 0);
                toast.show({
                  title: t(`اتضاف ${fmtNum(res.days, 'ar')} يوم إجازة`, `${res.days} days off added`),
                  body: booked ? t(`فيه ${fmtNum(booked, 'ar')} معاينة محجوزة في الأيام دي، اتفق مع العملاء على ميعاد تاني.`, `${booked} viewings are booked on those days: agree another time with the clients.`) : undefined,
                  tone: booked ? 'gold' : 'sage',
                });
                setFrom(null);
                setTo(null);
                setReason('');
                onDone();
              },
              onError: () => toast.show({ title: t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'), tone: 'danger' }),
            },
          )
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 12, marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  gap: { height: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
});
