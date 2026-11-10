import { fmtMoney, type PropertyCard } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
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
 */
export function BookBar({ card }: { card: PropertyCard }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const suffix = card.category === 'rent' ? t('/ شهر', '/ mo') : '';
  const requireAuth = useRequireAuth();
  const start = useStartChat();
  const chat = () =>
    requireAuth(() =>
      start.mutate(card.id, {
        onSuccess: (thread) => router.push(`/chat/${thread.id}`),
        onError: () => toast.show({ title: t('مقدرناش نفتح الشات، حاول تاني', 'We couldn’t open the chat, try again'), tone: 'danger' }),
      }),
    );
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.line, paddingBottom: insets.bottom + 12 }]}>
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
        accessibilityLabel={t('كلّم مسؤول المبيعات', 'Chat with the advisor')}
        disabled={start.isPending}
        onPress={chat}
        style={[styles.chat, { backgroundColor: colors.accentSoft }]}
      >
        {start.isPending ? <ActivityIndicator color={colors.accentInk} /> : <MessageCircle size={20} color={colors.accentInk} />}
      </Pressable>
      <Button label={t('احجز معاينة', 'Book a viewing')} onPress={() => router.push(`/property/${card.id}/book`)} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
  price: { flexShrink: 1 },
  button: { flex: 1 },
  chat: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
