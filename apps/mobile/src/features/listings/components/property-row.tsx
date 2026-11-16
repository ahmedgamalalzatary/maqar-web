import { pickField, fmtMoney, type PropertyCard } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type ComponentRef, type ReactNode, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { PressableScale } from '@/components/pressable-scale';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { m, useLang, useT } from '@/core/i18n';
import { propertyKey, rememberOrigin } from '@/core/motion/card-origin';
import { radius, useTheme } from '@/core/theme';

/**
 * A home on one line (the demo's PropertyRow): photo, title, place and price, with room for a line
 * under the price (`sub`) and something at the end (`right`). The row opens the property page;
 * `right` sits beside it, so a switch there is not a button inside a button.
 */
export function PropertyRow({ card, sub, right }: { card: PropertyCard; sub?: ReactNode; right?: ReactNode }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const title = pickField(card, 'title', lang);
  const place = `${pickField(card, 'compound', lang)} | ${pickField(card.area, 'name', lang)}`;
  const suffix = card.category === 'rent' ? t(m.common.mo) : card.category === 'stay' ? t(m.common.night) : '';
  const cover = mediaUrl(card.cover);
  const self = useRef<ComponentRef<typeof View>>(null);
  return (
    <View ref={self} collapsable={false} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={title}
        // The property page grows out of this row (2026-11-16).
        onPressIn={() => rememberOrigin(self, propertyKey(card.id), { radius: radius.lg, cover: card.cover })}
        onPress={() => router.push(`/property/${card.id}`)}
        style={styles.main}
      >
        <View style={[styles.photo, { backgroundColor: colors.surface2 }]}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <View style={styles.text}>
          <Txt size={14} weight="medium" numberOfLines={1}>
            {title}
          </Txt>
          <Txt size={12} color="ink2" numberOfLines={1}>
            {place}
          </Txt>
          <Txt size={14} weight="semibold">
            {fmtMoney(card.price, lang)}
            {suffix ? (
              <Txt size={11} color="ink3">
                {' '}
                {suffix}
              </Txt>
            ) : null}
          </Txt>
          {sub}
        </View>
      </PressableScale>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.lg, borderWidth: 1, padding: 10, paddingEnd: 14 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
});
