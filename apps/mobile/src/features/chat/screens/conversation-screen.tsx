import { pickField, joinParts, type AnswerBookingBody, CHAT_IMAGES_MAX, CHAT_REPORT_REASONS, CHAT_TEXT_MAX, type ChatMessage, type ChatReportReason, type ChatSender, type ChatThread, fmtDate, fmtMoney, fmtTime, type SendChatBody } from '@maqar/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, BadgeCheck, Ban, Calculator, CalendarClock, Flag, Home, ImagePlus, Lock, MoreVertical, Phone, Rotate3d, SendHorizontal, ShieldCheck, X } from 'lucide-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { KeyboardAvoiding } from '@/components/keyboard-avoiding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { isActive, useAppActive } from '@/core/app-active';
import { useReduceMotion } from '@/core/hooks/use-reduce-motion';
import { EASE_IN_OUT, EASE_OUT } from '@/core/motion/motion';
import { m, useDir, useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { useSlots } from '@/features/viewings/hooks/use-viewings';
import { newestFirst } from '../chat-cache';
import { Bubble } from '../components/bubble';
import { preparePhotos } from '../photos';
import { useAnswerBooking, useBlockChat, useBookSlot, useMarkRead, useMessages, useReportChat, useSend, useSendImages, useThread } from '../hooks/use-chat';
import { sendTyping, setOpenThread, useTyping } from '../socket';

const dayOf = (iso: string) => new Date(iso).toDateString();

/** `/chat/:id` and `/agent/chat/:id` (contract §8.12, §10.3): the conversation, live. */
export function ConversationScreen({ id, side }: { id: number; side: ChatSender }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const thread = useThread(id);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = () => (router.canGoBack() ? router.back() : router.replace(side === 'client' ? '/chat' : '/agent/chats'));

  // While on screen, its messages need no notification. In the background it is not on screen,
  // so the server notifies again.
  useFocusEffect(
    useCallback(() => {
      setOpenThread(isActive() ? id : null);
      const sub = AppState.addEventListener('change', (state) => setOpenThread(isActive(state) ? id : null));
      return () => {
        sub.remove();
        setOpenThread(null);
      };
    }, [id]),
  );

  if (!thread.data) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg, paddingTop: insets.top + 8 }]}>
        <View style={styles.topBack}>
          <IconButton label={t(m.common.back)} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
        </View>
        {thread.isError ? (
          <View style={styles.failed}>
            <Txt align="center">{t(m.chat.weCouldntOpenThisConversation)}</Txt>
            <Button label={t(m.common.tryAgain)} variant="secondary" onPress={() => void thread.refetch()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        )}
      </View>
    );
  }
  return <Conversation thread={thread.data} side={side} onBack={back} />;
}

