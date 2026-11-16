import { pickField, joinParts, type AdminChatDetail, type AdminChatItem, CHAT_REPORT_REASON_LABEL, type ChatMessage, type ChatReport, type ChatReportReason, chatPreview, fmtDate, fmtNum, relTime, REPORT_OUTCOME_LABEL, type ReportOutcome } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { Flag, Lock, MessagesSquare } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { m, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { useAdminChat, useAdminChatMessages, useAdminChats, useResolveReport, useUnblockChat } from '../hooks/use-people';
import { BackBar } from './clients-screen';

export const REASON_LABEL: Record<ChatReportReason, { ar: string; en: string }> = CHAT_REPORT_REASON_LABEL;
const OUTCOME_LABEL = REPORT_OUTCOME_LABEL;

/** `/admin/chats` (phase 24): every conversation, or those with open reports first. */
export function AdminChatsScreen() {
  const t = useT();
  const { colors } = useTheme();
  const [reported, setReported] = useState(true);
  const chats = useAdminChats(reported);
  const items = chats.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/more" />
      <FlatList
        contentContainerStyle={styles.content}
        data={items}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item }) => <ChatRow c={item} />}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Txt accessibilityRole="header" size={24} weight="semibold">
              {t(m.common.chats)}
            </Txt>
            <Txt size={13} color="ink2">
              {t(m.admin.readOnlyYouCannotSend)}
            </Txt>
            <View style={styles.chips}>
              {[true, false].map((r) => (
                <Pressable
                  key={String(r)}
                  accessibilityRole="radio"
                  accessibilityLabel={r ? t(m.common.withReports) : t(m.common.all)}
                  accessibilityState={{ checked: reported === r }}
                  onPress={() => setReported(r)}
                  style={[styles.chip, { backgroundColor: reported === r ? colors.ink : colors.surface, borderColor: colors.line }]}
                >
                  <Txt size={13} weight="medium" style={{ color: reported === r ? colors.bg : colors.ink }}>
                    {r ? t(m.common.withReports) : t(m.common.all)}
                  </Txt>
                </Pressable>
              ))}
            </View>
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
              <Txt weight="medium">{reported ? t(m.admin.noOpenReports) : t(m.admin.noChats)}</Txt>
            </View>
          )
        }
        onEndReached={() => {
          if (chats.hasNextPage && !chats.isFetchingNextPage) void chats.fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={chats.isRefetching} onRefresh={() => void chats.refetch()} tintColor={colors.accent} />}
      />
    </View>
  );
}

