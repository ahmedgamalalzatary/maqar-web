import { fmtDuration, fmtNum, type ListingVideo } from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useLang, useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { VideoPlayerModal } from './video-player';

/**
 * Full-width photos, one per swipe, with a "2 / 5" counter. Cover first. Videos (phase 26) follow
 * the photos as their poster frames; tapping one plays it full screen, and a chip plays the first.
 */
export function Gallery({ images, videos = [], label }: { images: string[]; videos?: ListingVideo[]; label: string }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState<ListingVideo | null>(null);
  const height = Math.round(width * 0.9);
  const count = images.length + videos.length;
  // Whether scroll positions count down from the far end. Only known once scrolling starts.
  const fromFarEnd = useRef<boolean | null>(null);
  const reduceMotion = useReduceMotion();

  /**
   * Which page is showing. In a right-to-left layout the position depends on the platform: the web
   * counts down from 0 into negatives, phones count from the physical left, so the first page is
   * at the highest position. The first event comes from beside the first page, which tells them apart.
   */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const position = Math.abs(e.nativeEvent.contentOffset.x);
    const last = count - 1;
    fromFarEnd.current ??= position > (last * width) / 2;
    const page = Math.round(position / width);
    setIndex(Math.min(last, Math.max(0, fromFarEnd.current ? last - page : page)));
  };

  return (
    <View style={{ height, backgroundColor: colors.surface2 }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} testID="gallery" scrollEventThrottle={16} onScroll={onScroll}>
        {images.map((path, i) => {
          const uri = mediaUrl(path);
          return uri ? (
            <Image
              key={`${path}-${i}`}
              accessible
              accessibilityRole="image"
              accessibilityLabel={i === 0 ? label : undefined}
              source={{ uri }}
              style={{ width, height }}
              contentFit="cover"
              transition={reduceMotion ? 0 : 200}
            />
          ) : null;
        })}
        {videos.map((v, i) => (
          <Pressable
            key={v.url}
            testID="gallery-video"
            accessibilityRole="button"
            accessibilityLabel={t(`شغّل الفيديو ${fmtNum(i + 1, 'ar')} (${fmtDuration(v.durationS, 'ar')})`, `Play video ${i + 1} (${fmtDuration(v.durationS)})`)}
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
          accessibilityLabel={t(`${fmtNum(videos.length, 'ar')} فيديو، شغّل الأول`, `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}, play the first`)}
          onPress={() => setPlaying(videos[0]!)}
          style={styles.videosChip}
        >
          <Play size={12} color="#fff" fill="#fff" />
          <Txt size={11} weight="medium" style={styles.white}>
            {t(`${fmtNum(videos.length, 'ar')} فيديو`, `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}`)}
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
      {count > 1 ? (
        <View style={styles.counter} pointerEvents="none">
          <Txt size={11} weight="medium" style={styles.white}>
            {`${fmtNum(index + 1, lang)} / ${fmtNum(count, lang)}`}
          </Txt>
        </View>
      ) : null}
      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
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
