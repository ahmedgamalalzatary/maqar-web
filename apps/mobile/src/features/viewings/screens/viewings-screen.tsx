import { pickField, fmtDate, fmtTime, canChangeViewing, isActiveViewing, isUpcoming, relTime, VIEWING_STATUS_LABEL, type ViewingItem, type ViewingStatus } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CalendarCheck, CalendarClock, CalendarPlus, type LucideIcon, MapPin, Navigation, Phone, RefreshCw, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { useLogoRefresh } from '@/components/logo-refresh';
import { Segmented } from '@/components/segmented';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { mediaUrl } from '@/core/api/api';
import { m, initialsOf, useLang, useT } from '@/core/i18n';
import { type Colors, radius, useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { directionsUrl } from '@/features/property/directions';
import { addToCalendar } from '../calendar';
import { useUpdateViewing, useViewings } from '../hooks/use-viewings';

/** The Viewings tab (contract §8.8): upcoming and past, with change, calendar, directions and cancel. */
export function ViewingsScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const viewings = useViewings();
  const refresh = useLogoRefresh({ refreshing: viewings.isRefetching, onRefresh: () => void viewings.refetch(), top: insets.top + 8 });
  const update = useUpdateViewing();
  const [tab, setTab] = useState<'up' | 'past'>('up');
  const [cancelling, setCancelling] = useState<ViewingItem | null>(null);
  const all = viewings.data ?? [];
  const time = (v: ViewingItem) => Date.parse(v.startsAt);
  // Upcoming: soonest first. Past: most recent first.
  const up = all.filter((v) => isUpcoming(v)).sort((a, b) => time(a) - time(b));
  const past = all.filter((v) => !isUpcoming(v)).sort((a, b) => time(b) - time(a));
  const list = tab === 'up' ? up : past;

  const cancel = () => {
    const v = cancelling;
    setCancelling(null);
    if (!v) return;
    update.mutate(
      { id: v.id, body: { action: 'cancel' } },
      {
        onSuccess: () => toast.show({ title: t(m.viewings.viewingCancelled), tone: 'sage' }),
        onError: () => toast.show({ title: t(m.viewings.weCouldntCancelItTry), tone: 'danger' }),
      },
    );
  };

  const empty = !signedIn ? (
    <Message
      title={t(m.viewings.signInToBookViewings)}
      body={t(m.viewings.pickAHomeChooseThe)}
      action={{ label: t(m.common.signIn), onPress: () => router.push('/sign-in') }}
    />
  ) : viewings.isPending ? (
    <CardSkeleton />
  ) : viewings.isError ? (
    <ListingsError onRetry={() => void viewings.refetch()} />
  ) : (
    <Message
      title={tab === 'up' ? t(m.viewings.noUpcomingViewings) : t(m.viewings.noPastViewingsYet)}
      body={t(m.viewings.pickAHomeChooseThe2)}
      action={{ label: t(m.common.exploreHomes), onPress: () => router.push('/explore') }}
    />
  );

  return (
    <>
      {refresh.indicator}
      <FlatList
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        data={signedIn ? list : []}
        keyExtractor={(v) => String(v.id)}
        renderItem={({ item }) => <ViewingCard v={item} onCancel={() => setCancelling(item)} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Txt accessibilityRole="header" size={24} weight="semibold">
              {t(m.common.myViewings)}
            </Txt>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'up', label: t(m.viewings.upcoming) },
                { value: 'past', label: t(m.viewings.pastCancelled) },
              ]}
            />
          </View>
        }
        ListEmptyComponent={empty}
        refreshControl={
          signedIn ? refresh.refreshControl : undefined
        }
      />
      <Sheet open={!!cancelling} onClose={() => setCancelling(null)} title={t(m.viewings.cancelThisViewing)}>
        <Txt color="ink2">{t(m.viewings.ifTheTimeJustDoesnt)}</Txt>
        <View style={styles.sheetActions}>
          <Button label={t(m.viewings.cancelViewing)} variant="danger" onPress={cancel} />
          <Button label={t(m.viewings.keepIt)} variant="secondary" onPress={() => setCancelling(null)} />
        </View>
      </Sheet>
    </>
  );
}

const STATUS_TONE: Record<ViewingStatus, (c: Colors) => [string, string]> = {
  confirmed: (c) => [c.successSoft, c.success],
  rescheduled: (c) => [c.accentSoft, c.accentInk],
  cancelled: (c) => [c.dangerSoft, c.danger],
  completed: (c) => [c.sageSoft, c.sageInk],
  // Booked from a chat, waiting for the advisor (2026-11-14).
  pending: (c) => [c.accentSoft, c.accentInk],
};