function ChatRow({ c }: { c: AdminChatItem }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const name = c.client?.name ?? t(m.common.deletedAccount);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={joinParts([name, pickField(c.agent, 'name', lang)], lang)}
      onPress={() => router.push(`/admin/chat/${c.id}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.flex}>
        <View style={styles.line}>
          <Txt weight="medium" style={styles.flex} numberOfLines={1}>
            {`${name} ↔ ${pickField(c.agent, 'name', lang)}`}
          </Txt>
          {c.openReports ? (
            <View style={[styles.tag, { backgroundColor: colors.dangerSoft }]}>
              <Flag size={12} color={colors.danger} />
              <Txt size={11} weight="medium" color="danger">
                {fmtNum(c.openReports, lang)}
              </Txt>
            </View>
          ) : null}
          {c.blocked ? <Lock size={14} color={colors.ink3} /> : null}
        </View>
        <Txt size={12} color="ink2" numberOfLines={1}>
          {pickField(c.property, 'title', lang)}
        </Txt>
        {c.last ? (
          <Txt size={12} color="ink3" numberOfLines={1}>
            {`${chatPreview(c.last.body, lang)} | ${relTime(new Date(c.last.createdAt), lang)}`}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** `/admin/chat/:id` (phase 24): the conversation, read-only, with its reports and what to do about them. */
export function AdminChatScreen({ id }: { id: number }) {
  const t = useT();
  const { colors } = useTheme();
  const chat = useAdminChat(id);
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <BackBar fallback="/admin/chats" />
      {chat.isPending ? (
        <ActivityIndicator style={styles.empty} color={colors.accent} />
      ) : chat.isError ? (
        <View style={styles.pad}>
          {chat.error instanceof ApiError && chat.error.status === 404 ? <Txt align="center">{t(m.admin.thisConversationDoesNotExist)}</Txt> : <ListingsError onRetry={() => void chat.refetch()} />}
        </View>
      ) : (
        <ChatBody c={chat.data} />
      )}
    </View>
  );
}

function ChatBody({ c }: { c: AdminChatDetail }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const messages = useAdminChatMessages(c.id);
  const unblock = useUnblockChat(c.id);
  const list = (messages.data?.pages.slice().reverse() ?? []).flatMap((p) => p.items);
  const agentName = pickField(c.agent, 'name', lang);
  const clientName = c.client?.name ?? t(m.common.deletedAccount);
  const open = c.reports.filter((r) => !r.resolvedAt);
  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
      <Txt accessibilityRole="header" size={20} weight="semibold">
        {`${clientName} ↔ ${agentName}`}
      </Txt>
      <Txt size={13} color="ink2">
        {pickField(c.property, 'title', lang)}
      </Txt>
      {c.blocked ? (
        <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
          <View style={styles.line}>
            <Lock size={16} color={colors.ink2} />
            <Txt size={13} style={styles.flex}>
              {c.blocked.by === 'admin'
                ? t(m.admin.theMaqarTeamClosedIt)
                : c.blocked.by === 'agent'
                  ? t(m.admin.theAdvisorClosedIt)
                  : t(m.admin.theClientClosedIt)}
            </Txt>
          </View>
          <Button
            label={t(m.admin.openItAgain)}
            variant="secondary"
            loading={unblock.isPending}
            onPress={() => unblock.mutate(undefined, { onSuccess: () => toast.show({ title: t(m.admin.conversationOpened), tone: 'sage' }) })}
          />
        </View>
      ) : null}
      {open.length ? (
        <Txt size={16} weight="semibold">
          {t(m.admin.openReports)}
        </Txt>
      ) : null}
      {open.map((r) => (
        <ReportCard key={r.id} r={r} blocked={!!c.blocked} />
      ))}
      <Txt size={16} weight="semibold">
        {t(m.admin.messages)}
      </Txt>
      {messages.hasNextPage ? <Button label={t(m.admin.olderMessages)} variant="ghost" loading={messages.isFetchingNextPage} onPress={() => void messages.fetchNextPage()} /> : null}
      {messages.isPending ? <ActivityIndicator color={colors.accent} /> : null}
      {list.map((m) => (
        <Line key={m.id} m={m} who={m.sender === 'client' ? clientName : agentName} />
      ))}
      {c.reports.some((r) => r.resolvedAt) ? (
        <>
          <Txt size={16} weight="semibold">
            {t(m.admin.closedReports)}
          </Txt>
          {c.reports
            .filter((r) => r.resolvedAt)
            .map((r) => (
              <Txt key={r.id} size={12} color="ink2">
                {`${t(REASON_LABEL[r.reason])} | ${t(OUTCOME_LABEL[r.outcome!])} | ${fmtDate(r.resolvedAt!.slice(0, 10), lang)}`}
              </Txt>
            ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function Line({ m, who }: { m: ChatMessage; who: string }) {
  const lang = useLang();
  const { colors } = useTheme();
  const text = m.body.kind === 'text' ? m.body.text : chatPreview(m.body, lang);
  return (
    <View style={[styles.msg, { backgroundColor: m.sender === 'agent' ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
      <Txt size={11} color="ink3">{`${who} | ${relTime(new Date(m.createdAt), lang)}`}</Txt>
      <Txt size={14}>{text}</Txt>
    </View>
  );
}

function ReportCard({ r, blocked }: { r: ChatReport; blocked: boolean }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const resolve = useResolveReport();
  const act = (outcome: ReportOutcome) =>
    resolve.mutate(
      { id: r.id, outcome },
      {
        onSuccess: () => toast.show({ title: t(OUTCOME_LABEL[outcome]), tone: 'sage' }),
        onError: () => toast.show({ title: t(m.common.somethingWentWrongTryAgain), tone: 'danger' }),
      },
    );
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
      <View style={styles.line}>
        <Flag size={16} color={colors.danger} />
        <Txt weight="medium" style={styles.flex}>
          {t(REASON_LABEL[r.reason])}
        </Txt>
        <Txt size={12} color="ink3">
          {relTime(new Date(r.createdAt), lang)}
        </Txt>
      </View>
      <Txt size={13} color="ink2">
        {r.by === 'agent' ? t(m.admin.byAdvisor(r.reporter?.name)) : t(m.admin.byTheClient)}
      </Txt>
      {r.note ? <Txt size={14}>{r.note}</Txt> : null}
      <View style={styles.actions}>
        <Button label={t(m.admin.dismiss)} variant="secondary" loading={resolve.isPending} onPress={() => act('dismissed')} />
        {blocked ? null : <Button label={t(m.common.closeTheConversation)} variant="secondary" loading={resolve.isPending} onPress={() => act('blocked')} />}
        <Button
          label={t(m.admin.suspendTheClient)}
          variant="ghost"
          loading={resolve.isPending}
          onPress={() =>
            Alert.alert(t(m.admin.suspendTheClient2), t(m.admin.theyAreSignedOutAnd2), [
              { text: t(m.common.no), style: 'cancel' },
              { text: t(m.common.suspend), style: 'destructive', onPress: () => act('suspended') },
            ])
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  pad: { padding: 24 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  body: { paddingHorizontal: 16, gap: 12 },
  header: { gap: 10, marginBottom: 16 },
  gap: { height: 8 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { height: 36, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  row: { borderRadius: radius.lg, borderWidth: 1, padding: 14 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 14, gap: 8 },
  msg: { borderRadius: radius.md, borderWidth: 1, padding: 10, gap: 2 },
  actions: { gap: 8 },
});
