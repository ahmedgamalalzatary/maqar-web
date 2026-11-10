import { type ChatSender, type ChatThread, chatPreview, fmtNum, relTime } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, CheckCheck, MessagesSquare } from 'lucide-react-native';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { rtlLine, useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { useChats } from '../hooks/use-chat';
import { useTyping } from '../socket';

/** `/chat` and the agent's Chats tab (contract §8.12, §10.3): conversations, the latest first, with unread counts. */
export function ChatsScreen({ side }: { side: ChatSender }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const chats = useChats();
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={chats.data ?? []}
      keyExtractor={(c) => String(c.id)}
      renderItem={({ item }) => <Row c={item} side={side} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      ListHeaderComponent={
        <View style={styles.header}>
          {side === 'client' ? <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={() => router.back()} /> : null}
          <Txt accessibilityRole="header" size={24} weight="semibold">
            {t('المحادثات', 'Messages')}
          </Txt>
        </View>
      }
      ListEmptyComponent={
        chats.isPending ? (
          <CardSkeleton />
        ) : chats.isError ? (
          <ListingsError onRetry={() => void chats.refetch()} />
        ) : (
          <View style={styles.empty}>
            <MessagesSquare size={32} color={colors.ink3} strokeWidth={1.6} />
            <Txt weight="medium" align="center">
              {t('مفيش محادثات لسه', 'No conversations yet')}
            </Txt>
            <Txt size={13} color="ink2" align="center">
              {side === 'client'
                ? t('افتح أي وحدة واضغط «شات» عشان تكلم مسؤول المبيعات بتاعها مباشرة.', 'Open any home and tap “Chat” to talk to its sales advisor directly.')
                : t('أول ما عميل يكلمك عن وحدة من وحداتك هتلاقي المحادثة هنا.', 'When a client messages you about one of your homes, the conversation shows up here.')}
            </Txt>
            {side === 'client' ? <Button label={t('استكشف الوحدات', 'Explore homes')} variant="secondary" onPress={() => router.push('/explore')} /> : null}
          </View>
        )
      }
      refreshControl={<RefreshControl refreshing={chats.isRefetching} onRefresh={() => void chats.refetch()} tintColor={colors.accent} />}
    />
  );
}

function Row({ c, side }: { c: ChatThread; side: ChatSender }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const typing = useTyping((s) => (s[c.id] ?? 0) > 0);
  const name = side === 'client' ? (lang === 'ar' ? c.agent.nameAr : c.agent.nameEn) : c.client?.name || t('حساب محذوف', 'Deleted account');
  const home = lang === 'ar' ? c.property.titleAr : c.property.titleEn;
  const preview = typing ? t('بيكتب…', 'typing…') : c.last ? chatPreview(c.last.body, lang) : '';
  const mineLast = c.last?.sender === side;
  const cover = mediaUrl(c.property.cover);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, home, preview, c.unread ? t(`${fmtNum(c.unread, 'ar')} جديدة`, `${c.unread} new`) : null].filter(Boolean).join('، ')}
      onPress={() => router.push(side === 'client' ? `/chat/${c.id}` : `/agent/chat/${c.id}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: c.unread ? colors.accentSoft : colors.surface, borderColor: c.unread ? 'rgba(179, 137, 89, 0.25)' : colors.line, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View>
        <View style={[styles.avatar, { backgroundColor: side === 'client' ? c.agent.colour : colors.sage }]}>
          <Txt size={18} weight="semibold" style={styles.white}>
            {name.slice(0, 1)}
          </Txt>
        </View>
        <View style={[styles.thumb, { borderColor: colors.bg, backgroundColor: colors.surface2 }]}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
      </View>
      <View style={styles.flex}>
        <View style={styles.between}>
          <Txt size={14.5} weight="semibold" numberOfLines={1} style={styles.shrink}>
            {name}
          </Txt>
          {c.last ? (
            <Txt size={11} weight={c.unread ? 'semibold' : 'regular'} color={c.unread ? 'accentInk' : 'ink3'}>
              {relTime(new Date(c.last.createdAt), lang)}
            </Txt>
          ) : null}
        </View>
        <Txt size={11.5} color="ink3" numberOfLines={1}>
          {home}
        </Txt>
        <View style={styles.inline}>
          {mineLast && !typing ? <CheckCheck size={14} color={c.last?.readAt ? colors.accent : colors.ink3} /> : null}
          <Txt size={13} numberOfLines={1} weight={c.unread ? 'medium' : 'regular'} color={typing ? 'accentInk' : c.unread ? 'ink' : 'ink2'} style={styles.flex}>
            {rtlLine(preview, lang)}
          </Txt>
          {c.unread ? (
            <View style={[styles.count, { backgroundColor: colors.accent }]}>
              <Txt size={11} weight="semibold" style={{ color: colors.navy }}>
                {fmtNum(c.unread, lang)}
              </Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, minHeight: 44 },
  gap: { height: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  thumb: { position: 'absolute', bottom: -4, end: -4, width: 24, height: 24, borderRadius: 8, borderWidth: 2, overflow: 'hidden' },
  flex: { flex: 1, minWidth: 0 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  shrink: { flexShrink: 1 },
  count: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
});
