import { fmtNum } from '@maqar/shared';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { type SharedValue, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { m, useLang, useT } from '@/core/i18n';
import { rubberband, shouldDismiss } from '@/core/motion/drag';
import { SETTLE } from '@/core/motion/motion';

const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;

/**
 * The listing's photos full screen (2026-11-16). Swipe between them; pinch or double-tap to zoom,
 * and drag a zoomed photo around; swipe a photo down to close, with the black fading as it goes.
 * All of it runs on the UI thread.
 */
export function PhotoViewer({ images, start, onClose }: { images: string[]; start: number; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const drag = useSharedValue(0);
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(drag.get()), [0, height * 0.6], [1, 0], 'clamp') }));
  const chrome = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(drag.get()), [0, 80], [1, 0], 'clamp') }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      {/* A modal is its own window on Android: gestures need their own root inside it. */}
      <GestureHandlerRootView style={styles.fill} testID="photo-viewer">
        <Animated.View style={[StyleSheet.absoluteFill, styles.black, backdrop]} />
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(p, i) => `${p}-${i}`}
          onMomentumScrollEnd={(e) => setIndex(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / width))}
          renderItem={({ item }) => (
            <ZoomablePhoto uri={mediaUrl(item)} width={width} height={height} drag={drag} zoomed={zoomed} onZoom={setZoomed} onClose={onClose} />
          )}
        />
        <Animated.View pointerEvents="box-none" style={[styles.top, { top: insets.top + 8 }, chrome]}>
          <View style={styles.counter}>
            <Txt testID="photo-viewer-counter" size={13} weight="medium" style={styles.white}>
              {`${fmtNum(index + 1, lang)} / ${fmtNum(images.length, lang)}`}
            </Txt>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t(m.common.close)} onPress={onClose} hitSlop={8} style={styles.close}>
            <X size={22} color="#fff" />
          </Pressable>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ZoomablePhoto({
  uri,
  width,
  height,
  drag,
  zoomed,
  onZoom,
  onClose,
}: {
  uri: string | null;
  width: number;
  height: number;
  drag: SharedValue<number>;
  zoomed: boolean;
  onZoom: (on: boolean) => void;
  onClose: () => void;
}) {
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  /** How far a photo at `s` can move before its edge shows. */
  const bound = (s: number, size: number) => {
    'worklet';
    return (size * (s - 1)) / 2;
  };
  const reset = () => {
    'worklet';
    scale.set(withSpring(1, SETTLE));
    x.set(withSpring(0, SETTLE));
    y.set(withSpring(0, SETTLE));
    scheduleOnRN(onZoom, false);
  };

  const pinch = usePinchGesture({
    onActivate: () => {
      startScale.set(scale.get());
    },
    onUpdate: (e) => {
      const next = startScale.get() * e.scale;
      // Below 1 and above the most zoom, it resists instead of stopping dead.
      scale.set(next < 1 ? 1 + rubberband(next - 1, 1) : next > MAX_ZOOM ? MAX_ZOOM + rubberband(next - MAX_ZOOM, MAX_ZOOM) : next);
    },
    onDeactivate: () => {
      if (scale.get() <= 1.02) reset();
      else {
        if (scale.get() > MAX_ZOOM) scale.set(withSpring(MAX_ZOOM, SETTLE));
        scheduleOnRN(onZoom, true);
      }
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: (e) => {
      if (e.canceled) return;
      if (scale.get() > 1) reset();
      else {
        scale.set(withSpring(DOUBLE_TAP_ZOOM, SETTLE));
        scheduleOnRN(onZoom, true);
      }
    },
  });

  // Not zoomed, the pan only takes vertical drags (to close), so swiping sideways still pages.
  const pan = usePanGesture({
    activeOffsetY: zoomed ? undefined : [-12, 12],
    failOffsetX: zoomed ? undefined : [-18, 18],
    maxPointers: 1,
    onActivate: () => {
      startX.set(x.get());
      startY.set(y.get());
    },
    onUpdate: (e) => {
      if (scale.get() > 1) {
        const bx = bound(scale.get(), width);
        const by = bound(scale.get(), height);
        const nx = startX.get() + e.translationX;
        const ny = startY.get() + e.translationY;
        x.set(Math.abs(nx) > bx ? Math.sign(nx) * (bx + rubberband(Math.abs(nx) - bx, width)) : nx);
        y.set(Math.abs(ny) > by ? Math.sign(ny) * (by + rubberband(Math.abs(ny) - by, height)) : ny);
      } else {
        drag.set(e.translationY);
      }
    },
    onDeactivate: (e) => {
      if (scale.get() > 1) {
        const bx = bound(scale.get(), width);
        const by = bound(scale.get(), height);
        x.set(withSpring(Math.max(-bx, Math.min(bx, x.get())), { ...SETTLE, velocity: e.velocityX }));
        y.set(withSpring(Math.max(-by, Math.min(by, y.get())), { ...SETTLE, velocity: e.velocityY }));
        return;
      }
      const down = drag.get();
      if (shouldDismiss(Math.abs(down), Math.sign(down) * e.velocityY, height)) {
        drag.set(withTiming(Math.sign(down || 1) * height, { duration: 200 }, (done) => {
          if (done) scheduleOnRN(onClose);
        }));
      } else {
        drag.set(withSpring(0, { ...SETTLE, velocity: e.velocityY }));
      }
    },
  });

  const gestures = useSimultaneousGestures(pinch, pan, doubleTap);
  const style = useAnimatedStyle(() => {
    const d = drag.get();
    return {
      transform: [{ translateX: x.get() }, { translateY: y.get() + d }, { scale: scale.get() * (1 - Math.min(0.25, Math.abs(d) / height)) }],
    };
  });

  return (
    <GestureDetector gesture={gestures}>
      <Animated.View style={[{ width, height }, styles.center, style]}>
        {uri ? <Image source={{ uri }} style={{ width, height }} contentFit="contain" /> : null}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  black: { backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', start: 16, end: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 12, height: 30, justifyContent: 'center' },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
});
