import { fmtNum } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { TAB_BAR_HEIGHT } from '@/core/navigation/role-tabs';
import { useTheme } from '@/core/theme';
import { useCompare } from '@/features/compare/store/compare.store';
import { useChatUnread, useChatUser } from '../hooks/use-chat';

/** The floating chat button above the client's tab bar (contract §8.12), with the unread count. Signed-in clients only. */
export function ChatFab() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useChatUser();
  const unread = useChatUnread();
  // Above the compare tray while homes are picked.
  const lift = useCompare((s) => s.homes.length > 0) ? 72 : 0;
  if (me?.side !== 'client') return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: TAB_BAR_HEIGHT + insets.bottom + 16 + lift }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread ? t(`المحادثات، ${fmtNum(unread, 'ar')} جديدة`, `Messages, ${unread} new`) : t('المحادثات', 'Messages')}
        onPress={() => router.push('/chat')}
        style={({ pressed }) => [styles.fab, { backgroundColor: colors.accent, borderColor: colors.bg, transform: [{ scale: pressed ? 0.92 : 1 }] }]}
      >
        <MessageCircle size={24} color={colors.navy} strokeWidth={2.2} />
        {unread ? (
          <View style={[styles.badge, { backgroundColor: colors.navy, borderColor: colors.bg }]}>
            <Txt size={11} weight="semibold" style={{ color: colors.cream }}>
              {unread > 9 ? '9+' : fmtNum(unread, lang)}
            </Txt>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', start: 16 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#041525',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  badge: { position: 'absolute', top: -6, end: -6, minWidth: 24, height: 24, borderRadius: 12, borderWidth: 2, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
});
