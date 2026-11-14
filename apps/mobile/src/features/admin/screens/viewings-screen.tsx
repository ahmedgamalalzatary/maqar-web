import { type AdminViewingItem, fmtDate, isActiveViewing, fmtTime, ltrPhone, VIEWING_WHENS, type ViewingWhen } from '@maqar/shared';
import { CalendarCheck, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { useDebounced } from '@/features/listings/hooks/use-listings';
import { useSlots } from '@/features/viewings/hooks/use-viewings';
import { useAdminViewings, useUpdateAdminViewing } from '../hooks/use-people';
import { BackBar } from './clients-screen';

const WHEN_LABEL: Record<ViewingWhen, { ar: string; en: string }> = { upcoming: { ar: 'الجاية', en: 'Upcoming' }, past: { ar: 'اللي فاتت', en: 'Past' } };
export const VIEWING_STATUS_LABEL = {
  confirmed: { ar: 'مؤكدة', en: 'Confirmed' },
  rescheduled: { ar: 'اتغير ميعادها', en: 'Rescheduled' },
  cancelled: { ar: 'اتلغت', en: 'Cancelled' },
  completed: { ar: 'خلصت', en: 'Completed' },
  pending: { ar: 'مستنية التأكيد', en: 'Awaiting confirmation' },
} as const;

/** `/admin/viewings` (phase 23): every viewing; an upcoming one can be moved or cancelled. */
export function AdminViewingsScreen() {
  const t = useT();
  const { colors } = useTheme();
  const [when, setWhen] = useState<ViewingWhen>('upcoming');
  const [q, setQ] = useState('');
  const words = useDebounced(q, 300);
  const list = useAdminViewings({ when, q: words });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const [open, setOpen] = useState<AdminViewingItem | null>(null);

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/more" />
      <FlatList
        testID="admin-viewings"
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(v) => String(v.id)}
        renderItem={({ item }) => <Row v={item} onPress={() => setOpen(item)} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={styles.header}>
            <Txt accessibilityRole="header" size={24} weight="semibold">
              {t('المعاينات', 'Viewings')}
            </Txt>
            <View style={styles.chips}>
              {VIEWING_WHENS.map((w) => (
                <Pressable
                  key={w}
                  accessibilityRole="radio"
                  accessibilityLabel={t(WHEN_LABEL[w])}
                  accessibilityState={{ checked: when === w }}
                  onPress={() => setWhen(w)}
                  style={[styles.chip, { backgroundColor: when === w ? colors.ink : colors.surface, borderColor: colors.line }]}
                >
                  <Txt size={13} weight="medium" style={{ color: when === w ? colors.bg : colors.ink }}>
                    {t(WHEN_LABEL[w])}
                  </Txt>
                </Pressable>
              ))}
            </View>
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Search size={18} color={colors.ink3} />
              <TextInput
                accessibilityLabel={t('ابحث بالعميل أو العقار', 'Search by client or home')}
                value={q}
                onChangeText={setQ}
                placeholder={t('ابحث بالعميل أو العقار', 'Search by client or home')}
                placeholderTextColor={colors.ink3}
                autoCorrect={false}
                style={[styles.input, { color: colors.ink }]}
              />
              {q ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t('امسح البحث', 'Clear search')} onPress={() => setQ('')} hitSlop={8}>
                  <X size={16} color={colors.ink3} />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          list.isPending ? (
            <CardSkeleton />
          ) : list.isError ? (
            <ListingsError onRetry={() => void list.refetch()} />
          ) : (
            <View style={styles.empty}>
              <CalendarCheck size={32} color={colors.ink3} strokeWidth={1.6} />
              <Txt weight="medium">{t('مفيش معاينات هنا', 'No viewings here')}</Txt>
            </View>
          )
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.empty} /> : undefined}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.accent} />}
      />
      {open ? <ManageSheet v={open} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

const isActive = (v: AdminViewingItem) => isActiveViewing(v) && Date.parse(v.startsAt) > Date.now();

function Row({ v, onPress }: { v: AdminViewingItem; onPress: () => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const title = lang === 'ar' ? v.property.titleAr : v.property.titleEn;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${v.client?.name ?? t('حساب اتمسح', 'Deleted account')}، ${title}`}
      onPress={onPress}
      disabled={!isActive(v)}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.when, { backgroundColor: colors.surface2 }]}>
        <Txt size={12} weight="semibold">
          {fmtDate(v.date, lang)}
        </Txt>
        <Txt size={12} color="ink2">
          {fmtTime(v.time, lang)}
        </Txt>
      </View>
      <View style={styles.flex}>
        <Txt weight="medium" numberOfLines={1}>
          {v.client?.name ?? t('حساب اتمسح', 'Deleted account')}
        </Txt>
        <Txt size={12} color="ink2" numberOfLines={1}>
          {title}
        </Txt>
        <Txt size={12} color="ink3">
          {`${lang === 'ar' ? v.agent.nameAr : v.agent.nameEn} | ${t(VIEWING_STATUS_LABEL[v.status])}`}
        </Txt>
      </View>
    </Pressable>
  );
}

/** Move to a free hour of the same advisor, or cancel; the reason is told to the client and the advisor. */
function ManageSheet({ v, onClose }: { v: AdminViewingItem; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const update = useUpdateAdminViewing(v.id);
  const [mode, setMode] = useState<'move' | 'cancel' | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const slots = useSlots(v.property.id, mode === 'move' ? v.id : undefined);
  const days = mode === 'move' ? (slots.data?.days ?? []).filter((d) => d.slots.some((s) => s.state === 'free')) : [];
  const day = days.find((d) => d.date === date);

  const failed = (e: unknown) =>
    toast.show({
      title: e instanceof ApiError && e.status === 409 ? t('الميعاد ده مبقاش متاح، اختار تاني', 'That time is no longer free; pick another') : t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'),
      tone: 'danger',
    });
  const done = (title: string) => () => {
    toast.show({ title, body: t('العميل والمسؤول وصلهم إشعار.', 'The client and the advisor were notified.'), tone: 'sage' });
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={v.client?.name ?? t('المعاينة', 'The viewing')} scroll>
      <Txt size={13} color="ink2">
        {`${lang === 'ar' ? v.property.titleAr : v.property.titleEn} | ${fmtDate(v.date, lang, 'weekday')} ${fmtTime(v.time, lang)}`}
      </Txt>
      {v.client?.phone ? (
        <Txt size={13} color="ink2">
          {ltrPhone(v.client.phone)}
        </Txt>
      ) : null}
      {mode === null ? (
        <View style={styles.sheetActions}>
          <Button label={t('غيّر الميعاد', 'Move it')} onPress={() => setMode('move')} />
          <Button label={t('الغي المعاينة', 'Cancel it')} variant="secondary" onPress={() => setMode('cancel')} />
        </View>
      ) : null}
      {mode === 'move' ? (
        <>
          <Txt size={14} weight="semibold">
            {t('اليوم', 'Day')}
          </Txt>
          {slots.isPending ? <ActivityIndicator color={colors.accent} /> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {days.map((d) => (
              <Pressable
                key={d.date}
                accessibilityRole="radio"
                accessibilityLabel={fmtDate(d.date, lang, 'weekday')}
                accessibilityState={{ checked: d.date === date }}
                onPress={() => {
                  setDate(d.date);
                  setTime(null);
                }}
                style={[styles.chip, { backgroundColor: d.date === date ? colors.ink : colors.surface, borderColor: colors.line }]}
              >
                <Txt size={13} style={{ color: d.date === date ? colors.bg : colors.ink }}>
                  {fmtDate(d.date, lang)}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
          {day ? (
            <>
              <Txt size={14} weight="semibold">
                {t('الساعة', 'Time')}
              </Txt>
              <View style={styles.wrap}>
                {day.slots
                  .filter((s) => s.state === 'free')
                  .map((s) => (
                    <Pressable
                      key={s.time}
                      accessibilityRole="radio"
                      accessibilityLabel={fmtTime(s.time, lang)}
                      accessibilityState={{ checked: s.time === time }}
                      onPress={() => setTime(s.time)}
                      style={[styles.chip, { backgroundColor: s.time === time ? colors.ink : colors.surface, borderColor: colors.line }]}
                    >
                      <Txt size={13} style={{ color: s.time === time ? colors.bg : colors.ink }}>
                        {fmtTime(s.time, lang)}
                      </Txt>
                    </Pressable>
                  ))}
              </View>
            </>
          ) : null}
          <TextField label={t('السبب (العميل والمسؤول هيشوفوه)', 'Reason (the client and the advisor see it)')} value={reason} onChangeText={setReason} maxLength={300} />
          <Button
            label={t('احفظ الميعاد الجديد', 'Save the new time')}
            disabled={!date || !time}
            loading={update.isPending}
            onPress={() => update.mutate({ action: 'reschedule', date: date!, time: time!, ...(reason.trim() ? { reason: reason.trim() } : {}) }, { onSuccess: done(t('الميعاد اتغير', 'Viewing moved')), onError: failed })}
          />
        </>
      ) : null}
      {mode === 'cancel' ? (
        <>
          <TextField label={t('السبب (العميل والمسؤول هيشوفوه)', 'Reason (the client and the advisor see it)')} value={reason} onChangeText={setReason} maxLength={300} />
          <Button
            label={t('أكّد الإلغاء', 'Confirm the cancellation')}
            loading={update.isPending}
            onPress={() => update.mutate({ action: 'cancel', ...(reason.trim() ? { reason: reason.trim() } : {}) }, { onSuccess: done(t('المعاينة اتلغت', 'Viewing cancelled')), onError: failed })}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 14, marginBottom: 16 },
  gap: { height: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 12 },
  when: { width: 72, borderRadius: radius.md, paddingVertical: 8, alignItems: 'center', gap: 2 },
  sheetActions: { gap: 10 },
});
