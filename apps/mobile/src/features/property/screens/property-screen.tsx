import {
  CATEGORY_LABEL,
  type Feature,
  FEATURE_LABEL,
  FINISHING_LABEL,
  fmtMoney,
  fmtNum,
  PROPERTY_TYPE_LABEL,
  type PropertyDetail,
  pickField,
} from '@maqar/shared';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Bath,
  BedDouble,
  Building,
  Car,
  Cpu,
  Dumbbell,
  Eye,
  Layers,
  type LucideIcon,
  MapPin,
  Maximize2,
  Navigation,
  Rotate3d,
  Share2,
  ShieldCheck,
  Sun,
  Trees,
  TrendingDown,
  Waves,
} from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedRef, useScrollOffset } from 'react-native-reanimated';
import { PressableScale } from '@/components/pressable-scale';
import { Skeleton } from '@/components/skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { FollowPriceButton } from '@/features/alerts/components/follow-price-button';
import { BOOK_BAR_HEIGHT, BookBar, useShowsBookBar } from '@/features/viewings/components/book-bar';
import { Txt } from '@/components/text';
import { ApiError, mediaUrl } from '@/core/api/api';
import { m, useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { InstallmentCalculator } from '@/features/calculator/components/installment-calculator';
import { ListingsError } from '@/features/listings/components/list-states';
import { dropPct, PropertyCardView } from '@/features/listings/components/property-card';
import { peekOrigin, propertyKey } from '@/core/motion/card-origin';
import { useSession } from '@/features/auth/store/session.store';
import { EASE_OUT } from '@/core/motion/motion';
import { CompareButton } from '@/features/compare/components/compare-button';
import { SaveButton } from '@/features/saved/components/save-button';
import { AdvisorCard } from '../components/advisor-card';
import { Gallery } from '../components/gallery';
import { LocationMap } from '../components/location-map';
import { directionsUrl } from '../directions';
import { shareListing } from '../share';
import { useProperty, useSimilar } from '../hooks/use-property';

const FEATURE_ICON: Record<Feature, LucideIcon> = {
  pool: Waves,
  garden: Trees,
  sea: Waves,
  parking: Car,
  elevator: ArrowUpDown,
  security: ShieldCheck,
  gym: Dumbbell,
  clubhouse: Building,
  smart: Cpu,
  roof: Sun,
};

const DAY = 24 * 60 * 60 * 1000;

// Module scope: layout-animation builders made in render cost every re-render.
const STRIP_IN = FadeIn.duration(160).easing(EASE_OUT);
const STRIP_OUT = FadeOut.duration(130).easing(EASE_OUT);
const TITLE_IN = FadeInDown.duration(220).easing(EASE_OUT);
/** The bottom bar hides again this close to the end of the page. */
const BAR_END_GAP = 40;

/**
 * The property page (contract §8.5), phase 4, with price alerts (phase 12) and booking (phase 13).
 * Chat arrives with its own phase.
 */
export function PropertyScreen({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const property = useProperty(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (property.isPending) return <PageSkeleton cover={peekOrigin(propertyKey(id))?.cover ?? null} />;
  if (property.isError) {
    const gone = property.error instanceof ApiError && (property.error.status === 404 || property.error.status === 400);
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.bg, padding: 24 }]}>
        {gone ? (
          <>
            <Txt color="ink2" align="center">
              {t(m.property.thisHomeIsNoLonger)}
            </Txt>
            <Button label={t(m.common.back)} variant="secondary" onPress={back} style={styles.backBtn} />
          </>
        ) : (
          <ListingsError onRetry={() => property.refetch()} />
        )}
      </View>
    );
  }
  return <Details p={property.data} onBack={back} />;
}

