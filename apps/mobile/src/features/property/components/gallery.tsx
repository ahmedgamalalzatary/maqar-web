import { fmtDuration, fmtNum, type ListingVideo } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { m, useLang, useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { PhotoViewer } from './photo-viewer';
import { VideoPlayerModal } from './video-player';

/**
 * Full-width photos, one per swipe, with a "2 / 5" counter. Cover first. Videos (phase 26) follow
 * the photos as their poster frames; tapping one plays it full screen, and a chip plays the first.
 * 2026-11-16: a photo opens full screen (pinch, swipe down to close); with the page's `scrollY` the
 * photos drift slower than the page, shrink a little as it scrolls, and stretch when it is pulled
 * down. Dots under the photos follow the swipe: the current one stretches into a pill.
 */
export function Gallery({
  images,
  videos = [],
  label,
  scrollY,
}: {
  images: string[];
  videos?: ListingVideo[];
  label: string;
  scrollY?: SharedValue<number>;
}) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState<ListingVideo | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const height = Math.round(width * 0.9);
  const count = images.length + videos.length;
  // Whether scroll positions count down from the far end. Only known once scrolling starts.
  const fromFarEnd = useRef<boolean | null>(null);
  const reduceMotion = useReduceMotion();
  const parallax = useAnimatedStyle(() => {
    const y = reduceMotion || !scrollY ? 0 : scrollY.get();
    // Pulled down (iOS): pinned to the top and stretched. Scrolled up: drifts at half the speed.
    return y < 0
      ? { transform: [{ translateY: y / 2 }, { scale: 1 - y / height }] }
      : { transform: [{ translateY: y * 0.5 }, { scale: 1 - 0.08 * Math.min(1, y / height) }] };
  });
  // The page being looked at, with the fraction of the swipe (1.5 = halfway from the 2nd to the 3rd).
  const page = useSharedValue(0);

  /**
   * Which page is showing. In a right-to-left layout the position depends on the platform: the web
   * counts down from 0 into negatives, phones count from the physical left, so the first page is
   * at the highest position. The first event comes from beside the first page, which tells them apart.
   */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const position = Math.abs(e.nativeEvent.contentOffset.x);
    const last = count - 1;
    fromFarEnd.current ??= position > (last * width) / 2;
    const exact = Math.min(last, Math.max(0, fromFarEnd.current ? last - position / width : position / width));
    page.set(exact);
    setIndex(Math.round(exact));
  };

  return (
    <Animated.View style={[{ height, backgroundColor: colors.surface2 }, parallax]}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} testID="gallery" scrollEventThrottle={16} onScroll={onScroll}>
        {images.map((path, i) => {
          const uri = mediaUrl(path);
          const photo = uri ? (
            <Image
              accessible
              accessibilityRole="image"
              accessibilityLabel={i === 0 ? label : undefined}
              source={{ uri }}
              style={{ width, height }}
              contentFit="cover"
              transition={reduceMotion ? 0 : 200}
            />
          ) : null;
          return uri ? (
            <Pressable
              key={`${path}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={t(m.property.openPhoto(i + 1, images.length))}
              onPress={() => setViewing(i)}
            >
              {photo}
            </Pressable>
          ) : null;
        })}
        {videos.map((v, i) => (
          <Pressable
            key={v.url}
            testID="gallery-video"
            accessibilityRole="button"
            accessibilityLabel={t(m.common.playVideo(i + 1, v.durationS))}
            onPress={() => setPlaying(v)}
            style={{ width, height, backgroundColor: '#000' }}
          >
            <Image source={{ uri: mediaUrl(v.poster)! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={reduceMotion ? 0 : 200} />
            <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
              <View style={styles.play}>
                <Play size={28} color="#fff" fill="#fff" />
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.5)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {videos.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(m.property.videosPlayFirst(videos.length))}
          onPress={() => setPlaying(videos[0]!)}
          style={styles.videosChip}
        >
          <Play size={12} color="#fff" fill="#fff" />
          <Txt size={11} weight="medium" style={styles.white}>
            {t(m.common.videos(videos.length))}
          </Txt>
        </Pressable>
      ) : null}
      {index >= images.length && videos[index - images.length] ? (
        <View style={styles.duration} pointerEvents="none">
          <Txt size={11} weight="medium" style={styles.white}>
            {fmtDuration(videos[index - images.length]!.durationS, lang)}
          </Txt>
        </View>
      ) : null}
      {count > 1 && count <= MAX_DOTS ? (
        <View testID="gallery-dots" style={styles.dots} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: count }, (_, i) => (
            <Dot key={i} i={i} page={page} />
          ))}
        </View>
      ) : null}
      {count > 1 ? (
        <View style={styles.counter} pointerEvents="none">
          <Txt size={11} weight="medium" style={styles.white}>
            {`${fmtNum(index + 1, lang)} / ${fmtNum(count, lang)}`}
          </Txt>
        </View>
      ) : null}
      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
      {viewing !== null ? <PhotoViewer images={images} start={viewing} onClose={() => setViewing(null)} /> : null}
    </Animated.View>
  );
}

/** More photos than this and the dots would crowd; the counter alone says where you are. */
const MAX_DOTS = 9;

/** How wide dot `i` is with the swipe at `page`: a pill on the current page, easing to a dot beside it. */
export function dotWidth(i: number, page: number) {
  'worklet';
  return 6 + 12 * Math.max(0, 1 - Math.abs(page - i));
}

function Dot({ i, page }: { i: number; page: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const near = Math.max(0, 1 - Math.abs(page.get() - i));
    return { width: dotWidth(i, page.get()), opacity: 0.5 + 0.5 * near };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  // Above the tour button and the counter, which sit at the bottom corners.
  dots: { position: 'absolute', bottom: 88, start: 0, end: 0, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { height: 6, borderRadius: 3, backgroundColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center' },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
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
  duration: {
    position: 'absolute',
    bottom: 36,
    start: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 26,
    justifyContent: 'center',
  },
  videosChip: {
    position: 'absolute',
    bottom: 68,
    end: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 28,
  },
  white: { color: '#fff' },
});
