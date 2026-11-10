import { type AdminListing, CATEGORY_LABEL, canMoveTo, closedStatusFor, FINISHING_LABEL, fmtDate, fmtMoney, fmtNum, PROPERTY_TYPE_LABEL } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Phone } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { ListingsError } from '@/features/listings/components/list-states';
import { priceSuffix, StatusBadge } from '../components/admin-parts';
import { type ListingAction, useAdminAgents, useAdminListing, useListingAction } from '../hooks/use-admin';

/** `/admin/listing/:id`: one listing with its owner and advisor, and what can be done with it. */
export function AdminListingScreen({ id }: { id: number }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listing = useAdminListing(id);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin'));

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
      </View>
      {listing.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : listing.isError ? (
        <View style={styles.pad}>
          {listing.error instanceof ApiError && listing.error.status === 404 ? (
            <Txt align="center">{t('العقار ده مش موجود.', 'This listing does not exist.')}</Txt>
          ) : (
            <ListingsError onRetry={() => void listing.refetch()} />
          )}
        </View>
      ) : (
        <Body l={listing.data} />
      )}
    </View>
  );
}

function Body({ l }: { l: AdminListing }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const action = useListingAction(l.id);
  const [picking, setPicking] = useState(false);
  const closed = closedStatusFor(l.category);

  const run = (a: ListingAction, done: string) =>
    action.mutate(a, {
      onSuccess: () => toast.show({ title: done, tone: 'sage' }),
      onError: (err) =>
        toast.show({
          title: err instanceof ApiError && err.status === 0 ? t('مفيش إنترنت، حاول تاني', 'No connection, try again') : t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again'),
          tone: 'danger',
        }),
    });
  const publish = (agentId?: number) => {
    setPicking(false);
    run({ kind: 'publish', agentId }, t('العقار اتنشر وبقى ظاهر في استكشف', 'Published: it now shows in Explore'));
  };

  const title = lang === 'ar' ? l.titleAr : l.titleEn;
  const advisor = l.agent ? (lang === 'ar' ? l.agent.nameAr : l.agent.nameEn) : null;
  const fact = (ar: string, en: string) => t(ar, en);
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.photos}>
        {l.images.map((url, i) => (
          <View key={url} style={[styles.photo, { backgroundColor: colors.surface2 }]}>
            <Image source={{ uri: mediaUrl(url)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {i === 0 ? (
              <View style={[styles.cover, { backgroundColor: colors.accent }]}>
                <Txt size={11} weight="semibold" style={{ color: colors.navy }}>
                  {t('الغلاف', 'Cover')}
                </Txt>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={styles.head}>
        <StatusBadge status={l.status} />
        <Txt accessibilityRole="header" size={22} weight="semibold">
          {title}
        </Txt>
        <Txt size={13} color="ink2">
          {`${t(CATEGORY_LABEL[l.category])} | ${t(PROPERTY_TYPE_LABEL[l.type])} | ${lang === 'ar' ? l.area.nameAr : l.area.nameEn}`}
        </Txt>
        <Txt size={20} weight="semibold">
          {fmtMoney(l.price, lang, false)}
          <Txt size={12} color="ink3">
            {priceSuffix(l.category, t) ? ` ${priceSuffix(l.category, t)}` : ''}
          </Txt>
        </Txt>
        <Txt size={13} color="ink2">
          {[
            l.beds ? fact(`${fmtNum(l.beds, 'ar')} غرف`, `${l.beds} beds`) : null,
            fact(`${fmtNum(l.baths, 'ar')} حمام`, `${l.baths} baths`),
            fact(`${fmtNum(l.sizeM2, 'ar')} م²`, `${l.sizeM2} m²`),
            t(FINISHING_LABEL[l.finishing]),
          ]
            .filter(Boolean)
            .join(' | ')}
        </Txt>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Txt size={12} color="ink3">
          {t('المالك (لفريق مقر بس)', 'Owner (Maqar team only)')}
        </Txt>
        <View style={styles.ownerRow}>
          <View style={styles.flex}>
            <Txt weight="medium">{l.ownerName ?? t('مش متسجل', 'Not recorded')}</Txt>
            {l.ownerPhone ? (
              <Txt size={13} color="ink2">
                {l.ownerPhone}
              </Txt>
            ) : null}
          </View>
          {l.ownerPhone ? (
            <IconButton label={t('اتصل بالمالك', 'Call the owner')} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${l.ownerPhone}`)} />
          ) : null}
        </View>
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Txt size={12} color="ink3">
          {t('مسؤول المبيعات', 'Sales advisor')}
        </Txt>
        <Txt weight="medium">{advisor ?? t('هيتحدد لما تنشر العقار', 'Picked when you publish')}</Txt>
        <Txt size={12} color="ink3">
          {l.publishedAt
            ? t(`اتنشر ${fmtDate(l.publishedAt, 'ar')} | ${fmtNum(l.views, 'ar')} مشاهدة`, `Published ${fmtDate(l.publishedAt, 'en')} | ${l.views} views`)
            : t(`اتضاف ${fmtDate(l.createdAt, 'ar')}`, `Added ${fmtDate(l.createdAt, 'en')}`)}
        </Txt>
      </View>

      <View style={styles.actions}>
        {canMoveTo(l.status, 'approved') ? (
          <Button label={l.status === 'draft' ? t('انشر العقار', 'Publish') : t('انشره تاني', 'Publish again')} loading={action.isPending} onPress={() => setPicking(true)} />
        ) : null}
        <Button label={t('عدّل البيانات', 'Edit details')} variant="secondary" onPress={() => router.push(`/admin/listing/${l.id}/edit`)} />
        {l.status === 'approved' ? (
          <Button label={t('شوفه زي العميل', 'See it as a client')} variant="ghost" onPress={() => router.push(`/property/${l.id}`)} />
        ) : null}
        {canMoveTo(l.status, 'unpublished') ? (
          <Button
            label={t('أوقف النشر', 'Unpublish')}
            variant="secondary"
            disabled={action.isPending}
            onPress={() => run({ kind: 'unpublish' }, t('العقار اتشال من استكشف', 'Unpublished: it left Explore'))}
          />
        ) : null}
        {canMoveTo(l.status, closed) ? (
          <Button
            label={closed === 'sold' ? t('اتباع', 'Mark as sold') : t('اتأجر', 'Mark as rented')}
            variant="danger"
            disabled={action.isPending}
            onPress={() => run({ kind: 'close' }, closed === 'sold' ? t('العقار اتعلّم إنه اتباع', 'Marked as sold') : t('العقار اتعلّم إنه اتأجر', 'Marked as rented'))}
          />
        ) : null}
      </View>

      <AdvisorSheet open={picking} current={l.agent?.id} onClose={() => setPicking(false)} onPick={publish} />
    </ScrollView>
  );
}

/** Who the published listing goes to: the least busy advisor, or one the admin picks. */
function AdvisorSheet({ open, current, onClose, onPick }: { open: boolean; current?: number; onClose: () => void; onPick: (agentId?: number) => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const agents = useAdminAgents(open);
  const option = (key: string, label: string, sub: string, onPress: () => void, on = false) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.option, { backgroundColor: colors.surface, borderColor: on ? colors.accent : colors.line, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.flex}>
        <Txt weight="medium">{label}</Txt>
        <Txt size={12} color="ink2">
          {sub}
        </Txt>
      </View>
      {on ? <Check size={18} color={colors.accentInk} /> : null}
    </Pressable>
  );
  return (
    <Sheet open={open} onClose={onClose} title={t('مين مسؤول المبيعات؟', 'Who is the sales advisor?')} scroll>
      {option('auto', t('اختار تلقائي', 'Pick for me'), t('اللي عنده أقل عدد عقارات منشورة', 'The one with the fewest live listings'), () => onPick(undefined))}
      {agents.isPending ? <ActivityIndicator color={colors.accent} /> : null}
      {(agents.data ?? []).map((a) =>
        option(
          String(a.id),
          lang === 'ar' ? a.nameAr : a.nameEn,
          t(`${fmtNum(a.live, 'ar')} عقار منشور`, `${a.live} live listings`),
          () => onPick(a.id),
          a.id === current,
        ),
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row' },
  loading: { marginTop: 48 },
  pad: { padding: 24 },
  content: { paddingHorizontal: 16, gap: 16 },
  bleed: { marginHorizontal: -16 },
  photos: { gap: 8, paddingHorizontal: 16 },
  photo: { width: 260, height: 180, borderRadius: radius.lg, overflow: 'hidden' },
  cover: { position: 'absolute', top: 8, start: 8, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  head: { gap: 4, alignItems: 'flex-start' },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 4 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { height: 1, marginVertical: 8 },
  flex: { flex: 1 },
  actions: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, padding: 12 },
});
