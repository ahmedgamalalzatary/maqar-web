import type { ListingVideo } from '@maqar/shared';
import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mediaUrl } from '@/core/api/api';
import { useT } from '@/core/i18n';

/**
 * A listing video full screen on black (phase 26), with the platform's own controls. It plays at
 * once and stops when closed; the player exists only while this is open.
 */
export function VideoPlayerModal({ video, onClose }: { video: ListingVideo | null; onClose: () => void }) {
  return (
    <Modal visible={video !== null} animationType="fade" presentationStyle="fullScreen" supportedOrientations={['portrait', 'landscape']} onRequestClose={onClose}>
      {video ? <Player video={video} onClose={onClose} /> : null}
    </Modal>
  );
}

function Player({ video, onClose }: { video: ListingVideo; onClose: () => void }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer({ uri: mediaUrl(video.url)! }, (p) => {
    p.play();
  });
  return (
    <View style={styles.fill} testID="video-player">
      <VideoView player={player} style={styles.fill} contentFit="contain" nativeControls fullscreenOptions={{ enable: true }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('اقفل الفيديو', 'Close the video')}
        onPress={onClose}
        hitSlop={8}
        style={[styles.close, { top: insets.top + 8 }]}
      >
        <X size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  close: { position: 'absolute', end: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
});
