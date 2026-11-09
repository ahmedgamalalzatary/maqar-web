import {
  CATEGORY_LABEL,
  type Feature,
  FEATURE_LABEL,
  FINISHING_LABEL,
  fmtMoney,
  fmtNum,
  localDigits,
  PROPERTY_TYPE_LABEL,
  type PropertyDetail,
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
  Share2,
  ShieldCheck,
  Sun,
  Trees,
  TrendingDown,
  Waves,
} from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { ApiError } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { dropPct, PropertyCardView } from '@/features/listings/components/property-card';
import { SaveButton } from '@/features/saved/components/save-button';
import { AdvisorCard } from '../components/advisor-card';
import { Gallery } from '../components/gallery';
import { LocationMap } from '../components/location-map';
import { directionsUrl } from '../directions';
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

/**
 * The property page (contract §8.5), phase 4. Price alerts, compare, the 360° tour,
 * the installment calculator, chat and booking arrive with their own phases.
 */
export function PropertyScreen({ id }: { id: number }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const property = useProperty(id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (property.isPending) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg, paddingTop: insets.top + 64, paddingHorizontal: 16 }]}>
        <CardSkeleton />
      </View>
    );
  }
  if (property.isError) {
    const gone = property.error instanceof ApiError && (property.error.status === 404 || property.error.status === 400);
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: colors.bg, padding: 24 }]}>
        {gone ? (
          <>
            <Txt color="ink2" align="center">
              {t('الوحدة دي مش متاحة دلوقتي.', 'This home is no longer available.')}
            </Txt>
            <Button label={t('رجوع', 'Back')} variant="secondary" onPress={back} style={styles.backBtn} />
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
  const lang = useLang();
  const dir = useDir();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const similar = useSimilar(p.id, true);
  // Read the clock once when the page opens (render must stay pure).
  const [now] = useState(Date.now);

  const title = lang === 'ar' ? p.titleAr : p.titleEn;
  const place = lang === 'ar' ? `${p.compoundAr} | ${p.area.nameAr}` : `${p.compoundEn} | ${p.area.nameEn}`;
  const developer = lang === 'ar' ? p.developerAr : p.developerEn;
  const buying = p.category === 'sale' || p.category === 'project';
  const suffix = p.category === 'rent' ? t('/ شهر', '/ mo') : p.category === 'stay' ? t('/ ليلة', '/ night') : '';
  const drop = dropPct(p);
  const perM2 = Math.round(p.price / p.sizeM2);
  const days = Math.max(0, Math.floor((now - Date.parse(p.publishedAt)) / DAY));
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const share = () =>
    Share.share({
      title,
      message: `${title}\n${fmtMoney(p.price, lang, false)} ${suffix}\n${place}\n${t('على مقر', 'On Maqar')}`.replace(/ \n/g, '\n'),
    });

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <Gallery images={p.images} label={title} />

        <View style={[styles.body, { backgroundColor: colors.bg }]}>
          <View style={styles.badges}>
            <Pill bg={colors.ink} fg={colors.bg} text={t(CATEGORY_LABEL[p.category])} />
            <Pill bg={colors.surface2} fg={colors.ink} text={t(PROPERTY_TYPE_LABEL[p.type])} />
            <Pill
              bg={colors.sageSoft}
              fg={colors.sageInk}
              text={
                p.delivery === 'ready'
                  ? t('استلام فوري', 'Ready to move')
                  : t(`استلام ${localDigits(String(p.delivery), 'ar')}`, `Delivery ${p.delivery}`)
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

          <View style={[styles.priceBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>
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
                  {t(`نزل ${fmtNum(drop, 'ar')}٪`, `${drop}% lower`)}
                </Txt>
              </View>
            ) : null}
            {buying ? (
              <Txt size={12} color="ink3">
                {t(`${fmtMoney(perM2, 'ar', false)} للمتر`, `${fmtMoney(perM2, 'en', false)} per m²`)}
              </Txt>
            ) : null}
          </View>

          <View style={styles.specs}>
            <Spec icon={BedDouble} value={fmtNum(p.beds, lang)} label={t('غرف', 'Beds')} />
            <Spec icon={Bath} value={fmtNum(p.baths, lang)} label={t('حمام', 'Baths')} />
            <Spec icon={Maximize2} value={fmtNum(p.sizeM2, lang)} label={t('م²', 'm²')} />
            <Spec icon={Layers} value={p.floor !== null ? fmtNum(p.floor, lang) : '—'} label={t('الدور', 'Floor')} />
          </View>

          <View style={styles.meta}>
            <View style={styles.inline}>
              <Eye size={14} color={colors.ink2} />
              <Txt size={12} color="ink2">
                {t(`${fmtNum(p.views, 'ar')} مشاهدة`, `${fmtNum(p.views, 'en')} views`)}
              </Txt>
            </View>
            <Txt size={12} color="ink2">
              {days === 0
                ? t('اتعرضت النهارده', 'Listed today')
                : t(`اتعرضت من ${fmtNum(days, 'ar')} يوم`, `Listed ${days} ${days === 1 ? 'day' : 'days'} ago`)}
            </Txt>
            <Txt size={12} color="ink2" style={styles.end}>
              {t(FINISHING_LABEL[p.finishing])}
            </Txt>
          </View>

          <AdvisorCard agent={p.agent} />

          <Section title={t('عن الوحدة', 'About this home')}>
            <Txt size={14} color="ink2" style={styles.desc}>
              {lang === 'ar' ? p.descAr : p.descEn}
            </Txt>
            {p.maintenanceFee ? (
              <Txt size={12} color="ink3">
                {t(
                  `مصاريف الصيانة: ${fmtNum(p.maintenanceFee, 'ar')}٪ من سعر الوحدة`,
                  `Maintenance: ${p.maintenanceFee}% of the unit price`,
                )}
              </Txt>
            ) : null}
          </Section>

          {p.features.length ? (
            <Section title={t('المميزات', 'Amenities')}>
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
            <Section title={t('الموقع', 'Location')}>
              <LocationMap lat={p.location.lat} lng={p.location.lng} title={title} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('الاتجاهات', 'Directions')}
                onPress={() => p.location && Linking.openURL(directionsUrl(p.location))}
                style={({ pressed }) => [
                  styles.directions,
                  { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Navigation size={16} color={colors.accentInk} />
                <Txt size={14} weight="semibold" color="accentInk">
                  {t('الاتجاهات', 'Directions')}
                </Txt>
              </Pressable>
            </Section>
          ) : null}

          {similar.data?.length ? (
            <Section title={t('وحدات مشابهة', 'Similar homes')}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similar}>
                {similar.data.map((c) => (
                  <PropertyCardView key={c.id} card={c} width={Math.round(width * 0.7)} />
                ))}
              </ScrollView>
            </Section>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Glass label={t('رجوع', 'Back')} onPress={onBack}>
          <BackIcon size={20} color="#fff" />
        </Glass>
        <View style={styles.topActions}>
          <Glass label={t('مشاركة', 'Share')} onPress={share}>
            <Share2 size={18} color="#fff" />
          </Glass>
          <SaveButton card={p} size={44} />
        </View>
      </View>
    </View>
  );
}

/** A round see-through button over the photos. */
function Glass({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.glass, { opacity: pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
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
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  backBtn: { paddingHorizontal: 32 },
  body: { marginTop: -24, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 16, paddingTop: 20, gap: 16 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, height: 26, justifyContent: 'center' },
  gap4: { gap: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  flex: { flex: 1 },
  priceBox: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
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
  topBar: { position: 'absolute', start: 16, end: 16, flexDirection: 'row', justifyContent: 'space-between' },
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
