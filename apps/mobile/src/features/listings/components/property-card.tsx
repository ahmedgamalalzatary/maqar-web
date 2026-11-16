import { pickField, CATEGORY_LABEL, fmtMoney, fmtNum, fmtPct, installment, type PropertyCard } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Bath, BedDouble, MapPin, Maximize2, Sparkles, TrendingDown } from 'lucide-react-native';
import { type ComponentRef, type ReactNode, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { m, useLang, useT } from '@/core/i18n';
import { propertyKey, rememberOrigin } from '@/core/motion/card-origin';
import { radius, useTheme } from '@/core/theme';
import { CompareButton } from '@/features/compare/components/compare-button';
import { SaveButton } from '@/features/saved/components/save-button';
import { openPeek } from './peek';

/** The card's corner; the property page grows from it and shrinks back into it. */
export const CARD_RADIUS = 26;

/** Percent the price fell from the old price, rounded; 0 when it did not fall. */
export const dropPct = (c: Pick<PropertyCard, 'price' | 'oldPrice'>) =>
  c.oldPrice && c.oldPrice > c.price ? Math.round(((c.oldPrice - c.price) / c.oldPrice) * 100) : 0;

/** A listing card (contract §8.2), the same layout as the demo. Opens the property page. */
export function PropertyCardView({ card, width }: { card: PropertyCard; width?: number }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const title = pickField(card, 'title', lang);
  const drop = dropPct(card);
  const buying = card.category === 'sale' || card.category === 'project';
  const suffix = card.category === 'rent' ? t(m.common.mo) : card.category === 'stay' ? t(m.common.night) : '';
  const monthly = card.plan ? Math.round(installment(card.price, card.plan.downPct, card.plan.years).payment) : null;
  const cover = mediaUrl(card.cover);
  const icon = { size: 14, color: colors.ink3, strokeWidth: 1.8 };
  const self = useRef<ComponentRef<typeof View>>(null);

  return (
    // The heart and the scale sit beside the card, not inside it: a screen reader cannot reach a button within a button.
    <View ref={self} collapsable={false} style={{ width }}>
      {/* 2026-11-16: the card notes where it sits as the finger lands, and the property page grows
          out of it (CardGrow). Held down, it lifts into a preview with quick actions (peek). */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={t(m.listings.holdForQuickActions)}
        onPressIn={() => rememberOrigin(self, propertyKey(card.id), { radius: CARD_RADIUS, cover: card.cover })}
        onPress={() => router.push(`/property/${card.id}`)}
        onLongPress={() => self.current?.measureInWindow((x, y, w, h) => openPeek(card, { x, y, width: w, height: h }))}
        delayLongPress={350}
        scaleTo={0.98}
      >
        <View testID="card-photo" style={[styles.photo, { backgroundColor: colors.surface2 }]}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          <LinearGradient
            colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.top}>
            {card.match ? (
              <Badge>
                <Sparkles size={12} color={colors.gold} />
                <Txt size={11} weight="semibold" style={styles.white}>
                  {t(m.listings.matchPct(card.match.score))}
                </Txt>
              </Badge>
            ) : null}
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
                  {t(m.common.deliveryYear(card.delivery))}
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
            <Spec icon={<Maximize2 {...icon} />} text={`${fmtNum(card.sizeM2, lang)} ${t(m.common.m)}`} />
            {monthly !== null ? (
              <View style={[styles.plan, { backgroundColor: colors.sageSoft }]}>
                <Txt size={11} weight="medium" color="sageInk">
                  {`${fmtMoney(monthly, lang)}/${t(m.listings.mo)}`}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>
      <View style={styles.actions}>
        <CompareButton card={card} />
        <SaveButton card={card} />
      </View>
    </View>
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
  photo: { aspectRatio: 4 / 3, borderRadius: CARD_RADIUS, overflow: 'hidden' },
  top: { position: 'absolute', top: 12, start: 12, end: 104, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { position: 'absolute', top: 8, end: 8, flexDirection: 'row', gap: 6 },
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
