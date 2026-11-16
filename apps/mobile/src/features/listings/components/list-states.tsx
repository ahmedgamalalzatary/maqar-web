import { SearchX, WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Skeleton } from '@/components/skeleton';
import { Txt } from '@/components/text';
import { m, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** Shimmering blocks in the shape of a card, while listings load. */
export function CardSkeleton({ width }: { width?: number }) {
  return (
    <View style={{ width }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Skeleton style={styles.photo} />
      <Skeleton style={[styles.line, { width: '35%' }]} />
      <Skeleton style={[styles.line, { width: '70%' }]} />
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
        {onClear ? t(m.listings.noHomesMatchTheseFilters) : t(m.listings.noHomesHereYet)}
      </Txt>
      <Txt size={13} color="ink2" align="center">
        {onClear
          ? t(m.listings.widenTheBudgetOrRemove)
          : t(m.listings.tryAnotherCategoryOrArea)}
      </Txt>
      {onClear ? <Button label={t(m.common.clearFilters)} variant="secondary" onPress={onClear} style={styles.retry} /> : null}
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
        {t(m.listings.weCantReachTheServer)}
      </Txt>
      <Button label={t(m.common.tryAgain)} variant="secondary" onPress={onRetry} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 4 / 3, borderRadius: 26 },
  line: { height: 12, borderRadius: radius.sm, marginTop: 10 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  retry: { marginTop: 8, paddingHorizontal: 24 },
});
