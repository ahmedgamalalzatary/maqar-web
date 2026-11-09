import { CATEGORY_LABEL, fmtMoney, fmtNum, fmtPct, installment, localDigits, type PropertyCard } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Bath, BedDouble, MapPin, Maximize2, TrendingDown } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** Percent the price fell from the old price, rounded; 0 when it did not fall. */
export const dropPct = (c: Pick<PropertyCard, 'price' | 'oldPrice'>) =>
  c.oldPrice && c.oldPrice > c.price ? Math.round(((c.oldPrice - c.price) / c.oldPrice) * 100) : 0;

/** A listing card (contract §8.2), the same layout as the demo. Opens the property page. */
export function PropertyCardView({ card, width }: { card: PropertyCard; width?: number }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const title = lang === 'ar' ? card.titleAr : card.titleEn;
  const drop = dropPct(card);
  const buying = card.category === 'sale' || card.category === 'project';
  const suffix = card.category === 'rent' ? t('/ شهر', '/ mo') : card.category === 'stay' ? t('/ ليلة', '/ night') : '';
  const monthly = card.plan ? Math.round(installment(card.price, card.plan.downPct, card.plan.years).payment) : null;
  const cover = mediaUrl(card.cover);
  const icon = { size: 14, color: colors.ink3, strokeWidth: 1.8 };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => router.push(`/property/${card.id}`)}
      style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <View style={[styles.photo, { backgroundColor: colors.surface2 }]}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.55)']}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.top}>
          {drop > 0 ? (
            <Badge bg={colors.danger}>
              <TrendingDown size={12} color="#fff" />
              <Txt size={11} weight="semibold" style={styles.white}>
                {fmtPct(-drop, lang)}
              </Txt>
            </Badge>
          ) : null}
        </View>
        <View style={styles.bottom}>
          <Badge>
            <Txt size={11} weight="medium" style={styles.white}>
              {t(CATEGORY_LABEL[card.category])}
            </Txt>
          </Badge>
          {card.delivery !== 'ready' ? (
            <Badge>
              <Txt size={11} weight="medium" style={styles.white}>
                {t(`استلام ${localDigits(String(card.delivery), 'ar')}`, `Delivery ${card.delivery}`)}
              </Txt>
            </Badge>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <View style={styles.price}>
            <Txt size={17} weight="semibold">
              {fmtMoney(card.price, lang, buying)}
            </Txt>
            {suffix ? (
              <Txt size={12} color="ink3">
                {suffix}
              </Txt>
            ) : null}
          </View>
          {card.oldPrice && drop > 0 ? (
            <Txt size={12} color="ink3" style={styles.struck}>
              {fmtMoney(card.oldPrice, lang)}
            </Txt>
          ) : null}
        </View>
        <Txt size={14} weight="medium" numberOfLines={1}>
          {title}
        </Txt>
        <View style={styles.place}>
          <MapPin {...icon} color={colors.ink2} />
          <Txt size={12} color="ink2" numberOfLines={1} style={styles.flex}>
            {lang === 'ar' ? `${card.compoundAr} | ${card.area.nameAr}` : `${card.compoundEn} | ${card.area.nameEn}`}
          </Txt>
        </View>
        <View style={styles.specs}>
          <Spec icon={<BedDouble {...icon} />} text={fmtNum(card.beds, lang)} />
          <Spec icon={<Bath {...icon} />} text={fmtNum(card.baths, lang)} />
          <Spec icon={<Maximize2 {...icon} />} text={`${fmtNum(card.sizeM2, lang)} ${t('م²', 'm²')}`} />
          {monthly !== null ? (
            <View style={[styles.plan, { backgroundColor: colors.sageSoft }]}>
              <Txt size={11} weight="medium" color="sageInk">
                {`${fmtMoney(monthly, lang)}/${t('شهر', 'mo')}`}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** A small label on the photo: dark glass by default. */
function Badge({ children, bg = 'rgba(0,0,0,0.35)' }: { children: ReactNode; bg?: string }) {
  return <View style={[styles.badge, { backgroundColor: bg }]}>{children}</View>;
}

function Spec({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.spec}>
      {icon}
      <Txt size={12} color="ink2">
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 4 / 3, borderRadius: 26, overflow: 'hidden' },
  top: { position: 'absolute', top: 12, start: 12, end: 12, flexDirection: 'row', gap: 6 },
  bottom: { position: 'absolute', bottom: 12, start: 12, end: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 10, height: 26 },
  white: { color: '#fff' },
  body: { paddingHorizontal: 4, paddingTop: 12, gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  price: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  struck: { textDecorationLine: 'line-through' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  specs: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  spec: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plan: { marginStart: 'auto', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  flex: { flex: 1 },
});