function Details({ p, onBack }: { p: PropertyDetail; onBack: () => void }) {
  const t = useT();
  const router = useRouter();
  const lang = useLang();
  const dir = useDir();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const similar = useSimilar(p.id, true);
  // Read the clock once when the page opens (render must stay pure).
  const [now] = useState(Date.now);
  // Once the photos scroll away, the top buttons get a solid strip behind them instead of sitting on text.
  const [solidTop, setSolidTop] = useState(false);
  const topBarHeight = insets.top + 8 + 44 + 8;
  const galleryHeight = Math.round(width * 0.9);

  const title = pickField(p, 'title', lang);
  const place = lang === 'ar' ? `${p.compoundAr} | ${p.area.nameAr}` : `${p.compoundEn} | ${p.area.nameEn}`;
  const developer = pickField(p, 'developer', lang);
  const buying = p.category === 'sale' || p.category === 'project';
  const suffix = p.category === 'rent' ? t(m.common.mo) : p.category === 'stay' ? t(m.common.night) : '';
  const drop = dropPct(p);
  const perM2 = Math.round(p.price / p.sizeM2);
  const days = Math.max(0, Math.floor((now - Date.parse(p.publishedAt)) / DAY));
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const bookBar = useShowsBookBar(p);
  // The page's scroll, read on the UI thread: the photos drift and stretch with it (2026-11-16).
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useScrollOffset(scrollRef);

  // 2026-11-16: the bottom bar rises once the price box has scrolled away, and steps aside again
  // at the very end of the page. Where the price box ends, in the page's own scroll positions.
  const [barShown, setBarShown] = useState(false);
  const bodyY = useRef(0);
  const priceEnd = useRef(Number.POSITIVE_INFINITY);
  const staff = useSession((s) => !!s.user && s.user.role !== 'client');
  // The top buttons at the end (share, and compare and save for guests and clients), to keep the title clear of.
  const endButtons = staff ? 1 : 3;

  const share = () => void shareListing(p, lang, t).catch(() => undefined);

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Animated.ScrollView
        ref={scrollRef}
        testID="property-scroll"
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const y = contentOffset.y;
          const solid = y > galleryHeight - topBarHeight;
          if (solid !== solidTop) setSolidTop(solid);
          const atEnd = contentSize.height > 0 && y > contentSize.height - layoutMeasurement.height - BAR_END_GAP;
          const shown = y > priceEnd.current - topBarHeight && !atEnd;
          if (shown !== barShown) setBarShown(shown);
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 + (bookBar ? BOOK_BAR_HEIGHT : 0) }}
      >
        <View>
          <Gallery images={p.images} videos={p.videos} label={title} scrollY={scrollY} />
          {p.tourRooms.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(m.common.n360Tour)}
              onPress={() => router.push(`/property/${p.id}/tour`)}
              style={({ pressed }) => [styles.tour, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
            >
              <View style={[styles.tourIcon, { backgroundColor: colors.navy }]}>
                <Rotate3d size={18} color={colors.gold} />
              </View>
              <Txt size={13} weight="semibold" style={{ color: colors.navy }}>
                {t(m.common.n360Tour)}
              </Txt>
            </Pressable>
          ) : null}
        </View>

        <View style={[styles.body, { backgroundColor: colors.bg }]} onLayout={(e) => (bodyY.current = e.nativeEvent.layout.y)}>
          <View style={styles.badges}>
            <Pill bg={colors.ink} fg={colors.bg} text={t(CATEGORY_LABEL[p.category])} />
            <Pill bg={colors.surface2} fg={colors.ink} text={t(PROPERTY_TYPE_LABEL[p.type])} />
            <Pill
              bg={colors.sageSoft}
              fg={colors.sageInk}
              text={
                p.delivery === 'ready'
                  ? t(m.common.readyToMove)
                  : t(m.common.deliveryYear(p.delivery))
              }
            />
          </View>

          <View style={styles.gap4}>
            <Txt accessibilityRole="header" size={22} weight="semibold">
              {title}
            </Txt>
            <View style={styles.inline}>
              <MapPin size={15} color={colors.ink2} />
              <Txt size={13} color="ink2" style={styles.flex}>
                {place}
              </Txt>
            </View>
            {developer ? (
              <Txt size={12} color="ink3">
                {developer}
              </Txt>
            ) : null}
          </View>

          <View
            style={[styles.priceBox, { backgroundColor: colors.surface, borderColor: colors.line }]}
            onLayout={(e) => (priceEnd.current = bodyY.current + e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
          >
            <View style={styles.priceTop}>
              <View style={styles.priceText}>
                <View style={styles.inline}>
                  <Txt size={24} weight="semibold">
                    {fmtMoney(p.price, lang, false)}
                  </Txt>
                  {suffix ? (
                    <Txt size={13} color="ink3">
                      {suffix}
                    </Txt>
                  ) : null}
                </View>
                {p.oldPrice && drop > 0 ? (
                  <View style={styles.inline}>
                    <Txt size={12} color="ink3" style={styles.struck}>
                      {fmtMoney(p.oldPrice, lang, false)}
                    </Txt>
                    <TrendingDown size={14} color={colors.danger} />
                    <Txt size={12} weight="semibold" color="danger">
                      {t(m.property.pctLower(drop))}
                    </Txt>
                  </View>
                ) : null}
                {buying ? (
                  <Txt size={12} color="ink3">
                    {t(m.property.perM2(perM2))}
                  </Txt>
                ) : null}
              </View>
              <FollowPriceButton card={p} />
            </View>
          </View>

          <View style={styles.specs}>
            <Spec icon={BedDouble} value={fmtNum(p.beds, lang)} label={t(m.property.beds)} />
            <Spec icon={Bath} value={fmtNum(p.baths, lang)} label={t(m.property.baths)} />
            <Spec icon={Maximize2} value={fmtNum(p.sizeM2, lang)} label={t(m.common.m)} />
            <Spec icon={Layers} value={p.floor !== null ? fmtNum(p.floor, lang) : '—'} label={t(m.common.floor)} />
          </View>

          <View style={styles.meta}>
            <View style={styles.inline}>
              <Eye size={14} color={colors.ink2} />
              <Txt size={12} color="ink2">
                {t(m.common.views(p.views))}
              </Txt>
            </View>
            <Txt size={12} color="ink2">
              {days === 0
                ? t(m.property.listedToday)
                : t(m.property.listedAgo(days))}
            </Txt>
            <Txt size={12} color="ink2" style={styles.end}>
              {t(FINISHING_LABEL[p.finishing])}
            </Txt>
          </View>

          <AdvisorCard agent={p.agent} />

          {buying ? (
            <Section title={t(m.property.yourInstallment)}>
              <Txt size={12.5} color="ink2">
                {p.plan
                  ? t(m.property.planNote(p.plan.downPct, p.plan.years))
                  : t(m.property.tryADownPaymentAnd)}
              </Txt>
              <InstallmentCalculator price={p.price} defaultDown={p.plan?.downPct ?? 20} defaultYears={p.plan?.years ?? 5} ownPlan={!!p.plan} />
            </Section>
          ) : null}

          <Section title={t(m.property.aboutThisHome)}>
            <Txt size={14} color="ink2" style={styles.desc}>
              {pickField(p, 'desc', lang)}
            </Txt>
            {p.maintenanceFee ? (
              <Txt size={12} color="ink3">
                {t(m.property.maintenance(p.maintenanceFee))}
              </Txt>
            ) : null}
          </Section>

          {p.features.length ? (
            <Section title={t(m.common.amenities)}>
              <View style={styles.amenities}>
                {p.features.map((f) => {
                  const Icon = FEATURE_ICON[f];
                  return (
                    <View key={f} style={[styles.amenity, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                      <View style={[styles.amenityIcon, { backgroundColor: colors.sageSoft }]}>
                        <Icon size={16} color={colors.sageInk} />
                      </View>
                      <Txt size={13} weight="medium" style={styles.flex}>
                        {t(FEATURE_LABEL[f])}
                      </Txt>
                    </View>
                  );
                })}
              </View>
            </Section>
          ) : null}

          {p.location ? (
            <Section title={t(m.common.location)}>
              <LocationMap lat={p.location.lat} lng={p.location.lng} title={title} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(m.common.directions)}
                onPress={() => p.location && Linking.openURL(directionsUrl(p.location))}
                style={({ pressed }) => [
                  styles.directions,
                  { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Navigation size={16} color={colors.accentInk} />
                <Txt size={14} weight="semibold" color="accentInk">
                  {t(m.common.directions)}
                </Txt>
              </Pressable>
            </Section>
          ) : null}

          {similar.data?.length ? (
            <Section title={t(m.property.similarHomes)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similar}>
                {similar.data.map((c) => (
                  <PropertyCardView key={c.id} card={c} width={Math.round(width * 0.7)} />
                ))}
              </ScrollView>
            </Section>
          ) : null}
        </View>
      </Animated.ScrollView>

      {solidTop ? (
        <Animated.View
          entering={STRIP_IN}
          exiting={STRIP_OUT}
          testID="property-top-fill"
          pointerEvents="none"
          style={[styles.topFill, { height: topBarHeight, backgroundColor: colors.bg, borderBottomColor: colors.line2 }]}
        >
          {/* 2026-11-16: the title and price move up into the bar. Screen readers keep the page's own heading. */}
          <Animated.View
            entering={TITLE_IN}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.topTitle, { top: insets.top + 8, start: 16 + 44 + 12, end: 16 + endButtons * 44 + (endButtons - 1) * 8 + 12 }]}
          >
            <Txt size={14} weight="semibold" numberOfLines={1}>
              {title}
            </Txt>
            <Txt size={12} weight="medium" color="accentInk" numberOfLines={1}>
              {`${fmtMoney(p.price, lang, false)}${suffix ? ` ${suffix}` : ''}`}
            </Txt>
          </Animated.View>
        </Animated.View>
      ) : null}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Glass label={t(m.common.back)} onPress={onBack}>
          <BackIcon size={20} color="#fff" />
        </Glass>
        <View style={styles.topActions}>
          <Glass label={t(m.property.share)} onPress={share}>
            <Share2 size={18} color="#fff" />
          </Glass>
          <CompareButton card={p} size={44} />
          <SaveButton card={p} size={44} />
        </View>
      </View>
      {bookBar ? <BookBar card={p} shown={barShown} /> : null}
    </View>
  );
}

/**
 * The page's shape while it loads (2026-11-16): the photo, the title, the price box and the specs.
 * Opened from a card, the card's photo is already there, so the page grows with a real picture.
 */
function PageSkeleton({ cover }: { cover: string | null }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <View
      testID="property-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fill, { backgroundColor: colors.bg }]}
    >
      {cover ? (
        <Image testID="skeleton-cover" source={{ uri: mediaUrl(cover) ?? undefined }} style={{ height: Math.round(width * 0.9) }} contentFit="cover" />
      ) : (
        <Skeleton style={{ height: Math.round(width * 0.9) }} />
      )}
      <View style={styles.skeletonBody}>
        <View style={styles.badges}>
          <Skeleton style={styles.skeletonPill} />
          <Skeleton style={styles.skeletonPill} />
        </View>
        <Skeleton style={[styles.skeletonLine, { width: '75%', height: 22 }]} />
        <Skeleton style={[styles.skeletonLine, { width: '50%' }]} />
        <Skeleton style={styles.skeletonBox} />
        <View style={styles.specs}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} style={[styles.flex, styles.skeletonSpec]} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** A round see-through button over the photos. */
function Glass({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} scaleTo={0.88} style={styles.glass}>
      {children}
    </PressableScale>
  );
}

function Pill({ bg, fg, text }: { bg: string; fg: string; text: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Txt size={11} weight="medium" style={{ color: fg }}>
        {text}
      </Txt>
    </View>
  );
}

function Spec({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.spec, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Icon size={20} color={colors.accent} />
      <Txt size={15} weight="semibold" align="center">
        {value}
      </Txt>
      <Txt size={11} color="ink3" align="center">
        {label}
      </Txt>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Txt accessibilityRole="header" size={17} weight="semibold">
        {title}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  skeletonBody: { padding: 16, gap: 12 },
  skeletonPill: { width: 72, height: 26, borderRadius: radius.full },
  skeletonLine: { height: 14, borderRadius: radius.sm },
  skeletonBox: { height: 96, borderRadius: radius.lg, marginTop: 8 },
  skeletonSpec: { height: 64, borderRadius: radius.md },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  backBtn: { paddingHorizontal: 32 },
  body: { marginTop: -24, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 16, paddingTop: 20, gap: 16 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, height: 26, justifyContent: 'center' },
  gap4: { gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  flex: { flex: 1 },
  priceBox: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  priceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  priceText: { flex: 1, gap: 6 },
  struck: { textDecorationLine: 'line-through' },
  specs: { flexDirection: 'row', gap: 8 },
  spec: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
  end: { marginStart: 'auto' },
  section: { gap: 10, marginTop: 8 },
  desc: { lineHeight: 26 },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenity: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  amenityIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  directions: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  similar: { gap: 12 },
  tour: {
    position: 'absolute',
    bottom: 36,
    start: 16,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingStart: 6,
    paddingEnd: 16,
  },
  tourIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  topBar: { position: 'absolute', start: 16, end: 16, flexDirection: 'row', justifyContent: 'space-between' },
  topFill: { position: 'absolute', top: 0, start: 0, end: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  topTitle: { position: 'absolute', height: 44, justifyContent: 'center' },
  topActions: { flexDirection: 'row', gap: 8 },
  glass: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
