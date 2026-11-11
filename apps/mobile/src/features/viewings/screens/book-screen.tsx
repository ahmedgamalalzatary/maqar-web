import { fmtDate, fmtNum, fmtTime, type PropertyDetail, type ReminderOffset, type Slot, type ViewingItem } from '@maqar/shared';
import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarPlus,
  Check,
  Clock,
  type LucideIcon,
  MapPin,
  Moon,
  Sun,
  Sunrise,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { initialsOf, useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useProperty } from '@/features/property/hooks/use-property';
import { addToCalendar } from '../calendar';
import { useBook, useSlots, useUpdateViewing, useViewings } from '../hooks/use-viewings';

const REMINDERS: { key: ReminderOffset; ar: string; en: string }[] = [
  { key: '1d', ar: 'قبلها بيوم', en: '1 day before' },
  { key: '2h', ar: 'قبلها بساعتين', en: '2 hours before' },
  { key: '30m', ar: 'قبلها بنص ساعة', en: '30 min before' },
];

const hourOf = (time: string) => Number(time.slice(0, 2));

/**
 * `/property/:id/book` (contract §8.7): pick a day and an hour with the home's advisor, choose
 * reminders, confirm. With `reschedule` it moves that viewing instead, starting from its time.
 */
export function BookScreen({ id, reschedule }: { id: number; reschedule?: number }) {
  const property = useProperty(id);
  const existing = useViewings((items) => items.find((v) => v.id === reschedule));
  const { colors } = useTheme();
  // isLoading, not isPending: for a guest the viewings query is off and would stay pending for ever.
  if (property.isPending || (reschedule && existing.isLoading)) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  // A transient failure offers a retry; a home or viewing that really is not there does not.
  if (property.isError || (reschedule && existing.isError)) {
    return (
      <Failed
        retry={() => {
          void property.refetch();
          if (reschedule) void existing.refetch();
        }}
        home={`/property/${id}`}
      />
    );
  }
  if (!property.data || (reschedule && !existing.data)) return <Failed home={`/property/${id}`} />;
  return <Book p={property.data} existing={existing.data} />;
}

/** Booking could not open: say so, offer a retry when it might be temporary, and a useful Back. */
function Failed({ retry, home }: { retry?: () => void; home?: Href }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const back = () => (home && router.canGoBack() ? router.back() : home ? router.replace(home) : router.replace('/'));
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: colors.bg, padding: 24, gap: 12 }]}>
      <Txt align="center">{t('مش قادرين نفتح الحجز دلوقتي.', 'We couldn’t open booking right now.')}</Txt>
      {retry ? <Button label={t('حاول تاني', 'Try again')} onPress={retry} /> : null}
      <Button label={t('رجوع', 'Back')} variant="secondary" onPress={back} />
    </View>
  );
}

