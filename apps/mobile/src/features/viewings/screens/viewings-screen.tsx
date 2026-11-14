import { fmtDate, fmtTime, canChangeViewing, isActiveViewing, isUpcoming, relTime, type ViewingItem, type ViewingStatus } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CalendarCheck, CalendarClock, CalendarPlus, type LucideIcon, MapPin, Navigation, Phone, RefreshCw, XCircle } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Segmented } from '@/components/segmented';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { mediaUrl } from '@/core/api/api';
import { initialsOf, useLang, useT } from '@/core/i18n';
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
        onSuccess: () => toast.show({ title: t('تم إلغاء المعاينة', 'Viewing cancelled'), tone: 'sage' }),
        onError: () => toast.show({ title: t('مقدرناش نلغيها، حاول تاني', 'We couldn’t cancel it, try again'), tone: 'danger' }),
      },
    );
  };

  const empty = !signedIn ? (
    <Message
      title={t('سجّل دخولك عشان تحجز معاينة', 'Sign in to book viewings')}
      body={t('اختار وحدة، حدد اليوم والساعة، وهتعرف مين هيقابلك.', 'Pick a home, choose the day and hour, and see who will meet you.')}
      action={{ label: t('تسجيل الدخول', 'Sign in'), onPress: () => router.push('/sign-in') }}
    />
  ) : viewings.isPending ? (
    <CardSkeleton />
  ) : viewings.isError ? (
    <ListingsError onRetry={() => void viewings.refetch()} />
  ) : (
    <Message
      title={tab === 'up' ? t('مفيش معاينات جاية', 'No upcoming viewings') : t('لسه مفيش معاينات سابقة', 'No past viewings yet')}
      body={t('اختار وحدة، حدد اليوم والساعة، وهتعرف مين هيقابلك. من غير مكالمات.', 'Pick a home, choose the day and hour, and see who will meet you. No phone calls.')}
      action={{ label: t('استكشف الوحدات', 'Explore homes'), onPress: () => router.push('/explore') }}
    />
  );

  return (
    <>
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
              {t('معايناتي', 'My viewings')}
            </Txt>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'up', label: t('الجاية', 'Upcoming') },
                { value: 'past', label: t('السابقة والملغاة', 'Past & cancelled') },
              ]}
            />
          </View>
        }
        ListEmptyComponent={empty}
        refreshControl={
          signedIn ? <RefreshControl refreshing={viewings.isRefetching} onRefresh={() => void viewings.refetch()} tintColor={colors.accent} /> : undefined
        }
      />
      <Sheet open={!!cancelling} onClose={() => setCancelling(null)} title={t('إلغاء المعاينة؟', 'Cancel this viewing?')}>
        <Txt color="ink2">{t('لو الميعاد بس مش مناسب، تقدر تغيّره بدل ما تلغيه.', 'If the time just doesn’t suit you, you can reschedule instead.')}</Txt>
        <View style={styles.sheetActions}>
          <Button label={t('إلغاء المعاينة', 'Cancel viewing')} variant="danger" onPress={cancel} />
          <Button label={t('لا، خليها', 'Keep it')} variant="secondary" onPress={() => setCancelling(null)} />
        </View>
      </Sheet>
    </>
  );
}

const STATUS: Record<ViewingStatus, { ar: string; en: string; tone: (c: Colors) => [string, string] }> = {
  confirmed: { ar: 'مؤكدة', en: 'Confirmed', tone: (c) => [c.successSoft, c.success] },
  rescheduled: { ar: 'اتغير موعدها', en: 'Rescheduled', tone: (c) => [c.accentSoft, c.accentInk] },
  cancelled: { ar: 'ملغاة', en: 'Cancelled', tone: (c) => [c.dangerSoft, c.danger] },
  completed: { ar: 'تمت', en: 'Completed', tone: (c) => [c.sageSoft, c.sageInk] },
  // Booked from a chat, waiting for the advisor (2026-11-14).
  pending: { ar: 'مستنية التأكيد', en: 'Awaiting confirmation', tone: (c) => [c.accentSoft, c.accentInk] },
};

function ViewingCard({ v, onCancel }: { v: ViewingItem; onCancel: () => void }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const p = v.property;
  const title = lang === 'ar' ? p.titleAr : p.titleEn;
  const agentName = lang === 'ar' ? v.agent.nameAr : v.agent.nameEn;
  const status = STATUS[v.status];
  const [bg, fg] = status.tone(colors);
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
            {t(status.ar, status.en)}
          </Txt>
        </View>
        <View style={styles.photoText}>
          <Txt size={15} weight="semibold" numberOfLines={1} style={styles.white}>
            {title}
          </Txt>
          <View style={styles.inline}>
            <MapPin size={14} color="#fff" />
            <Txt size={12} numberOfLines={1} style={[styles.white, styles.flex]}>
              {`${lang === 'ar' ? p.compoundAr : p.compoundEn} | ${lang === 'ar' ? p.area.nameAr : p.area.nameEn}`}
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
            {fmtTime(v.time, lang)} | {t('في الموقع', 'On site')}
            {active ? <Txt size={12.5} color="accentInk">{` | ${relTime(new Date(v.startsAt), lang)}`}</Txt> : null}
          </Txt>
          {v.rescheduledFrom ? (
            <Txt size={11} color="ink3">
              {t('كانت', 'Was')} {fmtDate(v.rescheduledFrom.date, lang)} {fmtTime(v.rescheduledFrom.time, lang)}
            </Txt>
          ) : null}
        </View>
      </View>

      <View style={[styles.agent, { backgroundColor: colors.surface2 }]}>
        <View style={[styles.avatar, { backgroundColor: v.agent.colour }]}>
          <Txt size={14} weight="semibold" style={styles.white}>
            {initialsOf(lang === 'ar' ? v.agent.nameAr : v.agent.nameEn, lang)}
          </Txt>
        </View>
        <View style={styles.flex}>
          <Txt size={11} color="ink3">
            {t('مسؤول المبيعات', 'Sales advisor')}
          </Txt>
          <Txt size={13} weight="semibold" numberOfLines={1}>
            {agentName}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(`اتصل بـ${agentName}`, `Call ${agentName}`)}
          onPress={() => void Linking.openURL(`tel:${v.agent.phone}`)}
          style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.line }]}
        >
          <Phone size={16} color={colors.accentInk} />
        </Pressable>
      </View>

      {active ? (
        <View style={styles.actions}>
          {changeable ? <Action icon={RefreshCw} label={t('تغيير', 'Change')} onPress={() => router.push(`/property/${p.id}/book?reschedule=${v.id}`)} /> : null}
          <Action
            icon={CalendarPlus}
            label={t('للتقويم', 'Calendar')}
            onPress={() =>
              addToCalendar(v.id).catch(() => toast.show({ title: t('مقدرناش نجهز ملف التقويم', 'We couldn’t prepare the calendar file'), tone: 'danger' }))
            }
          />
          {v.location ? <Action icon={Navigation} label={t('الاتجاهات', 'Directions')} onPress={() => void Linking.openURL(directionsUrl(v.location!))} /> : null}
          {changeable ? <Action icon={XCircle} label={t('إلغاء', 'Cancel')} onPress={onCancel} danger /> : null}
        </View>
      ) : p.category !== 'stay' ? (
        <View style={styles.again}>
          <Button label={t('احجز ميعاد جديد', 'Book again')} variant="secondary" onPress={() => router.push(`/property/${p.id}/book`)} />
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
