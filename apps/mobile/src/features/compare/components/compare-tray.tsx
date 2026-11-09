import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus, Scale, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useCompare } from '../store/compare.store';

/** The bar above the tab bar while homes are picked (contract §8.10). `bottom` is the tab bar's height. */
export function CompareTray({ bottom }: { bottom: number }) {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const homes = useCompare((s) => s.homes);
  const clear = useCompare((s) => s.clear);
  if (!homes.length) return null;
  const two = homes.length === 2;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottom + 8 }]}>
      <View style={[styles.tray, { backgroundColor: colors.ink }]}>
        <View style={styles.thumbs}>
          {homes.map((h) => {
            const uri = mediaUrl(h.cover);
            return (
              <View key={h.id} style={[styles.thumb, { borderColor: colors.ink, backgroundColor: colors.surface2 }]}>
                {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
            );
          })}
          {two ? null : (
            <View style={[styles.thumb, styles.empty, { borderColor: colors.bg }]}>
              <Plus size={16} color={colors.bg} />
            </View>
          )}
        </View>
        <View style={styles.text}>
          <Txt size={12.5} weight="semibold" style={{ color: colors.bg }}>
            {two ? t('وحدتين جاهزين', '2 homes picked') : t('اختار وحدة كمان', 'Pick one more')}
          </Txt>
          <Txt size={11.5} style={{ color: colors.bg, opacity: 0.6 }}>
            {t('للمقارنة جنب بعض', 'to compare side by side')}
          </Txt>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('قارن', 'Compare')}
          onPress={() => router.push('/compare')}
          style={({ pressed }) => [styles.go, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
        >
          <Scale size={16} color={colors.navy} />
          <Txt size={13} weight="semibold" style={{ color: colors.navy }}>
            {t('قارن', 'Compare')}
          </Txt>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('مسح', 'Clear')} onPress={clear} hitSlop={6} style={styles.clear}>
          <X size={16} color={colors.bg} opacity={0.6} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16, end: 16 },
  tray: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, padding: 8 },
  thumbs: { flexDirection: 'row', paddingStart: 4 },
  thumb: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', borderWidth: 2, marginEnd: -10 },
  empty: { borderStyle: 'dashed', opacity: 0.4, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, paddingStart: 14 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, borderRadius: 12, paddingHorizontal: 14 },
  clear: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
