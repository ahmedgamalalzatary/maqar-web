import { fmtMoney, type PropertyCard } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { CSS_EASE_OUT } from '@/core/motion/motion';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { m, useLang, useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { toast } from '@/components/toast';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { useSession } from '@/features/auth/store/session.store';
import { useStartChat } from '@/features/chat/hooks/use-chat';

/** The bar's height above the bottom safe area, so the page can leave room for it. */
export const BOOK_BAR_HEIGHT = 76;

/** Whether the property page shows the bar: not for stays (no viewings) or staff (they do not book). */
export function useShowsBookBar(card: PropertyCard): boolean {
  const staff = useSession((s) => !!s.user && s.user.role !== 'client');
  return !staff && card.category !== 'stay';
}

/**
 * The property page's bottom bar (contract §8.5, §8.7, §8.12): the price, chat with the advisor, and
 * "Book a viewing". Anyone can open the booking screen and see the times; confirming, or chatting,
 * asks a guest to sign in.
 * 2026-11-16: with `shown` false it waits below the screen, and slides up when the page says so
 * (once the price box has scrolled away).
 */
export function BookBar({ card, shown = true }: { card: PropertyCard; shown?: boolean }) {
  const reduced = useReduceMotion();
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const suffix = card.category === 'rent' ? t(m.common.mo) : '';
  const requireAuth = useRequireAuth();
  const start = useStartChat();
  const chat = () =>
    requireAuth(() =>
      start.mutate(card.id, {
        onSuccess: (thread) => router.push(`/chat/${thread.id}`),
        onError: () => toast.show({ title: t(m.viewings.weCouldntOpenTheChat), tone: 'danger' }),
      }),
    );
  return (
    <Animated.View
      testID="book-bar"
      pointerEvents={shown ? 'auto' : 'none'}
      accessibilityElementsHidden={!shown}
      importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.bar,
        styles.motion,
        { backgroundColor: colors.surface, borderColor: colors.line, paddingBottom: insets.bottom + 12 },
        reduced ? { opacity: shown ? 1 : 0 } : { transform: [{ translateY: shown ? 0 : BOOK_BAR_HEIGHT + insets.bottom + 8 }] },
      ]}
    >
      <View style={styles.price}>
        <Txt size={16} weight="semibold" numberOfLines={1}>
          {fmtMoney(card.price, lang)}
          {suffix ? (
            <Txt size={11} color="ink3">
              {' '}
              {suffix}
            </Txt>
          ) : null}
        </Txt>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(m.viewings.chatWithTheAdvisor)}
        disabled={start.isPending}
        onPress={chat}
        style={[styles.chat, { backgroundColor: colors.accentSoft }]}
      >
        {start.isPending ? <ActivityIndicator color={colors.accentInk} /> : <MessageCircle size={20} color={colors.accentInk} />}
      </Pressable>
      <Button label={t(m.common.bookAViewing)} onPress={() => router.push(`/property/${card.id}/book`)} style={styles.button} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  motion: { transitionProperty: ['transform', 'opacity'], transitionDuration: 260, transitionTimingFunction: CSS_EASE_OUT },
  price: { flexShrink: 1 },
  button: { flex: 1 },
  chat: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
