import { SearchX, WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** Grey blocks in the shape of a card, while listings load. */
export function CardSkeleton({ width }: { width?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.photo, { backgroundColor: colors.surface2 }]} />
      <View style={[styles.line, { width: '35%', backgroundColor: colors.surface2 }]} />
      <View style={[styles.line, { width: '70%', backgroundColor: colors.surface2 }]} />
    </View>
  );
}

/** No listings. With `onClear`, the filters are the reason, so it offers to clear them. */
export function EmptyListings({ onClear }: { onClear?: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <SearchX size={32} color={colors.ink3} strokeWidth={1.6} />
      <Txt weight="medium" align="center">
        {onClear ? t('مفيش نتايج بالفلاتر دي', 'No homes match these filters') : t('مفيش وحدات هنا لسه', 'No homes here yet')}
      </Txt>
      <Txt size={13} color="ink2" align="center">
        {onClear
          ? t('وسّع الميزانية أو شيل فلتر.', 'Widen the budget or remove a filter.')
          : t('جرّب فئة أو منطقة تانية.', 'Try another category or area.')}
      </Txt>
      {onClear ? <Button label={t('مسح الفلاتر', 'Clear filters')} variant="secondary" onPress={onClear} style={styles.retry} /> : null}
    </View>
  );
}

export function ListingsError({ onRetry }: { onRetry: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <WifiOff size={32} color={colors.ink3} strokeWidth={1.6} />
      <Txt weight="medium" align="center">
        {t('مش قادرين نوصل للسيرفر', 'We can’t reach the server')}
      </Txt>
      <Button label={t('حاول تاني', 'Try again')} variant="secondary" onPress={onRetry} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 4 / 3, borderRadius: 26 },
  line: { height: 12, borderRadius: radius.sm, marginTop: 10 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  retry: { marginTop: 8, paddingHorizontal: 24 },
});
