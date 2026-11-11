import { type NotificationItem, type NotificationKind, relTime } from '@maqar/shared';
import { type Href, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  BellOff,
  BellRing,
  CalendarCheck,
  type LucideIcon,
  MessageCircle,
  Sparkles,
  TrendingDown,
  Users,
} from 'lucide-react-native';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { rtlLine, useDir, useLang, useT } from '@/core/i18n';
import { type Colors, radius, useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { useMarkAllRead, useMarkRead, useNotifications } from '../hooks/use-notifications';
import { safeHref } from '../push';

/** Each kind's icon and colours, as in the demo. */
const KIND: Record<NotificationKind, { icon: LucideIcon; tone: (c: Colors) => [string, string] }> = {
  price: { icon: TrendingDown, tone: (c) => [c.dangerSoft, c.danger] },
  reminder: { icon: BellRing, tone: (c) => [c.accentSoft, c.accentInk] },
  booking: { icon: CalendarCheck, tone: (c) => [c.successSoft, c.success] },
  match: { icon: Sparkles, tone: (c) => [c.accentSoft, c.accentInk] },
  lead: { icon: Users, tone: (c) => [c.sageSoft, c.sageInk] },
  chat: { icon: MessageCircle, tone: (c) => [c.accentSoft, c.accentInk] },
  system: { icon: BellRing, tone: (c) => [c.sageSoft, c.sageInk] },
};

/**
 * The inbox (contract §8.13): newest first, unread ones marked, and a tap opens the related screen.
 * Clients reach it from the bell on Home (`back`); agents have it as their Alerts tab.
 */
export function NotificationsScreen({ back = false }: { back?: boolean }) {
  const t = useT();
  const router = useRouter();
  const dir = useDir();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const inbox = useNotifications();
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();
  const items = inbox.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = inbox.data?.pages[0]?.unread ?? 0;
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const open = (n: NotificationItem) => {
    if (!n.read) markRead.mutate(n.id);
    const href = safeHref(n.href);
    if (href && href !== '/notifications') router.push(href as Href);
  };

  const empty = !signedIn ? (
    <Message
      title={t('سجّل دخولك عشان توصلك التنبيهات', 'Sign in to get notifications')}
      body={t('تذكير المعاينات ونزول الأسعار بيوصلوا لحسابك.', 'Viewing reminders and price drops come to your account.')}
      action={{ label: t('تسجيل الدخول', 'Sign in'), onPress: () => router.push('/sign-in') }}
    />
  ) : inbox.isPending ? (
    <ActivityIndicator color={colors.accent} style={styles.loading} />
  ) : inbox.isError ? (
    <Message
      title={t('معرفناش نجيب التنبيهات', 'Couldn’t load notifications')}
      body={t('اتأكد إنك متصل بالإنترنت.', 'Check your connection.')}
      action={{ label: t('حاول تاني', 'Try again'), onPress: () => void inbox.refetch() }}
    />
  ) : (
    <Message title={t('مفيش تنبيهات', 'No notifications')} body={t('هنا هتلاقي تذكير المعاينات ونزول الأسعار.', 'Viewing reminders and price drops will show up here.')} />
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={items}
      keyExtractor={(n) => String(n.id)}
      renderItem={({ item }) => <Row n={item} onPress={() => open(item)} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListFooterComponent={inbox.isFetchingNextPage ? <ActivityIndicator color={colors.accent} style={styles.gap} /> : undefined}
      onEndReached={() => {
        if (inbox.hasNextPage && !inbox.isFetchingNextPage) inbox.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View style={styles.header}>
          {back ? (
            <IconButton
              label={t('رجوع', 'Back')}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              icon={<BackIcon size={20} color={colors.ink} />}
            />
          ) : null}
          <Txt accessibilityRole="header" size={24} weight="semibold" style={styles.flex}>
            {t('التنبيهات', 'Notifications')}
          </Txt>
          {unread > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => markAll.mutate(undefined)} hitSlop={8}>
              <Txt size={13} weight="medium" color="accentInk">
                {t('علّم الكل مقروء', 'Mark all read')}
              </Txt>
            </Pressable>
          ) : null}
        </View>
      }
      ListEmptyComponent={empty}
      refreshControl={
        signedIn ? <RefreshControl refreshing={inbox.isRefetching} onRefresh={() => void inbox.refetch()} tintColor={colors.accent} /> : undefined
      }
    />
  );
}

function Row({ n, onPress }: { n: NotificationItem; onPress: () => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const { icon: Icon, tone } = KIND[n.kind];
  const [bg, fg] = tone(colors);
  const title = lang === 'ar' ? n.titleAr : n.titleEn;
  const body = lang === 'ar' ? n.bodyAr : n.bodyEn;
  const when = relTime(new Date(n.createdAt), lang);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${n.read ? '' : t('جديد: ', 'New: ')}${title}. ${body}. ${when}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        n.read
          ? { backgroundColor: colors.surface, borderColor: colors.line }
          : { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft },
        { opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: bg }]}>
        <Icon size={20} color={fg} />
      </View>
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Txt size={14} weight="semibold" style={styles.flex} numberOfLines={2}>
            {rtlLine(title, lang)}
          </Txt>
          <Txt size={11} color="ink3">
            {when}
          </Txt>
        </View>
        <Txt size={13} color="ink2">
          {rtlLine(body, lang)}
        </Txt>
      </View>
      {n.read ? null : <View testID="unread-dot" style={[styles.dot, { backgroundColor: colors.accent }]} />}
    </Pressable>
  );
}

function Message({ title, body, action }: { title: string; body: string; action?: { label: string; onPress: () => void } }) {
  const { colors } = useTheme();
  return (
    <View style={styles.message}>
      <BellOff size={32} color={colors.ink3} strokeWidth={1.6} />
      <Txt weight="medium" align="center">
        {title}
      </Txt>
      <Txt size={13} color="ink2" align="center">
        {body}
      </Txt>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, marginBottom: 16 },
  flex: { flex: 1 },
  gap: { height: 8 },
  loading: { marginTop: 48 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  message: { alignItems: 'center', gap: 8, paddingTop: 64, paddingHorizontal: 24 },
  action: { marginTop: 8, paddingHorizontal: 24 },
});
