import type { Sort } from '@maqar/shared';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

type T = ReturnType<typeof useT>;

export const sortLabel = (s: Sort, t: T) =>
  ({
    match: t('الأنسب ليك', 'Best match'),
    newest: t('الأحدث', 'Newest'),
    low: t('الأقل سعراً', 'Lowest price'),
    high: t('الأعلى سعراً', 'Highest price'),
  })[s];

/** Best match first, as in the demo. */
const ORDER: Sort[] = ['match', 'newest', 'low', 'high'];

/** Sort by (contract §8.4). Best match needs a signed-in client's preferences (§8.3). */
export function SortSheet({
  open,
  value,
  withMatch,
  onPick,
  onClose,
}: {
  open: boolean;
  value: Sort;
  /** Offer best match: only for a signed-in client. */
  withMatch: boolean;
  onPick: (s: Sort) => void;
  onClose: () => void;
}) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <Sheet open={open} onClose={onClose} title={t('ترتيب حسب', 'Sort by')}>
      <View accessibilityRole="radiogroup">
        {ORDER.filter((s) => withMatch || s !== 'match').map((s) => (
          <Pressable
            key={s}
            accessibilityRole="radio"
            accessibilityLabel={sortLabel(s, t)}
            accessibilityState={{ checked: value === s }}
            onPress={() => onPick(s)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
          >
            <Txt size={15} style={styles.flex}>
              {sortLabel(s, t)}
            </Txt>
            {value === s ? <Check size={20} color={colors.accent} /> : null}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 12, borderRadius: radius.md },
  flex: { flex: 1 },
});
