import { type AdminListingItem, fmtMoney, fmtNum, PROPERTY_STATUS_LABEL, type PropertyStatus } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useLang, useT } from '@/core/i18n';
import { type Colors, radius, useTheme } from '@/core/theme';

/** Badge colours per status: live is green, unpublished gold, closed and drafts quiet. */
export function statusTone(status: PropertyStatus, colors: Colors): { bg: string; fg: string } {
  switch (status) {
    case 'approved':
      return { bg: colors.successSoft, fg: colors.success };
    case 'unpublished':
      return { bg: colors.accentSoft, fg: colors.accentInk };
    case 'sold':
    case 'rented':
      return { bg: colors.sageSoft, fg: colors.sageInk };
    default:
      return { bg: colors.surface2, fg: colors.ink2 };
  }
}

export function StatusBadge({ status }: { status: PropertyStatus }) {
  const t = useT();
  const { colors } = useTheme();
  const tone = statusTone(status, colors);
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Txt size={11} weight="semibold" style={{ color: tone.fg }}>
        {t(PROPERTY_STATUS_LABEL[status])}
      </Txt>
    </View>
  );
}

/** Per month for rent, per night for stays. */
export function priceSuffix(category: AdminListingItem['category'], t: ReturnType<typeof useT>): string {
  return category === 'rent' ? t('/ شهر', '/ mo') : category === 'stay' ? t('/ ليلة', '/ night') : '';
}

/** A listing in the admin list: photo, title, status, price, owner and advisor. Opens its page. */
export function AdminListingRow({ item }: { item: AdminListingItem }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const title = lang === 'ar' ? item.titleAr : item.titleEn;
  const cover = mediaUrl(item.cover);
  const advisor = item.agent ? (lang === 'ar' ? item.agent.nameAr : item.agent.nameEn) : t('من غير مسؤول لسه', 'No advisor yet');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}، ${t(PROPERTY_STATUS_LABEL[item.status])}`}
      onPress={() => router.push(`/admin/listing/${item.id}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.photo, { backgroundColor: colors.surface2 }]}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <View style={styles.text}>
        <View style={styles.top}>
          <Txt size={14} weight="medium" numberOfLines={1} style={styles.flex}>
            {title}
          </Txt>
          <StatusBadge status={item.status} />
        </View>
        <Txt size={12} color="ink2" numberOfLines={1}>
          {lang === 'ar' ? item.area.nameAr : item.area.nameEn}
          {item.ownerName ? ` | ${item.ownerName}` : ''}
        </Txt>
        <Txt size={14} weight="semibold">
          {fmtMoney(item.price, lang)}
          <Txt size={11} color="ink3">
            {priceSuffix(item.category, t) ? ` ${priceSuffix(item.category, t)}` : ''}
          </Txt>
        </Txt>
        <Txt size={11} color="ink3" numberOfLines={1}>
          {`${advisor} | ${t(`${fmtNum(item.views, 'ar')} مشاهدة`, `${item.views} views`)}`}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  row: { flexDirection: 'row', gap: 12, padding: 10, borderRadius: radius.lg, borderWidth: 1 },
  photo: { width: 92, height: 92, borderRadius: radius.md, overflow: 'hidden' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