function ViewingCard({ v, onCancel }: { v: ViewingItem; onCancel: () => void }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const p = v.property;
  const title = pickField(p, 'title', lang);
  const agentName = pickField(v.agent, 'name', lang);
  const [bg, fg] = STATUS_TONE[v.status](colors);
  const active = isActiveViewing(v) && isUpcoming(v);
  // Once it has started the server refuses a change or a cancel, so the card stops offering them.
  const changeable = canChangeViewing(v);
  const cover = mediaUrl(p.cover);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push(`/property/${p.id}`)} style={[styles.photo, { backgroundColor: colors.surface2 }]}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={[styles.badge, { backgroundColor: bg }]}>
          <Txt size={11} weight="semibold" style={{ color: fg }}>
            {t(VIEWING_STATUS_LABEL[v.status])}
          </Txt>
        </View>
        <View style={styles.photoText}>
          <Txt size={15} weight="semibold" numberOfLines={1} style={styles.white}>
            {title}
          </Txt>
          <View style={styles.inline}>
            <MapPin size={14} color="#fff" />
            <Txt size={12} numberOfLines={1} style={[styles.white, styles.flex]}>
              {`${pickField(p, 'compound', lang)} | ${pickField(p.area, 'name', lang)}`}
            </Txt>
          </View>
        </View>
      </Pressable>

      <View style={styles.when}>
        <View style={[styles.whenIcon, { backgroundColor: colors.accentSoft }]}>
          <CalendarClock size={20} color={colors.accentInk} />
        </View>
        <View style={styles.flex}>
          <Txt size={14} weight="semibold">
            {fmtDate(v.date, lang, 'long')}
          </Txt>
          <Txt size={12.5} color="ink2">
            {fmtTime(v.time, lang)} | {t(m.common.onSite)}
            {active ? <Txt size={12.5} color="accentInk">{` | ${relTime(new Date(v.startsAt), lang)}`}</Txt> : null}
          </Txt>
          {v.rescheduledFrom ? (
            <Txt size={11} color="ink3">
              {t(m.viewings.was)} {fmtDate(v.rescheduledFrom.date, lang)} {fmtTime(v.rescheduledFrom.time, lang)}
            </Txt>
          ) : null}
        </View>
      </View>

      <View style={[styles.agent, { backgroundColor: colors.surface2 }]}>
        <View style={[styles.avatar, { backgroundColor: v.agent.colour }]}>
          <Txt size={14} weight="semibold" style={styles.white}>
            {initialsOf(pickField(v.agent, 'name', lang), lang)}
          </Txt>
        </View>
        <View style={styles.flex}>
          <Txt size={11} color="ink3">
            {t(m.common.salesAdvisor)}
          </Txt>
          <Txt size={13} weight="semibold" numberOfLines={1}>
            {agentName}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(m.viewings.callAgent(agentName))}
          onPress={() => void Linking.openURL(`tel:${v.agent.phone}`)}
          style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.line }]}
        >
          <Phone size={16} color={colors.accentInk} />
        </Pressable>
      </View>

      {active ? (
        <View style={styles.actions}>
          {changeable ? <Action icon={RefreshCw} label={t(m.viewings.change)} onPress={() => router.push(`/property/${p.id}/book?reschedule=${v.id}`)} /> : null}
          <Action
            icon={CalendarPlus}
            label={t(m.viewings.calendar)}
            onPress={() =>
              addToCalendar(v.id).catch(() => toast.show({ title: t(m.common.weCouldntPrepareTheCalendar), tone: 'danger' }))
            }
          />
          {v.location ? <Action icon={Navigation} label={t(m.common.directions)} onPress={() => void Linking.openURL(directionsUrl(v.location!))} /> : null}
          {changeable ? <Action icon={XCircle} label={t(m.common.cancel)} onPress={onCancel} danger /> : null}
        </View>
      ) : p.category !== 'stay' ? (
        <View style={styles.again}>
          <Button label={t(m.viewings.bookAgain)} variant="secondary" onPress={() => router.push(`/property/${p.id}/book`)} />
        </View>
      ) : null}
    </View>
  );
}

function Action({ icon: Icon, label, onPress, danger }: { icon: LucideIcon; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  const color = danger ? colors.danger : colors.ink2;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon size={18} color={color} />
      <Txt size={11.5} weight="medium" style={{ color }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function Message({ title, body, action }: { title: string; body: string; action: { label: string; onPress: () => void } }) {
  const { colors } = useTheme();
  return (
    <View style={styles.message}>
      <CalendarCheck size={32} color={colors.ink3} strokeWidth={1.6} />
      <Txt weight="medium" align="center">
        {title}
      </Txt>
      <Txt size={13} color="ink2" align="center">
        {body}
      </Txt>
      <Button label={action.label} variant="secondary" onPress={action.onPress} style={styles.msgAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 16 },
  gap: { height: 16 },
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  white: { color: '#fff' },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  photo: { height: 128, justifyContent: 'flex-end' },
  badge: { position: 'absolute', top: 12, start: 12, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  photoText: { padding: 12, gap: 2 },
  when: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  whenIcon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  agent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 14, borderRadius: radius.md, padding: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', padding: 8 },
  action: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 10, minHeight: 44 },
  again: { padding: 12 },
  sheetActions: { gap: 8, marginTop: 16 },
  message: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  msgAction: { marginTop: 8, paddingHorizontal: 24 },
});
