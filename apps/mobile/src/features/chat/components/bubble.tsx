import { type ChatMessage, type ChatSender, type ChatThread, fmtDate, fmtMoney, fmtNum, fmtPct, fmtTime } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Bot, Calculator, CalendarCheck, CalendarClock, CalendarX, Check, CheckCheck, Clock, Hourglass, Rotate3d } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { rtlLine, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

type Props = {
  m: ChatMessage;
  thread: ChatThread;
  side: ChatSender;
  /** The last of a run from the same side: its corner is squared. */
  tail: boolean;
  onBook: (messageId: number, time: string) => void;
  /** A time being booked from this card. */
  booking: string | null;
  onImage: (url: string) => void;
  /** The advisor's answer to a booking request (2026-11-14); `answering` while one is on its way. */
  onAnswer?: (messageId: number, action: 'accept' | 'decline' | 'reschedule') => void;
  answering?: boolean;
};

/** `#rrggbb` at an opacity. */
function tint(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** One message (contract §8.12): text, photos, or a card about the conversation's home. */
export function Bubble({ m, thread, side, tail, onBook, booking, onImage, onAnswer, answering = false }: Props) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const mine = m.sender === side;
  const p = thread.property;
  const title = lang === 'ar' ? p.titleAr : p.titleEn;
  const place = `${lang === 'ar' ? p.compoundAr : p.compoundEn} | ${lang === 'ar' ? p.area.nameAr : p.area.nameEn}`;
  // My bubble is filled with the ink colour (navy in light mode, cream in dark), so what sits on it
  // is drawn in the page colour, faded where it should be quieter. Never white: it vanishes on cream.
  const fg = mine ? colors.bg : colors.ink;
  const soft = mine ? tint(colors.bg, 0.65) : colors.ink3;
  const chip = mine ? tint(colors.bg, 0.1) : colors.surface2;
  const shell = [
    styles.shell,
    { backgroundColor: mine ? colors.ink : colors.surface, borderColor: mine ? colors.ink : colors.line, alignSelf: mine ? ('flex-end' as const) : ('flex-start' as const) },
    tail && (mine ? styles.tailMine : styles.tailTheirs),
  ];
  const sending = m.id < 0;
  const meta = (
    <View style={styles.meta}>
      <Txt size={10.5} style={{ color: soft }}>
        {fmtTime(clock(m.createdAt), lang)}
      </Txt>
      {mine ? (
        sending ? (
          <Clock size={12} color={soft} accessibilityLabel={t('بيتبعت', 'Sending')} />
        ) : m.readAt ? (
          <CheckCheck size={14} color={colors.accent} accessibilityLabel={t('اتقرت', 'Read')} />
        ) : (
          <Check size={14} color={soft} accessibilityLabel={t('اتبعتت', 'Sent')} />
        )
      ) : null}
    </View>
  );
  // What a screen reader says of my message: sending, sent, or read.
  const state = sending ? t('بيتبعت', 'Sending') : m.readAt ? t('اتقرت', 'Read') : t('اتبعتت', 'Sent');
  const b = m.body;
  const cover = mediaUrl(p.cover);

  switch (b.kind) {
    case 'text':
      return (
        <View style={[shell, styles.pad]} accessible accessibilityLabel={mine ? `${t('أنت', 'You')}: ${b.text}، ${state}` : b.text}>
          {b.auto ? (
            <View style={styles.inline}>
              <Bot size={13} color={soft} />
              <Txt size={11} style={{ color: soft }}>
                {t('رد تلقائي', 'Automatic reply')}
              </Txt>
            </View>
          ) : null}
          <Txt size={14.5} style={{ color: fg }}>
            {rtlLine(b.text, lang)}
          </Txt>
          {meta}
        </View>
      );

    case 'images':
      return (
        <View style={[shell, styles.photos]}>
          <View style={styles.grid}>
            {b.urls.map((u) => (
              <Pressable
                key={u}
                accessibilityRole="imagebutton"
                accessibilityLabel={t('افتح الصورة', 'Open photo')}
                onPress={() => onImage(u)}
                style={[styles.photo, b.urls.length === 1 && styles.single, { backgroundColor: colors.surface2 }]}
              >
                <Image source={{ uri: mediaUrl(u) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
            ))}
          </View>
          <View style={styles.photoMeta}>{meta}</View>
        </View>
      );

    case 'property':
      return (
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}، ${fmtMoney(p.price, lang)}`} onPress={() => router.push(`/property/${p.id}`)} style={[shell, styles.card]}>
          <View style={[styles.cover, { backgroundColor: colors.surface2 }]}>{cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
          <View style={styles.pad}>
            <Txt size={15} weight="semibold" style={{ color: fg }}>
              {fmtMoney(p.price, lang)}
            </Txt>
            <Txt size={13} numberOfLines={1} style={{ color: fg }}>
              {title}
            </Txt>
            <Txt size={11.5} numberOfLines={1} style={{ color: soft }}>
              {place}
            </Txt>
            {meta}
          </View>
        </Pressable>
      );

    case 'plan':
      return (
        <View style={[shell, styles.card]}>
          <View style={[styles.planTop, { backgroundColor: colors.navy }]}>
            <Txt size={11} style={styles.cream60}>
              {t('القسط الشهري', 'Monthly installment')}
            </Txt>
            <Txt size={22} weight="semibold" style={{ color: colors.gold }}>
              {fmtMoney(b.monthly, lang, false)}
            </Txt>
          </View>
          <View style={[styles.pad, styles.planRow]}>
            <View style={styles.flex}>
              <Txt size={11} style={{ color: soft }}>
                {t('المقدم', 'Down payment')}
              </Txt>
              <Txt size={12} weight="semibold" style={{ color: fg }}>
                {fmtPct(b.downPct, lang)} | {fmtMoney((b.price * b.downPct) / 100, lang)}
              </Txt>
            </View>
            <View style={styles.flex}>
              <Txt size={11} style={{ color: soft }}>
                {t('المدة', 'Period')}
              </Txt>
              <Txt size={12} weight="semibold" style={{ color: fg }}>
                {t(`${fmtNum(b.years, 'ar')} سنين`, `${b.years} years`)}
              </Txt>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/property/${p.id}`)}
            style={[styles.cardAction, { backgroundColor: colors.accentSoft }]}
          >
            <Calculator size={15} color={colors.accentInk} />
            <Txt size={12.5} weight="medium" color="accentInk">
              {t('غيّر المقدم والمدة', 'Adjust down payment & period')}
            </Txt>
          </Pressable>
          <View style={styles.padX}>{meta}</View>
        </View>
      );

    case 'tour':
      return (
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('ابدأ الجولة ٣٦٠°', 'Start 360° tour')}، ${title}`} onPress={() => router.push(`/property/${p.id}/tour`)} style={[shell, styles.card]}>
          <View style={[styles.cover, { backgroundColor: colors.surface2 }]}>
            {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <View style={styles.tourShade}>
              <View style={styles.tourPill}>
                <View style={[styles.tourIcon, { backgroundColor: colors.navy }]}>
                  <Rotate3d size={15} color={colors.gold} />
                </View>
                <Txt size={13} weight="semibold" style={{ color: colors.navy }}>
                  {t('ابدأ الجولة ٣٦٠°', 'Start 360° tour')}
                </Txt>
              </View>
            </View>
          </View>
          <View style={styles.pad}>
            <Txt size={12.5} numberOfLines={1} style={{ color: fg }}>
              {title}
            </Txt>
            {meta}
          </View>
        </Pressable>
      );

    case 'slots': {
      const canPick = side === 'client' && !b.chosen && !booking;
      return (
        <View style={[shell, styles.pad, styles.slots]}>
          <View style={styles.inline}>
            <CalendarClock size={16} color={colors.accent} />
            <Txt size={13} weight="semibold" style={{ color: fg }}>
              {fmtDate(b.date, lang, 'long')}
            </Txt>
          </View>
          <View style={styles.times}>
            {b.times.map((tm) => {
              const on = b.chosen === tm || booking === tm;
              return (
                <Pressable
                  key={tm}
                  accessibilityRole="button"
                  accessibilityLabel={on ? `${fmtTime(tm, lang)}، ${t('اتحجزت', 'booked')}` : fmtTime(tm, lang)}
                  accessibilityState={{ disabled: !canPick, selected: on }}
                  disabled={!canPick}
                  onPress={() => onBook(m.id, tm)}
                  style={[
                    styles.time,
                    { backgroundColor: on ? colors.accent : chip, opacity: !canPick && !on ? 0.6 : 1 },
                  ]}
                >
                  {on ? <Check size={13} color={colors.navy} strokeWidth={3} /> : null}
                  <Txt size={13} weight="medium" style={{ color: on ? colors.navy : fg }}>
                    {fmtTime(tm, lang)}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          {canPick ? (
            <Txt size={11} style={{ color: soft }}>
              {t('دوس على ميعاد، والمسؤول هيأكده', 'Tap a time; the advisor confirms it')}
            </Txt>
          ) : b.chosen && side === 'agent' ? (
            <Txt size={11} color="success">
              {t('العميل اختار ميعاد', 'The client picked a time')}
            </Txt>
          ) : null}
          {meta}
        </View>
      );
    }

    case 'booking': {
      // A request from the chat waits for the advisor (2026-11-14); a card without a state was confirmed at once.
      const state = b.state ?? 'accepted';
      const look = {
        pending: { Icon: Hourglass, bg: colors.accent, title: t('معاينة مستنية التأكيد', 'Viewing awaiting confirmation') },
        accepted: { Icon: CalendarCheck, bg: colors.success, title: t('المعاينة اتأكدت', 'Viewing confirmed') },
        moved: { Icon: CalendarClock, bg: colors.success, title: t('الميعاد اتغير', 'New time confirmed') },
        declined: { Icon: CalendarX, bg: colors.danger, title: t('المسؤول اعتذر عن المعاينة', 'The advisor declined the viewing') },
        cancelled: { Icon: CalendarX, bg: colors.danger, title: t('المعاينة اتلغت', 'Viewing cancelled') },
      }[state];
      // The client's request keeps its headline once answered, with where it stands under it; the
      // advisor's answer follows as its own card.
      const request = m.sender === 'client';
      const booked = side === 'client' ? t('حجزت معاينة', 'You booked a viewing') : t('العميل حجز معاينة', 'The client booked a viewing');
      const outcome = {
        pending: side === 'client' ? t('مستنية تأكيد المسؤول', 'Waiting for the advisor to confirm') : null,
        accepted: t('اتأكدت', 'Confirmed'),
        moved: t('اتنقلت لميعاد تاني', 'Moved to another time'),
        declined: t('اتعتذر عنها', 'Declined'),
        cancelled: t('اتلغت', 'Cancelled'),
      }[state];
      const asks = state === 'pending' && side === 'agent' && !!onAnswer;
      return (
        <View style={[shell, styles.pad, styles.slots]}>
          <View style={styles.inline}>
            <View style={[styles.done, { backgroundColor: request ? colors.accent : look.bg }]}>
              {request ? <Hourglass size={18} color="#fff" /> : <look.Icon size={18} color="#fff" />}
            </View>
            <View>
              <Txt size={13.5} weight="semibold" style={{ color: fg }}>
                {request ? booked : look.title}
              </Txt>
              {request || (state !== 'declined' && state !== 'cancelled') ? (
                <Txt size={12} style={{ color: soft }}>
                  {fmtDate(b.date, lang, 'long')} | {fmtTime(b.time, lang)}
                </Txt>
              ) : null}
            </View>
          </View>
          {request && outcome ? (
            <Txt size={11.5} style={{ color: soft }}>
              {outcome}
            </Txt>
          ) : null}
          {asks ? (
            <View style={styles.answers}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: answering }}
                disabled={answering}
                onPress={() => onAnswer(m.id, 'accept')}
                style={[styles.cardAction, styles.flat, { backgroundColor: colors.success }]}
              >
                <Txt size={12.5} weight="semibold" style={{ color: '#fff' }}>
                  {t('أكّد المعاينة', 'Confirm')}
                </Txt>
              </Pressable>
              <View style={styles.answerRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: answering }}
                  disabled={answering}
                  onPress={() => onAnswer(m.id, 'reschedule')}
                  style={[styles.cardAction, styles.flat, styles.flex, { backgroundColor: chip }]}
                >
                  <Txt size={12.5} weight="medium" style={{ color: fg }}>
                    {t('غيّر الميعاد', 'Change the time')}
                  </Txt>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: answering }}
                  disabled={answering}
                  onPress={() => onAnswer(m.id, 'decline')}
                  style={[styles.cardAction, styles.flat, styles.flex, { backgroundColor: chip }]}
                >
                  <Txt size={12.5} weight="medium" color="danger">
                    {t('اعتذر', 'Decline')}
                  </Txt>
                </Pressable>
              </View>
            </View>
          ) : state === 'pending' && side === 'agent' ? null : side === 'client' ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/viewings')} style={[styles.cardAction, styles.flat, { backgroundColor: chip }]}>
              <Txt size={12.5} weight="medium" style={{ color: fg }}>
                {t('معايناتي', 'My viewings')}
              </Txt>
            </Pressable>
          ) : thread.leadId ? (
            <Pressable accessibilityRole="button" onPress={() => router.push(`/agent/lead/${thread.leadId}`)} style={[styles.cardAction, styles.flat, { backgroundColor: chip }]}>
              <Txt size={12.5} weight="medium" style={{ color: fg }}>
                {t('صفحة العميل', 'Lead page')}
              </Txt>
            </Pressable>
          ) : null}
          {meta}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  shell: { maxWidth: '82%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  answers: { gap: 6, marginTop: 6 },
  answerRow: { flexDirection: 'row', gap: 6 },
  tailMine: { borderBottomEndRadius: 6 },
  tailTheirs: { borderBottomStartRadius: 6 },
  pad: { paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
  padX: { paddingHorizontal: 14, paddingBottom: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  photos: { padding: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: 232 },
  photo: { width: 114, height: 114, borderRadius: 16, overflow: 'hidden' },
  single: { width: 232, height: 174 },
  photoMeta: { paddingHorizontal: 8 },
  card: { width: 256 },
  cover: { height: 150 },
  planTop: { padding: 14, gap: 2 },
  cream60: { color: 'rgba(251, 246, 233, 0.6)' },
  planRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  cardAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, borderRadius: radius.md, marginHorizontal: 14, marginBottom: 4 },
  flat: { marginHorizontal: 0, marginTop: 8 },
  tourShade: { position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: 'rgba(4, 21, 37, 0.35)', alignItems: 'center', justifyContent: 'center' },
  tourPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: radius.full, paddingStart: 4, paddingEnd: 14, height: 38 },
  tourIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  slots: { width: 288, paddingVertical: 12, gap: 8 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  time: { width: 124, minHeight: 40, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  done: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
