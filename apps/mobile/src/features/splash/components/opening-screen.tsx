import { SPLASH_IMAGE_SECONDS, SPLASH_VIDEO_MAX_SECONDS, type SplashSettings } from '@maqar/shared';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/logo';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useAppConfig } from '@/core/app-config/store';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** A video gets this long past its 3 seconds to load and finish before the screen goes away anyway. */
const VIDEO_GRACE_MS = 1500;

/** The line of text in the app's language, or the other language's when that one is empty. */
const textOf = (s: SplashSettings, lang: 'ar' | 'en') => (lang === 'ar' ? s.textAr || s.textEn : s.textEn || s.textAr).trim();

/** Whether there is anything to show: a picture, a video or a line of text. */
export const hasOpening = (s: SplashSettings) => (s.kind !== 'none' && !!s.media) || !!(s.textAr.trim() || s.textEn.trim());

/**
 * Shows the opening screen once per start, over the app (phase 29). It uses the settings saved
 * by the last start, then fetches the latest for the next one, so nothing changes mid-way.
 */
export function OpeningHost() {
  const [splash] = useState(() => useAppConfig.getState().config.splash);
  const [done, setDone] = useState(false);
  useEffect(() => {
    void useAppConfig.getState().refresh();
  }, []);
  if (done || !hasOpening(splash)) return null;
  return <OpeningScreen splash={splash} onDone={() => setDone(true)} />;
}

/**
 * The opening screen an admin sets: a picture (2 seconds), or a video of at most 3 seconds played
 * once without sound, with a line of text; or the text alone under the logo. It can be skipped.
 */
export function OpeningScreen({ splash, onDone }: { splash: SplashSettings; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const text = textOf(splash, lang);
  const isVideo = splash.kind === 'video' && !!splash.media;
  const isImage = splash.kind === 'image' && !!splash.media;
  // However the end comes (the timer, the video's end, a skip), it is reported once.
  const ended = useRef(false);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  const finish = useRef(() => {
    if (ended.current) return;
    ended.current = true;
    done.current();
  });

  useEffect(() => {
    const ms = isVideo ? SPLASH_VIDEO_MAX_SECONDS * 1000 + VIDEO_GRACE_MS : SPLASH_IMAGE_SECONDS * 1000;
    const id = setTimeout(() => finish.current(), ms);
    return () => clearTimeout(id);
  }, [isVideo]);

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: colors.navy }]} accessibilityViewIsModal testID="opening-screen">
      {isImage ? <Image testID="opening-image" source={{ uri: mediaUrl(splash.media)! }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" /> : null}
      {isVideo ? <OpeningVideo url={splash.media!} poster={splash.poster} onEnd={() => finish.current()} /> : null}
      {!isImage && !isVideo ? <Logo width={150} onDark /> : null}
      {text ? (
        <View style={[styles.text, { bottom: insets.bottom + 56 }]}>
          <Txt size={20} weight="semibold" align="center" style={[styles.shadow, { color: colors.cream }]}>
            {text}
          </Txt>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('تخطي', 'Skip')}
        onPress={() => finish.current()}
        hitSlop={10}
        style={[styles.skip, { top: insets.top + 12 }]}
      >
        <Txt size={13} weight="medium" style={{ color: colors.cream }}>
          {t('تخطي', 'Skip')}
        </Txt>
      </Pressable>
    </View>
  );
}

/** The video, over its first frame while it loads; kept on the phone after the first play. */
function OpeningVideo({ url, poster, onEnd }: { url: string; poster: string | null; onEnd: () => void }) {
  const end = useRef(onEnd);
  useEffect(() => {
    end.current = onEnd;
  }, [onEnd]);
  const player = useVideoPlayer({ uri: mediaUrl(url)!, useCaching: true }, (p) => {
    p.muted = true;
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    const sub = player.addListener('playToEnd', () => end.current());
    return () => sub.remove();
  }, [player]);
  return (
    <>
      {poster ? <Image source={{ uri: mediaUrl(poster)! }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" /> : null}
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 100, elevation: 100, alignItems: 'center', justifyContent: 'center' },
  text: { position: 'absolute', left: 24, right: 24 },
  shadow: { textShadowColor: 'rgba(0,0,0,0.65)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  skip: {
    position: 'absolute',
    end: 16,
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
