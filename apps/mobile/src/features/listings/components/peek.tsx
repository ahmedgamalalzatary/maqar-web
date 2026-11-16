import { fmtMoney, pickField, type PropertyCard } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Heart, type LucideIcon, Scale, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { create } from 'zustand';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { m, useLang, useT } from '@/core/i18n';
import { type Rect, propertyKey, setOrigin } from '@/core/motion/card-origin';
import { haptic } from '@/core/motion/haptics';
import { EASE_OUT } from '@/core/motion/motion';
import { radius, useTheme } from '@/core/theme';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSession } from '@/features/auth/store/session.store';
import { useCompareToggle } from '@/features/compare/components/compare-button';
import { shareListing } from '@/features/property/share';
import { useToggleSaved } from '@/features/saved/hooks/use-saved';

type Peek = { card: PropertyCard; rect: Rect };

const usePeek = create<{ open: Peek | null }>(() => ({ open: null }));

/** Lifts a card into the preview. `rect` is where the card sits on screen. */
export function openPeek(card: PropertyCard, rect: Rect) {
  haptic.tap();
  usePeek.setState({ open: { card, rect } });
}

export const closePeek = () => usePeek.setState({ open: null });

const IN_MS = 260;
const OUT_MS = 180;
const ROW = 52;
const TEXT_H = 76;
const PREVIEW_RADIUS = 22;

/**
 * Where the preview settles: centred across, with the actions under it, the pair centred down the
 * screen and never under the status bar. Pure, so it can be tested.
 */
export function peekLayout(w: number, h: number, top: number, rows: number) {
  const width = Math.min(w - 48, 380);
  const height = Math.round(width * 0.75) + TEXT_H;
  const total = height + 12 + rows * ROW;
  const y = Math.max(top + 16, (h - total) / 2);
  return { x: (w - width) / 2, y, width, height };
}

/** Render once, at the root of the app, over the screens. */
export function PeekHost() {
  const open = usePeek((s) => s.open);
  return open ? <PeekView key={open.card.id} peek={open} /> : null;
}

/**
 * The long-press preview (2026-11-16): the card lifts out of the list to the middle of the screen,
 * over a dimmed page, with Save, Compare and Share under it. A tap on the preview opens the
 * listing (it grows from the preview); a tap outside, or the phone's back, puts it down.
 */
function PeekView({ peek }: { peek: Peek }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReduceMotion();
  const client = useSession((s) => !s.user || s.user.role === 'client');
  const requireAuth = useRequireAuth();
  const { saved, toggle } = useToggleSaved(peek.card);
  const compare = useCompareToggle(peek.card);
  const [closing, setClosing] = useState(false);
  const { card, rect } = peek;
  const title = pickField(card, 'title', lang);
  const cover = mediaUrl(card.cover);
  const actions: { icon: LucideIcon; label: string; on?: boolean; run: () => void }[] = [
    ...(client
      ? [
          { icon: Heart, label: saved ? t(m.saved.removeFromSaved) : t(m.saved.saveHome), on: saved, run: () => requireAuth(toggle) },
          { icon: Scale, label: compare.on ? t(m.compare.removeFromCompare) : t(m.common.compare), on: compare.on, run: () => compare.press() },
        ]
      : []),
    { icon: Share2, label: t(m.property.share), run: () => void shareListing(card, lang, t).catch(() => undefined) },
  ];
  const box = peekLayout(W, H, insets.top, actions.length);
  // The preview starts where the card is, at the card's width, and moves and grows into place.
  const from = {
    dx: rect.x + rect.width / 2 - (box.x + box.width / 2),
    dy: rect.y + (rect.width / box.width) * (box.height / 2) - (box.y + box.height / 2),
    s: rect.width / box.width,
  };
  const p = useSharedValue(0);

  useEffect(() => {
    p.set(reduced ? 1 : withTiming(1, { duration: IN_MS, easing: EASE_OUT }));
  }, [p, reduced]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    if (reduced) return closePeek();
    p.set(withTiming(0, { duration: OUT_MS, easing: EASE_OUT }, () => scheduleOnRN(closePeek)));
  };

  // The phone's back puts the preview down instead of leaving the page under it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  });

  const openListing = () => {
    setOrigin(propertyKey(card.id), { rect: { x: box.x, y: box.y, width: box.width, height: box.height }, radius: PREVIEW_RADIUS, cover: card.cover });
    closePeek();
    router.push(`/property/${card.id}`);
  };

  const backdrop = useAnimatedStyle(() => ({ opacity: p.get() }));
  const lift = useAnimatedStyle(() => {
    const k = p.get();
    return { transform: [{ translateX: from.dx * (1 - k) }, { translateY: from.dy * (1 - k) }, { scale: from.s + (1 - from.s) * k }] };
  });
  const menu = useAnimatedStyle(() => ({
    opacity: interpolate(p.get(), [0.4, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(p.get(), [0.4, 1], [-12, 0], 'clamp') }, { scale: interpolate(p.get(), [0.4, 1], [0.96, 1], 'clamp') }],
  }));

  return (
    <View testID="peek" style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t(m.common.close)} onPress={close} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.preview, { left: box.x, top: box.y, width: box.width, backgroundColor: colors.surface }, lift]}>
        <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={openListing}>
          <View style={[styles.photo, { backgroundColor: colors.surface2 }]}>
            {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          </View>
          <View style={[styles.text, { height: TEXT_H }]}>
            <Txt size={17} weight="semibold" numberOfLines={1}>
              {fmtMoney(card.price, lang)}
            </Txt>
            <Txt size={14} color="ink2" numberOfLines={1}>
              {title}
            </Txt>
          </View>
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.menu, { left: box.x, top: box.y + box.height + 12, width: box.width, backgroundColor: colors.surface }, menu]}>
        {actions.map(({ icon: Icon, label, on, run }, i) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => {
              run();
              close();
            }}
            style={({ pressed }) => [
              styles.row,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
              pressed && { backgroundColor: colors.surface2 },
            ]}
          >
            <Txt size={15} weight="medium" style={styles.flex}>
              {label}
            </Txt>
            <Icon
              size={19}
              color={on ? (Icon === Heart ? colors.danger : colors.accentInk) : colors.ink}
              fill={on && Icon === Heart ? colors.danger : 'transparent'}
              strokeWidth={1.9}
            />
          </Pressable>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(4, 21, 37, 0.62)' },
  preview: {
    position: 'absolute',
    borderRadius: PREVIEW_RADIUS,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  photo: { aspectRatio: 4 / 3 },
  text: { paddingHorizontal: 16, paddingTop: 12, gap: 2 },
  menu: { position: 'absolute', borderRadius: radius.lg, overflow: 'hidden' },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  flex: { flex: 1 },
});
