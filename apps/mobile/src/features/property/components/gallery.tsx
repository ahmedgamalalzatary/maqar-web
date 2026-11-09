import { fmtNum } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  // Whether scroll positions count down from the far end. Only known once scrolling starts.
  const fromFarEnd = useRef<boolean | null>(null);

  /**
   * Which photo is showing. In a right-to-left layout the position depends on the platform: the web
   * counts down from 0 into negatives, phones count from the physical left, so the first photo is
   * at the highest position. The first event comes from beside the first photo, which tells them apart.
   */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const position = Math.abs(e.nativeEvent.contentOffset.x);
    const last = images.length - 1;
    fromFarEnd.current ??= position > (last * width) / 2;
    const page = Math.round(position / width);
    setIndex(Math.min(last, Math.max(0, fromFarEnd.current ? last - page : page)));
  };

  return (
    <View style={{ height, backgroundColor: colors.surface2 }} accessibilityLabel={label} accessibilityRole="image">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        testID="gallery"
        scrollEventThrottle={16}
        onScroll={onScroll}
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