function Conversation({ thread, side, onBack }: { thread: ChatThread; side: ChatSender; onBack: () => void }) {
  const t = useT();
  const lang = useLang();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const messages = useMessages(thread.id);
  const send = useSend(thread.id);
  const sendImages = useSendImages(thread.id);
  const markRead = useMarkRead(thread.id);
  const book = useBookSlot(thread.id);
  const [draft, setDraft] = useState('');
  const [viewer, setViewer] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [menu, setMenu] = useState<'options' | 'report' | null>(null);
  const block = useBlockChat(thread.id);
  const [booking, setBooking] = useState<{ messageId: number; time: string } | null>(null);
  const answerBooking = useAnswerBooking(thread.id);
  // The request whose time the advisor is moving (2026-11-14).
  const [moving, setMoving] = useState<{ messageId: number; viewingId: number } | null>(null);
  const typedAt = useTyping((s) => s[thread.id] ?? 0);
  // The store clears it 4 seconds after the last keystroke.
  const otherTyping = typedAt > 0;
  const list = useMemo(() => newestFirst(messages.data), [messages.data]);
  // Messages after this moment arrived while the chat was open (render must stay pure, so read once).
  const [openedAt] = useState(Date.now);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const p = thread.property;
  const agentName = pickField(thread.agent, 'name', lang);
  const otherName = side === 'client' ? agentName : thread.client?.name || t(m.common.deletedAccount2);
  const phone = side === 'client' ? thread.agent.phone : thread.client?.phone;

  // Reading: the other side's messages are marked read as they arrive on screen, and only while the
  // app is in front. Each newest unread message is tried once: a failure waits for the next message,
  // or for the app to come back.
  const active = useAppActive();
  const newestUnread = list.find((m) => m.sender !== side && !m.readAt && m.id > 0)?.id ?? 0;
  const readNow = markRead.mutate;
  const triedRead = useRef(0);
  useEffect(() => {
    if (!active) triedRead.current = 0;
    else if (newestUnread && triedRead.current !== newestUnread) {
      triedRead.current = newestUnread;
      readNow();
    }
  }, [active, newestUnread, readNow]);

  const post = (body: SendChatBody) =>
    send.mutate(body, { onError: (err) => toast.show({ title: errorText(err, t), tone: 'danger' }) });
  const sendText = (text: string) => {
    const v = text.trim();
    if (!v) return;
    // The draft leaves the box only once the server took the message; a failed send keeps the
    // text so it can be retried without retyping.
    send.mutate(
      { kind: 'text', text: v },
      {
        onSuccess: () => setDraft(''),
        onError: (err) => toast.show({ title: errorText(err, t), tone: 'danger' }),
      },
    );
  };

  const attach = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: CHAT_IMAGES_MAX, quality: 1 });
    if (res.canceled || !res.assets.length) return;
    const photos = await preparePhotos(res.assets.slice(0, CHAT_IMAGES_MAX)).catch(() => null);
    if (!photos) return toast.show({ title: t(m.common.weCouldntPrepareThePhotos), tone: 'danger' });
    sendImages.mutate(photos, { onError: (err) => toast.show({ title: errorText(err, t), tone: 'danger' }) });
  };

  const onBook = (messageId: number, time: string) => {
    setBooking({ messageId, time });
    book.mutate(
      { messageId, time },
      {
        onSuccess: () => toast.show({ title: t(m.chat.requestSentTheAdvisorWill), tone: 'sage' }),
        onError: (err) => toast.show({ title: errorText(err, t), tone: 'danger' }),
        onSettled: () => setBooking(null),
      },
    );
  };

  /** The advisor answers a booking request: accept or decline at once, or pick another free hour first. */
  const answer = (messageId: number, body: AnswerBookingBody) =>
    answerBooking.mutate(
      { messageId, body },
      {
        onSuccess: () =>
          toast.show({
            title:
              body.action === 'accept'
                ? t(m.chat.viewingConfirmedToTheClient)
                : body.action === 'decline'
                  ? t(m.chat.theClientWasToldYou)
                  : t(m.chat.theNewTimeWasSent),
            tone: 'sage',
          }),
        onError: (err) => toast.show({ title: errorText(err, t), tone: 'danger' }),
      },
    );
  const onAnswer = (messageId: number, action: 'accept' | 'decline' | 'reschedule') => {
    if (action !== 'reschedule') return answer(messageId, { action });
    const card = list.find((x) => x.id === messageId);
    if (card?.body.kind === 'booking') setMoving({ messageId, viewingId: card.body.viewingId });
  };

  const quick = [
    t(m.chat.stillAvailable),
    t(m.chat.canIViewIt),
    t(m.chat.whatsThePaymentPlan),
    t(m.chat.morePhotosPlease),
    t(m.chat.anyCashDiscount),
    ...(p.tour ? [t(m.chat.isThereA360Tour)] : []),
  ];
  const actions: { icon: typeof Home; label: string; onPress: () => void }[] = [
    { icon: CalendarClock, label: t(m.chat.freeTimes), onPress: () => setPicking(true) },
    ...(p.plan ? [{ icon: Calculator, label: t(m.chat.paymentPlan), onPress: () => post({ kind: 'plan' }) }] : []),
    ...(p.tour ? [{ icon: Rotate3d, label: t(m.common.n360Tour), onPress: () => post({ kind: 'tour' }) }] : []),
    { icon: Home, label: t(m.chat.homeCard), onPress: () => post({ kind: 'property' }) },
  ];

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const older = list[index + 1];
    const newer = list[index - 1];
    const firstOfDay = !older || dayOf(older.createdAt) !== dayOf(item.createdAt);
    const tail = !newer || newer.sender !== item.sender;
    // 2026-11-16: a message that arrives while the chat is open pops in from its sender's side. The
    // one I send pops once, while it is sending; its saved copy (a new id) then just takes its place.
    const pops = Date.parse(item.createdAt) > openedAt && (item.id < 0 || item.sender !== side);
    const fromEnd = item.sender === side;
    return (
      <View style={tail ? styles.runEnd : styles.run}>
        {firstOfDay ? <DayPill iso={item.createdAt} /> : null}
        <Pop on={pops} dx={(fromEnd ? 1 : -1) * (dir === 'rtl' ? -1 : 1) * 16} rightSide={fromEnd !== (dir === 'rtl')}>
          <Bubble
            m={item}
            thread={thread}
            side={side}
            tail={tail}
            onBook={onBook}
            booking={booking?.messageId === item.id ? booking.time : null}
            onImage={setViewer}
            onAnswer={side === 'agent' ? onAnswer : undefined}
            answering={answerBooking.isPending}
          />
        </Pop>
      </View>
    );
  };

  return (
    <KeyboardAvoiding style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderColor: colors.line }]}>
        <IconButton label={t(m.common.back)} icon={<BackIcon size={20} color={colors.ink} />} onPress={onBack} />
        <View style={[styles.avatar, { backgroundColor: side === 'client' ? thread.agent.colour : colors.sage }]}>
          <Txt size={15} weight="semibold" style={styles.white}>
            {otherName.slice(0, 1)}
          </Txt>
        </View>
        <View style={styles.flex}>
          <View style={styles.inline}>
            <Txt accessibilityRole="header" size={15} weight="semibold" numberOfLines={1} style={styles.shrink}>
              {otherName}
            </Txt>
            {side === 'client' ? <BadgeCheck size={16} color={colors.accent} /> : null}
          </View>
          <Txt size={12} color={otherTyping ? 'accentInk' : 'ink2'} numberOfLines={1}>
            {otherTyping
              ? t(m.common.typing)
              : side === 'client'
                ? t(m.chat.advisorReplyIn(thread.agent.avgReplyMins))
                : t(m.common.client)}
          </Txt>
        </View>
        {phone ? <IconButton label={t(m.common.call)} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
        <IconButton label={t(m.common.conversationOptions)} icon={<MoreVertical size={18} color={colors.ink} />} onPress={() => setMenu('options')} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t(m.chat.home)}: ${pickField(p, 'title', lang)}`}
        onPress={() => router.push(`/property/${p.id}`)}
        style={[styles.pinned, { backgroundColor: colors.surface, borderColor: colors.line }]}
      >
        <View style={[styles.pinThumb, { backgroundColor: colors.surface2 }]}>
          {p.cover ? <Image source={{ uri: mediaUrl(p.cover) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <View style={styles.flex}>
          <Txt size={13} weight="medium" numberOfLines={1}>
            {pickField(p, 'title', lang)}
          </Txt>
          <Txt size={12} weight="semibold" color="accentInk">
            {fmtMoney(p.price, lang)}
          </Txt>
        </View>
        <View style={[styles.view, { backgroundColor: colors.surface2 }]}>
          <Txt size={11.5} weight="medium">
            {t(m.chat.view)}
          </Txt>
        </View>
      </Pressable>

      <FlatList
        inverted
        style={styles.fill}
        contentContainerStyle={styles.messages}
        data={list}
        keyExtractor={(m) => String(m.id)}
        renderItem={renderItem}
        testID="messages"
        onEndReached={() => messages.hasNextPage && !messages.isFetchingNextPage && !messages.isFetchNextPageError && void messages.fetchNextPage()}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        // Inverted: the header sits at the bottom (typing), the footer at the top (older, the safety note).
        ListHeaderComponent={otherTyping ? <TypingDots /> : undefined}
        ListFooterComponent={
          messages.isPending || messages.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.older} />
          ) : messages.isError ? (
            <View style={styles.retryRow}>
              <Txt size={12.5} color="ink2" align="center">
                {messages.isFetchNextPageError ? t(m.chat.weCouldntLoadOlderMessages) : t(m.chat.weCouldntLoadTheMessages)}
              </Txt>
              <Button
                label={t(m.common.tryAgain)}
                variant="secondary"
                onPress={() => void (messages.isFetchNextPageError ? messages.fetchNextPage() : messages.refetch())}
              />
            </View>
          ) : side === 'client' && !messages.hasNextPage ? (
            <View style={[styles.safety, { backgroundColor: colors.sageSoft }]}>
              <ShieldCheck size={16} color={colors.sageInk} />
              <Txt size={11.5} color="sageInk" style={styles.flex}>
                {t(m.chat.youreChattingWithAVerified)}
              </Txt>
            </View>
          ) : undefined
        }
      />

      {thread.blocked ? (
        <View style={[styles.closed, { backgroundColor: colors.surface2, borderColor: colors.line, paddingBottom: insets.bottom + 14 }]}>
          <Lock size={16} color={colors.ink2} />
          <Txt size={13} color="ink2" style={styles.flex}>
            {thread.blocked.by === side
              ? t(m.chat.youClosedThisConversationNobody)
              : thread.blocked.by === 'admin'
                ? t(m.chat.theMaqarTeamClosedThis)
                : side === 'client'
                  ? t(m.chat.theAdvisorClosedThisConversation)
                  : t(m.chat.theClientClosedThisConversation)}
          </Txt>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow} keyboardShouldPersistTaps="handled">
            {side === 'client'
              ? quick.map((q) => (
                  <Pressable key={q} accessibilityRole="button" onPress={() => sendText(q)} style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
                    <Txt size={12.5} weight="medium" color="accentInk">
                      {q}
                    </Txt>
                  </Pressable>
                ))
              : actions.map((a) => (
                  <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress} style={[styles.chip, { backgroundColor: colors.accentSoft }]}>
                    <a.icon size={15} color={colors.accentInk} />
                    <Txt size={12.5} weight="medium" color="accentInk">
                      {a.label}
                    </Txt>
                  </Pressable>
                ))}
          </ScrollView>

          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.line, paddingBottom: insets.bottom + 10 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(m.chat.sendPhotos)}
              disabled={sendImages.isPending}
              onPress={() => void attach()}
              style={styles.attach}
            >
              {sendImages.isPending ? <ActivityIndicator color={colors.accent} /> : <ImagePlus size={22} color={colors.ink2} />}
            </Pressable>
            <TextInput
              accessibilityLabel={t(m.chat.writeAMessage)}
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                if (v.trim()) sendTyping(thread.id);
              }}
              placeholder={t(m.chat.writeAMessage2)}
              placeholderTextColor={colors.ink3}
              maxLength={CHAT_TEXT_MAX}
              multiline
              style={[styles.input, { color: colors.ink, backgroundColor: colors.surface2, textAlign: dir === 'rtl' ? 'right' : 'left' }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(m.chat.send)}
              accessibilityState={{ disabled: !draft.trim() }}
              disabled={!draft.trim()}
              onPress={() => sendText(draft)}
              style={[styles.send, { backgroundColor: colors.accent, opacity: draft.trim() ? 1 : 0.45 }]}
            >
              <SendHorizontal size={20} color={colors.navy} style={dir === 'rtl' ? styles.flip : undefined} />
            </Pressable>
          </View>
        </>
      )}

      <Sheet open={menu === 'options'} onClose={() => setMenu(null)} title={t(m.common.conversationOptions)}>
        <View style={styles.menu}>
          <Pressable accessibilityRole="button" accessibilityLabel={t(m.common.reportTheConversation)} onPress={() => setMenu('report')} style={styles.menuRow}>
            <Flag size={18} color={colors.ink} />
            <Txt>{t(m.common.reportTheConversation)}</Txt>
          </Pressable>
          {thread.blocked ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(m.common.closeTheConversation)}
              onPress={() => {
                setMenu(null);
                Alert.alert(
                  t(m.chat.closeTheConversation),
                  t(m.chat.nobodyCanSendInIt),
                  [
                    { text: t(m.common.no), style: 'cancel' },
                    {
                      text: t(m.common.close),
                      style: 'destructive',
                      onPress: () => block.mutate(undefined, { onError: () => toast.show({ title: t(m.common.somethingWentWrongTryAgain), tone: 'danger' }) }),
                    },
                  ],
                );
              }}
              style={styles.menuRow}
            >
              <Ban size={18} color={colors.danger} />
              <Txt color="danger">{t(m.common.closeTheConversation)}</Txt>
            </Pressable>
          )}
        </View>
      </Sheet>
      <ReportSheet threadId={thread.id} open={menu === 'report'} onClose={() => setMenu(null)} />

      {side === 'agent' ? <DayPicker propertyId={p.id} open={picking} onClose={() => setPicking(false)} onPick={(date) => post({ kind: 'slots', date })} /> : null}
      {side === 'agent' && moving ? (
        <MovePicker
          propertyId={p.id}
          viewingId={moving.viewingId}
          onClose={() => setMoving(null)}
          onPick={(date, time) => {
            const { messageId } = moving;
            setMoving(null);
            answer(messageId, { action: 'reschedule', date, time });
          }}
        />
      ) : null}

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <Pressable accessibilityRole="button" accessibilityLabel={t(m.common.close)} onPress={() => setViewer(null)} style={[styles.close, { top: insets.top + 12 }]}>
            <X size={20} color="#fff" />
          </Pressable>
          {viewer ? <Image source={{ uri: mediaUrl(viewer) ?? undefined }} style={styles.full} contentFit="contain" /> : null}
        </View>
      </Modal>
    </KeyboardAvoiding>
  );
}

const REASON_LABEL: Record<ChatReportReason, { ar: string; en: string }> = {
  spam: m.chat.spamOrNuisance,
  abuse: m.chat.abuseOrOffensiveLanguage,
  scam: m.chat.scamOrAskingForMoney,
  other: m.chat.somethingElse,
};

/** Report the conversation to the Maqar team (phase 24): a reason and an optional note. */
function ReportSheet({ threadId, open, onClose }: { threadId: number; open: boolean; onClose: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  const report = useReportChat(threadId);
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const [note, setNote] = useState('');
  return (
    <Sheet open={open} onClose={onClose} title={t(m.common.reportTheConversation)}>
      <View style={styles.menu}>
        <Txt size={13} color="ink2">
          {t(m.chat.theReportGoesToThe)}
        </Txt>
        {CHAT_REPORT_REASONS.map((r) => (
          <Pressable
            key={r}
            accessibilityRole="radio"
            accessibilityLabel={t(REASON_LABEL[r])}
            accessibilityState={{ checked: reason === r }}
            onPress={() => setReason(r)}
            style={[styles.reason, { borderColor: reason === r ? colors.accent : colors.line, backgroundColor: colors.surface }]}
          >
            <Txt>{t(REASON_LABEL[r])}</Txt>
          </Pressable>
        ))}
        <TextField label={t(m.chat.detailsOptional)} value={note} onChangeText={setNote} maxLength={500} multiline />
        <Button
          label={t(m.chat.sendTheReport)}
          disabled={!reason}
          loading={report.isPending}
          onPress={() =>
            report.mutate(
              { reason: reason!, ...(note.trim() ? { note: note.trim() } : {}) },
              {
                onSuccess: () => {
                  toast.show({ title: t(m.chat.theMaqarTeamGotYour), tone: 'sage' });
                  setReason(null);
                  setNote('');
                  onClose();
                },
                onError: () => toast.show({ title: t(m.common.somethingWentWrongTryAgain), tone: 'danger' }),
              },
            )
          }
        />
      </View>
    </Sheet>
  );
}

/** The agent picks the day whose free times go in the card. */
function DayPicker({ propertyId, open, onClose, onPick }: { propertyId: number; open: boolean; onClose: () => void; onPick: (date: string) => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const slots = useSlots(propertyId);
  const days = (slots.data?.days ?? []).map((d) => ({ date: d.date, free: d.slots.filter((s) => s.state === 'free').length })).filter((d) => d.free > 0);
  return (
    <Sheet open={open} onClose={onClose} title={t(m.chat.sendADaysFreeTimes)} scroll>
      {slots.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : days.length ? (
        <View style={styles.days}>
          {days.map((d) => (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityLabel={joinParts([fmtDate(d.date, lang, 'long'), t(m.chat.freeTimeCount(d.free))], lang)}
              onPress={() => {
                onClose();
                onPick(d.date);
              }}
              style={[styles.day, { backgroundColor: colors.surface2 }]}
            >
              <Txt size={13} weight="medium">
                {fmtDate(d.date, lang, 'long')}
              </Txt>
              <Txt size={11.5} color="ink2">
                {t(m.chat.freeTimeCountLong(d.free))}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : (
        <Txt color="ink2">{t(m.common.noFreeTimesInThe)}</Txt>
      )}
    </Sheet>
  );
}

/**
 * Another free hour for a booking request (2026-11-14): the request's own advisor's hours, with the
 * request's hour shown free. A day first, then its hour.
 */
function MovePicker({ propertyId, viewingId, onClose, onPick }: { propertyId: number; viewingId: number; onClose: () => void; onPick: (date: string, time: string) => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const slots = useSlots(propertyId, viewingId);
  const [day, setDay] = useState<string | null>(null);
  const days = (slots.data?.days ?? []).map((d) => ({ date: d.date, free: d.slots.filter((s) => s.state === 'free').map((s) => s.time) })).filter((d) => d.free.length > 0);
  const picked = days.find((d) => d.date === day);
  return (
    <Sheet open onClose={onClose} title={picked ? fmtDate(picked.date, lang, 'long') : t(m.chat.pickTheNewDay)} scroll>
      {slots.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : picked ? (
        <View style={styles.days}>
          {picked.free.map((time) => (
            <Pressable key={time} accessibilityRole="button" accessibilityLabel={fmtTime(time, lang)} onPress={() => onPick(picked.date, time)} style={[styles.day, { backgroundColor: colors.surface2 }]}>
              <Txt size={13} weight="medium">
                {fmtTime(time, lang)}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : days.length ? (
        <View style={styles.days}>
          {days.map((d) => (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityLabel={joinParts([fmtDate(d.date, lang, 'long'), t(m.chat.freeTimeCount(d.free.length))], lang)}
              onPress={() => setDay(d.date)}
              style={[styles.day, { backgroundColor: colors.surface2 }]}
            >
              <Txt size={13} weight="medium">
                {fmtDate(d.date, lang, 'long')}
              </Txt>
              <Txt size={11.5} color="ink2">
                {t(m.chat.freeTimeCountLong(d.free.length))}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : (
        <Txt color="ink2">{t(m.common.noFreeTimesInThe)}</Txt>
      )}
    </Sheet>
  );
}

/** "Today", "Yesterday", or the date, for the pill above a day's first message. */
function dayLabel(iso: string, t: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>, now = Date.now()): string {
  const d = new Date(iso).toDateString();
  if (d === new Date(now).toDateString()) return t(m.common.today);
  if (d === new Date(now - 86_400_000).toDateString()) return t(m.chat.yesterday);
  return fmtDate(new Date(iso), lang, 'long');
}

function DayPill({ iso }: { iso: string }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  return (
    <View style={[styles.dayPill, { backgroundColor: colors.surface2 }]}>
      <Txt size={11} weight="medium" color="ink2">
        {dayLabel(iso, t, lang)}
      </Txt>
    </View>
  );
}

/**
 * A bubble that pops in (2026-11-16): it grows from its sender's side with a small slide and
 * settles with a little bounce. `on` is decided once, when the message first shows.
 */
function Pop({ on, dx, rightSide, children }: { on: boolean; dx: number; rightSide: boolean; children: ReactNode }) {
  const reduced = useReduceMotion();
  const [pop] = useState(on);
  const p = useSharedValue(pop ? 0 : 1);
  useEffect(() => {
    if (pop) p.set(reduced ? 1 : withSpring(1, { duration: 380, dampingRatio: 0.7 }));
  }, [pop, reduced, p]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get() * 2),
    transform: [{ translateX: dx * (1 - p.get()) }, { scale: 0.85 + 0.15 * p.get() }],
  }));
  if (!pop) return <>{children}</>;
  // Full width, so the bubble keeps its own alignment; it grows from the side its sender is on.
  return <Animated.View style={[{ width: '100%', transformOrigin: rightSide ? 'right center' : 'left center' }, style]}>{children}</Animated.View>;
}

/** Three dots that rise one after another while the other side is typing (2026-11-16). */
function TypingDots() {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={t(m.common.typing)} style={[styles.typing, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {[0, 1, 2].map((k) => (
        <TypingDot key={k} index={k} color={colors.ink3} />
      ))}
    </View>
  );
}

function TypingDot({ index, color }: { index: number; color: string }) {
  const reduced = useReduceMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.set(
      withDelay(
        index * 140,
        withRepeat(withSequence(withTiming(-4, { duration: 260, easing: EASE_OUT }), withTiming(0, { duration: 260, easing: EASE_IN_OUT }), withTiming(0, { duration: 320 })), -1),
      ),
    );
  }, [reduced, index, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }], opacity: 0.55 + (-y.get() / 4) * 0.45 }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/** The server's reason when it has one the client can act on. */
function errorText(err: unknown, t: ReturnType<typeof useT>): string {
  if (err instanceof ApiError && err.status === 409) {
    return /already have a viewing/i.test(err.message)
      ? t(m.chat.youAlreadyHaveAViewing)
      : t(m.chat.thatTimeWasJustBooked);
  }
  if (err instanceof ApiError && err.status === 0) return t(m.common.noConnectionTryAgain);
  return t(m.common.somethingWentWrongTryAgain);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  closed: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1 },
  menu: { gap: 10 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  reason: { borderRadius: radius.md, borderWidth: 1.5, padding: 12 },
  topBack: { paddingHorizontal: 16 },
  loading: { marginTop: 48 },
  failed: { padding: 24, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrink: { flexShrink: 1 },
  pinned: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  pinThumb: { width: 44, height: 44, borderRadius: radius.md, overflow: 'hidden' },
  view: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  messages: { paddingHorizontal: 12, paddingVertical: 12 },
  run: { marginTop: 4 },
  runEnd: { marginTop: 10 },
  retryRow: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  older: { marginVertical: 16 },
  safety: { flexDirection: 'row', gap: 8, alignSelf: 'center', maxWidth: 320, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  dayPill: { alignSelf: 'center', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 10 },
  typing: { flexDirection: 'row', gap: 4, alignSelf: 'flex-start', borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipRow: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, borderRadius: radius.full, paddingHorizontal: 14 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  attach: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fonts.regular, fontSize: 14.5 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  days: { gap: 8 },
  day: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', end: 16, zIndex: 1, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  full: { width: '100%', height: '75%' },
});
