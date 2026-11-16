import { pickField, type AdminListing, CATEGORY_LABEL, canMoveTo, closedStatusFor, FINISHING_LABEL, fmtDuration, fmtMoney, type ListingVideo, PROPERTY_TYPE_LABEL, ltrPhone } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Phone, Play } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { m, useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { ListingsError } from '@/features/listings/components/list-states';
import { priceSuffix, StatusBadge } from '../components/admin-parts';
import { ListingInsights } from '../components/listing-insights';
import { VideoPlayerModal } from '@/features/property/components/video-player';
import { type ListingAction, useAdminAgents, useAdminListing, useListingAction, usePatchListing } from '../hooks/use-admin';

/** `/admin/listing/:id`: one listing with its owner and advisor, and what can be done with it. */
export function AdminListingScreen({ id }: { id: number }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listing = useAdminListing(id);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/admin/listings'));

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton label={t(m.common.back)} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
      </View>
      {listing.isPending ? (
        <ActivityIndicator style={styles.loading} color={colors.accent} />
      ) : listing.isError ? (
        <View style={styles.pad}>
          {listing.error instanceof ApiError && listing.error.status === 404 ? (
            <Txt align="center">{t(m.common.thisListingDoesNotExist)}</Txt>
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
  const patch = usePatchListing(l.id);
  const [picking, setPicking] = useState<'publish' | 'move' | null>(null);
  const [playing, setPlaying] = useState<ListingVideo | null>(null);
  const closed = closedStatusFor(l.category);

  const failed = (err: unknown) =>
    toast.show({
      title: err instanceof ApiError && err.status === 0 ? t(m.common.noConnectionTryAgain) : t(m.common.somethingWentWrongTryAgain),
      tone: 'danger',
    });
  const run = (a: ListingAction, done: string) => action.mutate(a, { onSuccess: () => toast.show({ title: done, tone: 'sage' }), onError: failed });
  const pick = (agentId?: number) => {
    const mode = picking;
    setPicking(null);
    if (mode === 'publish') run({ kind: 'publish', agentId }, t(m.admin.publishedItNowShowsIn));
    else if (agentId && agentId !== l.agent?.id)
      patch.mutate({ agentId }, { onSuccess: () => toast.show({ title: t(m.admin.advisorChanged), body: t(m.admin.earlierChatsStayWithThe), tone: 'sage' }), onError: failed });
  };
  const feature = (featured: boolean) =>
    patch.mutate(
      { featured },
      { onSuccess: () => toast.show({ title: featured ? t(m.admin.featuredOnHome) : t(m.admin.noLongerFeatured), tone: 'sage' }), onError: failed },
    );

  const title = pickField(l, 'title', lang);
  const advisor = l.agent ? (pickField(l.agent, 'name', lang)) : null;
  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.photos}>
        {l.images.map((url, i) => (
          <View key={url} style={[styles.photo, { backgroundColor: colors.surface2 }]}>
            <Image source={{ uri: mediaUrl(url)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {i === 0 ? (
              <View style={[styles.cover, { backgroundColor: colors.accent }]}>
                <Txt size={11} weight="semibold" style={{ color: colors.navy }}>
                  {t(m.common.cover)}
                </Txt>
              </View>
            ) : null}
          </View>
        ))}
        {l.videos.map((v, i) => (
          <Pressable
            key={v.url}
            accessibilityRole="button"
            accessibilityLabel={t(m.common.playVideo(i + 1, v.durationS))}
            onPress={() => setPlaying(v)}
            style={[styles.photo, styles.center, { backgroundColor: colors.navy }]}
          >
            <Image source={{ uri: mediaUrl(v.poster)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <View style={styles.play}>
              <Play size={18} color="#fff" fill="#fff" />
            </View>
            <View style={[styles.cover, styles.duration]}>
              <Txt size={11} weight="medium" style={styles.white}>
                {fmtDuration(v.durationS, lang)}
              </Txt>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />

      <View style={styles.head}>
        <StatusBadge status={l.status} />
        <Txt accessibilityRole="header" size={22} weight="semibold">
          {title}
        </Txt>
        <Txt size={13} color="ink2">
          {`${t(CATEGORY_LABEL[l.category])} | ${t(PROPERTY_TYPE_LABEL[l.type])} | ${pickField(l.area, 'name', lang)}`}
        </Txt>
        <Txt size={20} weight="semibold">
          {fmtMoney(l.price, lang, false)}
          <Txt size={12} color="ink3">
            {priceSuffix(l.category, t) ? ` ${priceSuffix(l.category, t)}` : ''}
          </Txt>
        </Txt>
        <Txt size={13} color="ink2">
          {[
            l.beds ? t(m.common.beds(l.beds)) : null,
            t(m.common.baths(l.baths)),
            t(m.common.sizeM2(l.sizeM2)),
            t(FINISHING_LABEL[l.finishing]),
          ]
            .filter(Boolean)
            .join(' | ')}
        </Txt>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Txt size={12} color="ink3">
          {t(m.admin.ownerMaqarTeamOnly)}
        </Txt>
        <View style={styles.ownerRow}>
          <View style={styles.flex}>
            <Txt weight="medium">{l.ownerName ?? t(m.admin.notRecorded)}</Txt>
            {l.ownerPhone ? (
              <Txt size={13} color="ink2">
                {ltrPhone(l.ownerPhone)}
              </Txt>
            ) : null}
          </View>
          {l.ownerPhone ? (
            <IconButton label={t(m.admin.callTheOwner)} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${l.ownerPhone}`)} />
          ) : null}
        </View>
        <View style={[styles.rule, { backgroundColor: colors.line }]} />
        <Txt size={12} color="ink3">
          {t(m.common.salesAdvisor)}
        </Txt>
        <View style={styles.ownerRow}>
          <Txt weight="medium" style={styles.flex}>
            {advisor ?? t(m.admin.pickedWhenYouPublish)}
          </Txt>
          {l.agent ? <Button label={t(m.common.change)} variant="ghost" onPress={() => setPicking('move')} /> : null}
        </View>
        <Txt size={12} color="ink3">
          {l.publishedAt
            ? t(m.admin.publishedViews(l.publishedAt, l.views))
            : t(m.admin.addedOn(l.createdAt))}
        </Txt>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={styles.ownerRow}>
          <Txt weight="medium" style={styles.flex}>
            {t(m.common.featuredOnHome)}
          </Txt>
          <Toggle label={t(m.common.featuredOnHome)} value={l.featured} disabled={patch.isPending} onChange={feature} />
        </View>
        <Txt size={12} color="ink3">
          {t(m.admin.featuredListingsShowFirstOn)}
        </Txt>
      </View>

      {l.status === 'draft' ? null : <ListingInsights l={l} />}

      <View style={styles.actions}>
        {canMoveTo(l.status, 'approved') ? (
          <Button label={l.status === 'draft' ? t(m.admin.publish) : t(m.admin.publishAgain)} loading={action.isPending} onPress={() => setPicking('publish')} />
        ) : null}
        <Button label={t(m.common.editDetails)} variant="secondary" onPress={() => router.push(`/admin/listing/${l.id}/edit`)} />
        {l.status === 'approved' ? (
          <Button label={t(m.admin.seeItAsAClient)} variant="ghost" onPress={() => router.push(`/property/${l.id}`)} />
        ) : null}
        {canMoveTo(l.status, 'unpublished') ? (
          <Button
            label={t(m.admin.unpublish)}
            variant="secondary"
            disabled={action.isPending}
            onPress={() => run({ kind: 'unpublish' }, t(m.admin.unpublishedItLeftExplore))}
          />
        ) : null}
        {canMoveTo(l.status, closed) ? (
          <Button
            label={closed === 'sold' ? t(m.admin.markAsSold) : t(m.admin.markAsRented)}
            variant="danger"
            disabled={action.isPending}
            onPress={() => run({ kind: 'close' }, closed === 'sold' ? t(m.admin.markedAsSold) : t(m.admin.markedAsRented))}
          />
        ) : null}
      </View>

      <AdvisorSheet open={picking !== null} auto={picking === 'publish'} current={l.agent?.id} onClose={() => setPicking(null)} onPick={pick} />
    </ScrollView>
  );
}

/** Who the published listing goes to: the least busy advisor, or one the admin picks. */
function AdvisorSheet({ open, auto, current, onClose, onPick }: { open: boolean; auto: boolean; current?: number; onClose: () => void; onPick: (agentId?: number) => void }) {
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
    <Sheet open={open} onClose={onClose} title={t(m.admin.whoIsTheSalesAdvisor)} scroll>
      {auto ? option('auto', t(m.admin.pickForMe), t(m.admin.theOneWithTheFewest), () => onPick(undefined)) : null}
      {agents.isPending ? <ActivityIndicator color={colors.accent} /> : null}
      {(agents.data ?? []).map((a) =>
        option(
          String(a.id),
          pickField(a, 'name', lang),
          t(m.common.liveListings(a.live)),
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
  center: { alignItems: 'center', justifyContent: 'center' },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  duration: { backgroundColor: 'rgba(0,0,0,0.55)' },
  white: { color: '#fff' },
  head: { gap: 4, alignItems: 'flex-start' },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 4 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { height: 1, marginVertical: 8 },
  flex: { flex: 1 },
  actions: { gap: 10 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, borderWidth: 1, padding: 12 },
});
