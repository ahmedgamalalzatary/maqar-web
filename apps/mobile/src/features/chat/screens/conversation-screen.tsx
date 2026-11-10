import { CHAT_IMAGES_MAX, CHAT_TEXT_MAX, type ChatMessage, type ChatSender, type ChatThread, fmtDate, fmtMoney, fmtNum, type SendChatBody } from '@maqar/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, BadgeCheck, Calculator, CalendarClock, Home, ImagePlus, Phone, Rotate3d, SendHorizontal, ShieldCheck, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { ApiError, mediaUrl } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { useSlots } from '@/features/viewings/hooks/use-viewings';
import { newestFirst } from '../chat-cache';
import { Bubble } from '../components/bubble';
import { preparePhotos } from '../photos';
import { useBookSlot, useMarkRead, useMessages, useSend, useSendImages, useThread } from '../hooks/use-chat';
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

  // While on screen, its messages need no notification.
  useFocusEffect(
    useCallback(() => {
      setOpenThread(id);
      return () => setOpenThread(null);
    }, [id]),
  );

  if (!thread.data) {
    return (
      <View style={[styles.fill, { backgroundColor: colors.bg, paddingTop: insets.top + 8 }]}>
        <View style={styles.topBack}>
          <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
        </View>
        {thread.isError ? (
          <View style={styles.failed}>
            <Txt align="center">{t('مش قادرين نفتح المحادثة دي.', 'We couldn’t open this conversation.')}</Txt>
            <Button label={t('حاول تاني', 'Try again')} variant="secondary" onPress={() => void thread.refetch()} />
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
  const [booking, setBooking] = useState<{ messageId: number; time: string } | null>(null);
  const typedAt = useTyping((s) => s[thread.id] ?? 0);
  // The store clears it 4 seconds after the last keystroke.
  const otherTyping = typedAt > 0;
  const list = useMemo(() => newestFirst(messages.data), [messages.data]);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const p = thread.property;
  const agentName = lang === 'ar' ? thread.agent.nameAr : thread.agent.nameEn;
  const otherName = side === 'client' ? agentName : thread.client?.name || t('حساب محذوف', 'Deleted account');
  const phone = side === 'client' ? thread.agent.phone : thread.client?.phone;

  // Reading: the other side's messages are marked read as they arrive on screen.
  const unreadFromOther = list.some((m) => m.sender !== side && !m.readAt && m.id > 0);
  useEffect(() => {
    if (unreadFromOther && !markRead.isPending) markRead.mutate();
  }, [unreadFromOther, markRead]);

  const post = (body: SendChatBody) =>
    send.mutate(body, { onError: (err) => toast.show({ title: errorText(err, t), tone: 'danger' }) });
  const sendText = (text: string) => {
    const v = text.trim();
    if (!v) return;
    post({ kind: 'text', text: v });
    setDraft('');
  };

  const attach = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: CHAT_IMAGES_MAX, quality: 1 });
    if (res.canceled || !res.assets.length) return;
    const photos = await preparePhotos(res.assets.slice(0, CHAT_IMAGES_MAX)).catch(() => null);
    if (!photos) return toast.show({ title: t('مقدرناش نجهز الصور', 'We couldn’t prepare the photos'), tone: 'danger' });
    sendImages.mutate(photos, { onError: (err) => toast.show({ title: errorText(err, t), tone: 'danger' }) });
  };

  const onBook = (messageId: number, time: string) => {
    setBooking({ messageId, time });
    book.mutate(
      { messageId, time },
      {
        onSuccess: () => toast.show({ title: t('المعاينة اتحجزت', 'Viewing booked'), tone: 'sage' }),
        onError: (err) => toast.show({ title: errorText(err, t), tone: 'danger' }),
        onSettled: () => setBooking(null),
      },
    );
  };

  const quick = [
    t('لسه متاحة؟', 'Still available?'),
    t('ممكن أعاينها؟', 'Can I view it?'),
    t('خطة السداد إيه؟', 'What’s the payment plan?'),
    t('ابعتلي صور أكتر', 'More photos please'),
    t('فيه خصم كاش؟', 'Any cash discount?'),
    ...(p.tour ? [t('فيه جولة ٣٦٠°؟', 'Is there a 360° tour?')] : []),
  ];
  const actions: { icon: typeof Home; label: string; onPress: () => void }[] = [
    { icon: CalendarClock, label: t('مواعيد متاحة', 'Free times'), onPress: () => setPicking(true) },
    ...(p.plan ? [{ icon: Calculator, label: t('خطة السداد', 'Payment plan'), onPress: () => post({ kind: 'plan' }) }] : []),
    ...(p.tour ? [{ icon: Rotate3d, label: t('جولة ٣٦٠°', '360° tour'), onPress: () => post({ kind: 'tour' }) }] : []),
    { icon: Home, label: t('تفاصيل الوحدة', 'Home card'), onPress: () => post({ kind: 'property' }) },
  ];

  const renderItem = ({ item, index }: { item: ChatMessage; index: number }) => {
    const older = list[index + 1];
    const newer = list[index - 1];
    const firstOfDay = !older || dayOf(older.createdAt) !== dayOf(item.createdAt);
    const tail = !newer || newer.sender !== item.sender;
    return (
      <View style={tail ? styles.runEnd : styles.run}>
        {firstOfDay ? <DayPill iso={item.createdAt} /> : null}
        <Bubble
          m={item}
          thread={thread}
          side={side}
          tail={tail}
          onBook={onBook}
          booking={booking?.messageId === item.id ? booking.time : null}
          onImage={setViewer}
        />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderColor: colors.line }]}>
        <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={onBack} />
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
              ? t('بيكتب…', 'typing…')
              : side === 'client'
                ? t(`مستشار مبيعات | بيرد خلال ${fmtNum(thread.agent.avgReplyMins, 'ar')} د`, `Sales advisor | replies in ${thread.agent.avgReplyMins} min`)
                : t('عميل', 'Client')}
          </Txt>
        </View>
        {phone ? <IconButton label={t('اتصال', 'Call')} icon={<Phone size={18} color={colors.ink} />} onPress={() => void Linking.openURL(`tel:${phone}`)} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('الوحدة', 'Home')}: ${lang === 'ar' ? p.titleAr : p.titleEn}`}
        onPress={() => router.push(`/property/${p.id}`)}
        style={[styles.pinned, { backgroundColor: colors.surface, borderColor: colors.line }]}
      >
        <View style={[styles.pinThumb, { backgroundColor: colors.surface2 }]}>
          {p.cover ? <Image source={{ uri: mediaUrl(p.cover) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        </View>
        <View style={styles.flex}>
          <Txt size={13} weight="medium" numberOfLines={1}>
            {lang === 'ar' ? p.titleAr : p.titleEn}
          </Txt>
          <Txt size={12} weight="semibold" color="accentInk">
            {fmtMoney(p.price, lang)}
          </Txt>
        </View>
        <View style={[styles.view, { backgroundColor: colors.surface2 }]}>
          <Txt size={11.5} weight="medium">
            {t('عرض', 'View')}
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
        onEndReached={() => messages.hasNextPage && !messages.isFetchingNextPage && void messages.fetchNextPage()}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        // Inverted: the header sits at the bottom (typing), the footer at the top (older, the safety note).
        ListHeaderComponent={otherTyping ? <TypingDots /> : undefined}
        ListFooterComponent={
          messages.isPending || messages.isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.older} />
          ) : side === 'client' && !messages.hasNextPage ? (
            <View style={[styles.safety, { backgroundColor: colors.sageSoft }]}>
              <ShieldCheck size={16} color={colors.sageInk} />
              <Txt size={11.5} color="sageInk" style={styles.flex}>
                {t('محادثتك مع مسؤول مبيعات موثّق من مقر. متشاركش بيانات الدفع في الشات.', 'You’re chatting with a verified Maqar advisor. Never share payment details in chat.')}
              </Txt>
            </View>
          ) : undefined
        }
      />

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
          accessibilityLabel={t('ابعت صور', 'Send photos')}
          disabled={sendImages.isPending}
          onPress={() => void attach()}
          style={styles.attach}
        >
          {sendImages.isPending ? <ActivityIndicator color={colors.accent} /> : <ImagePlus size={22} color={colors.ink2} />}
        </Pressable>
        <TextInput
          accessibilityLabel={t('اكتب رسالة', 'Write a message')}
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
            if (v.trim()) sendTyping(thread.id);
          }}
          placeholder={t('اكتب رسالة…', 'Write a message…')}
          placeholderTextColor={colors.ink3}
          maxLength={CHAT_TEXT_MAX}
          multiline
          style={[styles.input, { color: colors.ink, backgroundColor: colors.surface2, textAlign: dir === 'rtl' ? 'right' : 'left' }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ابعت', 'Send')}
          accessibilityState={{ disabled: !draft.trim() }}
          disabled={!draft.trim()}
          onPress={() => sendText(draft)}
          style={[styles.send, { backgroundColor: colors.accent, opacity: draft.trim() ? 1 : 0.45 }]}
        >
          <SendHorizontal size={20} color={colors.navy} style={dir === 'rtl' ? styles.flip : undefined} />
        </Pressable>
      </View>

      {side === 'agent' ? <DayPicker propertyId={p.id} open={picking} onClose={() => setPicking(false)} onPick={(date) => post({ kind: 'slots', date })} /> : null}

      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <View style={styles.viewer}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('اقفل', 'Close')} onPress={() => setViewer(null)} style={[styles.close, { top: insets.top + 12 }]}>
            <X size={20} color="#fff" />
          </Pressable>
          {viewer ? <Image source={{ uri: mediaUrl(viewer) ?? undefined }} style={styles.full} contentFit="contain" /> : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
    <Sheet open={open} onClose={onClose} title={t('ابعت مواعيد يوم', 'Send a day’s free times')}>
      {slots.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : days.length ? (
        <View style={styles.days}>
          {days.map((d) => (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityLabel={`${fmtDate(d.date, lang, 'long')}، ${t(`${fmtNum(d.free, 'ar')} ميعاد`, `${d.free} free`)}`}
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
                {t(`${fmtNum(d.free, 'ar')} ميعاد فاضي`, `${d.free} free`)}
              </Txt>
            </Pressable>
          ))}
        </View>
      ) : (
        <Txt color="ink2">{t('مفيش مواعيد فاضية في الأسبوعين الجايين.', 'No free times in the next two weeks.')}</Txt>
      )}
    </Sheet>
  );
}

/** "Today", "Yesterday", or the date, for the pill above a day's first message. */
function dayLabel(iso: string, t: ReturnType<typeof useT>, lang: ReturnType<typeof useLang>, now = Date.now()): string {
  const d = new Date(iso).toDateString();
  if (d === new Date(now).toDateString()) return t('النهارده', 'Today');
  if (d === new Date(now - 86_400_000).toDateString()) return t('امبارح', 'Yesterday');
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

function TypingDots() {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={t('بيكتب…', 'typing…')} style={[styles.typing, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {[0, 1, 2].map((k) => (
        <View key={k} style={[styles.dot, { backgroundColor: colors.ink3 }]} />
      ))}
    </View>
  );
}

/** The server's reason when it has one the client can act on. */
function errorText(err: unknown, t: ReturnType<typeof useT>): string {
  if (err instanceof ApiError && err.status === 409) {
    return /already have a viewing/i.test(err.message)
      ? t('عندك معاينة للوحدة دي، غيّر ميعادها من معايناتي', 'You already have a viewing of this home: change it in My viewings')
      : t('الميعاد ده لسه اتحجز، اختار ميعاد تاني', 'That time was just booked, pick another');
  }
  if (err instanceof ApiError && err.status === 0) return t('مفيش إنترنت، حاول تاني', 'No connection, try again');
  return t('حصلت مشكلة، حاول تاني', 'Something went wrong, try again');
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
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
