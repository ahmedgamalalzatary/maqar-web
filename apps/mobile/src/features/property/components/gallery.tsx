import { fmtNum } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useLang } from '@/core/i18n';
import { useTheme } from '@/core/theme';

/** Full-width photos, one per swipe, with a "2 / 5" counter. Cover first. */
export function Gallery({ images, label }: { images: string[]; label: string }) {
  const lang = useLang();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const height = Math.round(width * 0.9);

  return (
    <View style={{ height, backgroundColor: colors.surface2 }} accessibilityLabel={label} accessibilityRole="image">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width))}
      >
        {images.map((path, i) => {
          const uri = mediaUrl(path);
          return uri ? (
            <Image key={`${path}-${i}`} source={{ uri }} style={{ width, height }} contentFit="cover" transition={200} />
          ) : null;
        })}
      </ScrollView>
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.5)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {images.length > 1 ? (
        <View style={styles.counter} pointerEvents="none">
          <Txt size={11} weight="medium" style={styles.white}>
            {`${fmtNum(index + 1, lang)} / ${fmtNum(images.length, lang)}`}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    position: 'absolute',
    bottom: 36,
    end: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 26,
    justifyContent: 'center',
  },
  white: { color: '#fff' },
});
