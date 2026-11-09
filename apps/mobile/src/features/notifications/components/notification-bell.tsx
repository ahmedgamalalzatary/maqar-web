import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { useUnreadCount } from '../hooks/use-notifications';

/** The bell on Home (contract §8.2): opens the inbox, with a dot while something is unread. */
export function NotificationBell() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const unread = useUnreadCount();
  const label = unread > 0 ? t(`التنبيهات، ${unread} جديد`, `Notifications, ${unread} new`) : t('التنبيهات', 'Notifications');
  return (
    <View>
      <IconButton label={label} onPress={() => router.push('/notifications')} icon={<Bell color={colors.ink} size={20} strokeWidth={1.8} />} />
      {unread > 0 ? (
        <View testID="bell-dot" pointerEvents="none" style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.surface }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { position: 'absolute', top: 10, end: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