function Book({ p, existing }: { p: PropertyDetail; existing?: ViewingItem }) {
  const t = useT();
  const lang = useLang();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const requireAuth = useRequireAuth();
  const slots = useSlots(p.id, existing?.id);
  const book = useBook();
  const update = useUpdateViewing();
  const [picked, setPicked] = useState<string | null>(existing?.date ?? null);
  const [pickedTime, setTime] = useState<string | null>(existing?.time ?? null);
  const [reminders, setReminders] = useState<ReminderOffset[]>(existing?.reminders ?? ['1d', '2h']);
  const [done, setDone] = useState<ViewingItem | null>(null);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const title = lang === 'ar' ? p.titleAr : p.titleEn;
  const place = `${lang === 'ar' ? p.compoundAr : p.compoundEn} | ${lang === 'ar' ? p.area.nameAr : p.area.nameEn}`;
  const agentName = lang === 'ar' ? p.agent.nameAr : p.agent.nameEn;
  const busy = book.isPending || update.isPending;

  if (done) return <Done v={done} rescheduled={!!existing} />;

  const days = slots.data?.days ?? [];
  const date = picked ?? slots.data?.defaultDate ?? null;
  const day = days.find((d) => d.date === date);
  // The times refresh whenever the screen comes back: a picked time counts only while it is still free.
  // A failed availability refresh leaves the old slots on screen, but they are no longer trusted:
  // nothing counts as selected until the times load again (the server stays the final word).
  const time = !slots.isError && pickedTime && day?.slots.some((s) => s.time === pickedTime && s.state === 'free') ? pickedTime : null;
  const groups: { icon: LucideIcon; label: string; slots: Slot[] }[] = [
    { icon: Sunrise, label: t('الصبح', 'Morning'), slots: (day?.slots ?? []).filter((s) => hourOf(s.time) < 13) },
    { icon: Sun, label: t('بعد الضهر', 'Afternoon'), slots: (day?.slots ?? []).filter((s) => hourOf(s.time) >= 13 && hourOf(s.time) < 17) },
    { icon: Moon, label: t('بالليل', 'Evening'), slots: (day?.slots ?? []).filter((s) => hourOf(s.time) >= 17) },
  ].filter((g) => g.slots.length);

  const stateLabel = (s: Slot) =>
    ({ free: '', taken: t('محجوزة', 'taken'), past: t('فاتت', 'past'), closed: t('مقفولة', 'closed') })[s.state];

  const failed = (err: unknown) => {
    const already = err instanceof ApiError && /already have a viewing/i.test(err.message);
    const taken = err instanceof ApiError && err.status === 409 && /just booked|no longer free/i.test(err.message);
    // Other 409s say exactly why on the server ("That time is closed", "already started"): pass
    // them through instead of blaming the picked time.
    const reason = err instanceof ApiError && err.status === 409 ? err.message : '';
    toast.show({
      title: already
        ? t('عندك معاينة للوحدة دي بالفعل', 'You already have a viewing for this home')
        : taken
          ? t('الميعاد ده لسه اتحجز، اختار ميعاد تاني', 'That time was just taken. Pick another.')
          : reason || t('مقدرناش نأكد الحجز، حاول تاني', 'We couldn’t confirm that, try again'),
      body: already ? t('غيّر ميعادها من معايناتي.', 'Change its time from My viewings.') : undefined,
      tone: 'danger',
    });
    if (taken && !already) {
      setTime(null);
      void slots.refetch();
    }
  };

  const confirm = () =>
    requireAuth(() => {
      if (!date || !time) return;
      const onSuccess = (v: ViewingItem) => setDone(v);
      if (existing) update.mutate({ id: existing.id, body: { action: 'reschedule', date, time, reminders } }, { onSuccess, onError: failed });
      else book.mutate({ propertyId: p.id, date, time, reminders }, { onSuccess, onError: failed });
    });

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 140 }}>
        <View style={styles.pad}>
          <View style={styles.header}>
            <IconButton label={t('رجوع', 'Back')} onPress={() => (router.canGoBack() ? router.back() : router.replace(`/property/${p.id}`))} icon={<BackIcon size={20} color={colors.ink} />} />
            <View style={styles.flex}>
              <Txt accessibilityRole="header" size={20} weight="semibold">
                {existing ? t('غيّر الموعد', 'Reschedule') : t('احجز معاينة', 'Book a viewing')}
              </Txt>
              <Txt size={12} color="ink2" numberOfLines={1}>
                {title}
              </Txt>
            </View>
          </View>

          <View style={[styles.home, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={[styles.thumb, { backgroundColor: colors.surface2 }]}>
              {mediaUrl(p.cover) ? <Image source={{ uri: mediaUrl(p.cover)! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            </View>
            <View style={styles.flex}>
              <Txt size={14} weight="semibold" numberOfLines={1}>
                {title}
              </Txt>
              <View style={styles.inline}>
                <MapPin size={14} color={colors.ink2} />
                <Txt size={12} color="ink2" numberOfLines={1} style={styles.flex}>
                  {place}
                </Txt>
              </View>
            </View>
          </View>

          <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
            <MapPin size={16} color={colors.accentInk} />
            <Txt size={12.5} color="accentInk" style={styles.flex}>
              {t('المعاينة في الموقع، مع مسؤول المبيعات.', 'The viewing is on site, with the sales advisor.')}
            </Txt>
          </View>

          <Txt size={15} weight="semibold" style={styles.h2}>
            {t('اختار اليوم', 'Pick a day')}
          </Txt>
        </View>

        {slots.isPending ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : slots.isError ? (
          <View style={styles.pad}>
            <Txt color="ink2">{t('مقدرناش نجيب المواعيد.', 'We couldn’t load the times.')}</Txt>
            <Button label={t('حاول تاني', 'Try again')} variant="secondary" onPress={() => void slots.refetch()} style={styles.retry} />
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
              {days.map((d, i) => {
                const on = d.date === date;
                const open = d.slots.some((s) => s.state === 'free');
                const top = i === 0 ? t('النهارده', 'Today') : i === 1 ? t('بكرة', 'Tmrw') : fmtDate(d.date, lang, 'weekday');
                return (
                  <Pressable
                    key={d.date}
                    accessibilityRole="button"
                    accessibilityLabel={`${fmtDate(d.date, lang, 'long')}${open ? '' : t('، مفيش مواعيد', ', no times')}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setPicked(d.date);
                      setTime(null);
                    }}
                    style={({ pressed }) => [
                      styles.day,
                      on ? { backgroundColor: colors.ink } : { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 },
                      { opacity: pressed ? 0.8 : open || on ? 1 : 0.55 },
                    ]}
                  >
                    <Txt size={11} style={{ color: on ? colors.bg : colors.ink3 }}>
                      {top}
                    </Txt>
                    <Txt size={22} weight="semibold" style={{ color: on ? colors.bg : colors.ink }}>
                      {fmtNum(Number(d.date.slice(8)), lang)}
                    </Txt>
                    <Txt size={10.5} style={{ color: on ? colors.bg : colors.ink3 }}>
                      {fmtDate(d.date, lang).split(' ')[1]}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.pad}>
              <Txt size={15} weight="semibold" style={styles.h2}>
                {t('اختار الساعة', 'Pick a time')}
              </Txt>
              {groups.map((g) => (
                <View key={g.label} style={styles.group}>
                  <View style={styles.inline}>
                    <g.icon size={14} color={colors.ink3} />
                    <Txt size={12} color="ink3">
                      {g.label}
                    </Txt>
                  </View>
                  <View style={styles.grid}>
                    {g.slots.map((s) => {
                      const on = time === s.time;
                      const free = s.state === 'free';
                      const label = fmtTime(s.time, lang);
                      return (
                        <Pressable
                          key={s.time}
                          accessibilityRole="button"
                          accessibilityLabel={free ? label : `${label}، ${stateLabel(s)}`}
                          accessibilityState={{ selected: on, disabled: !free }}
                          disabled={!free}
                          onPress={() => setTime(s.time)}
                          style={[
                            styles.slot,
                            on
                              ? { backgroundColor: colors.accent }
                              : free
                                ? { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 }
                                : { backgroundColor: colors.surface2, opacity: 0.6 },
                          ]}
                        >
                          <Txt
                            size={13}
                            weight="medium"
                            style={[{ color: on ? colors.navy : free ? colors.ink : colors.ink3 }, !free && styles.struck]}
                          >
                            {label}
                          </Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
              {day && !day.slots.some((s) => s.state === 'free') ? (
                <Txt size={13} color="ink2" style={styles.group}>
                  {t('مفيش مواعيد فاضية اليوم ده، اختار يوم تاني.', 'No free times that day. Pick another day.')}
                </Txt>
              ) : null}
            </View>
          </>
        )}

        <View style={styles.pad}>
          <Txt size={15} weight="semibold" style={styles.h2}>
            {t('هيقابلك', 'You’ll meet')}
          </Txt>
          <View style={[styles.agent, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={[styles.avatar, { backgroundColor: p.agent.colour }]}>
              <Txt size={16} weight="semibold" style={styles.white}>
                {initialsOf(lang === 'ar' ? p.agent.nameAr : p.agent.nameEn, lang)}
              </Txt>
            </View>
            <View style={styles.flex}>
              <View style={styles.inline}>
                <Txt size={14} weight="semibold">
                  {agentName}
                </Txt>
                <BadgeCheck size={16} color={colors.accent} />
              </View>
              <Txt size={12} color="ink2">
                {lang === 'ar' ? p.agent.roleTitleAr : p.agent.roleTitleEn}
              </Txt>
              <View style={styles.inline}>
                <Txt size={11.5} color="ink2">
                  {lang === 'ar' ? p.agent.languagesAr : p.agent.languagesEn}
                </Txt>
              </View>
            </View>
          </View>
          <Txt size={12.5} color="ink2" style={styles.meet}>
            {t(`${agentName} هيستناك في الميعاد.`, `${agentName} will be there to meet you.`)}
          </Txt>

          <Txt size={15} weight="semibold" style={styles.h2}>
            {t('فكّرني', 'Remind me')}
          </Txt>
          <View style={styles.chips}>
            {REMINDERS.map((r) => {
              const on = reminders.includes(r.key);
              return (
                <Pressable
                  key={r.key}
                  accessibilityRole="checkbox"
                  accessibilityLabel={t(r.ar, r.en)}
                  accessibilityState={{ checked: on }}
                  onPress={() => setReminders((cur) => (on ? cur.filter((x) => x !== r.key) : [...cur, r.key]))}
                  style={[styles.chip, on ? { backgroundColor: colors.ink } : { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 }]}
                >
                  {on ? <Check size={16} color={colors.bg} /> : <Clock size={16} color={colors.ink2} />}
                  <Txt size={13} weight="medium" style={{ color: on ? colors.bg : colors.ink2 }}>
                    {t(r.ar, r.en)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.line, paddingBottom: insets.bottom + 12 }]}>
        <Txt size={12} color="ink2" align="center">
          {date && time ? `${fmtDate(date, lang, 'long')} | ${fmtTime(time, lang)}` : t('اختار ساعة عشان تكمل', 'Pick a time to continue')}
        </Txt>
        <Button
          label={existing ? t('أكّد الموعد الجديد', 'Confirm new time') : t('أكّد المعاينة', 'Confirm viewing')}
          onPress={confirm}
          disabled={!date || !time || busy || (!!existing && date === existing.date && time === existing.time)}
          loading={busy}
        />
      </View>
    </View>
  );
}

/** "You're booked": the summary, the reminders, add to calendar, and on to My viewings. */
function Done({ v, rescheduled }: { v: ViewingItem; rescheduled: boolean }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const agentName = lang === 'ar' ? v.agent.nameAr : v.agent.nameEn;
  const cover = mediaUrl(v.property.cover);
  const reminderText = v.reminders.length
    ? `${t('هنفكرك ', 'We’ll remind you ')}${v.reminders
        .map((r) => ({ '1d': t('قبلها بيوم', 'a day before'), '2h': t('قبلها بساعتين', '2 hours before'), '30m': t('قبلها بنص ساعة', '30 min before') })[r])
        .join(t('، و', ', and '))}`
    : t('مفيش تذكير', 'No reminders');
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[styles.done, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
      <View style={[styles.okOuter, { backgroundColor: colors.successSoft }]}>
        <View style={[styles.okInner, { backgroundColor: colors.success }]}>
          <Check size={36} color="#fff" strokeWidth={3} />
        </View>
      </View>
      <Txt accessibilityRole="header" size={24} weight="semibold" align="center">
        {rescheduled ? t('اتغير الموعد', 'Rescheduled') : t('معاينتك اتأكدت', 'You’re booked')}
      </Txt>
      <Txt size={14} color="ink2" align="center">
        {t(`${agentName} هيستناك في الميعاد.`, `${agentName} will be there to meet you.`)}
      </Txt>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.cardTop}>
          <View style={[styles.thumb, { backgroundColor: colors.surface2 }]}>
            {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <View style={styles.flex}>
            <Txt size={14} weight="semibold" numberOfLines={1}>
              {lang === 'ar' ? v.property.titleAr : v.property.titleEn}
            </Txt>
            <Txt size={12} color="ink2" numberOfLines={1}>
              {`${lang === 'ar' ? v.property.compoundAr : v.property.compoundEn} | ${lang === 'ar' ? v.property.area.nameAr : v.property.area.nameEn}`}
            </Txt>
          </View>
        </View>
        <View style={[styles.cardRow, { borderColor: colors.line }]}>
          <View style={styles.flex}>
            <Txt size={11} color="ink3">
              {t('اليوم', 'Date')}
            </Txt>
            <Txt size={14} weight="semibold">
              {fmtDate(v.date, lang, 'long')}
            </Txt>
          </View>
          <View style={styles.flex}>
            <Txt size={11} color="ink3">
              {t('الساعة', 'Time')}
            </Txt>
            <Txt size={14} weight="semibold">
              {fmtTime(v.time, lang)}
            </Txt>
          </View>
        </View>
        <View style={[styles.cardRow, { borderColor: colors.line }]}>
          <Txt size={13} weight="semibold" style={styles.flex}>
            {agentName}
          </Txt>
          <Txt size={11.5} color="ink2">
            {t('في الموقع', 'On site')}
          </Txt>
        </View>
      </View>

      <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
        <BellRing size={16} color={colors.accentInk} />
        <Txt size={12.5} color="accentInk" style={styles.flex}>
          {reminderText}
        </Txt>
      </View>

      <View style={styles.doneActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            addToCalendar(v.id).catch(() => toast.show({ title: t('مقدرناش نجهز ملف التقويم', 'We couldn’t prepare the calendar file'), tone: 'danger' }))
          }
          style={[styles.outline, { borderColor: colors.line2 }]}
        >
          <CalendarPlus size={20} color={colors.ink} />
          <Txt weight="medium">{t('أضف للتقويم', 'Add to calendar')}</Txt>
        </Pressable>
        <Button label={t('معايناتي', 'My viewings')} onPress={() => router.replace('/viewings')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  pad: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  white: { color: '#fff' },
  home: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 10 },
  thumb: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden' },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.md, padding: 14, marginTop: 12 },
  h2: { marginTop: 24, marginBottom: 12 },
  loading: { marginTop: 24 },
  retry: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 24 },
  days: { gap: 8, paddingHorizontal: 16 },
  day: { width: 62, height: 84, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2 },
  group: { marginTop: 12, gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '23%', flexGrow: 1, maxWidth: '24%', height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  struck: { textDecorationLine: 'line-through' },
  agent: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  meet: { marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, borderRadius: radius.full, paddingHorizontal: 14 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  done: { paddingHorizontal: 20, gap: 12 },
  okOuter: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  okInner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginTop: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: 1 },
  doneActions: { gap: 8, marginTop: 24 },
  outline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.md, borderWidth: 1 },
});
