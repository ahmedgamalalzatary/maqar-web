import {
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtTime,
  LEAD_NOTE_MAX,
  LEAD_SOURCE_LABEL,
  LEAD_STAGE_COLOUR,
  LEAD_STAGE_LABEL,
  LEAD_STAGES,
  type LeadDetail,
  type LeadStage,
  relTime,
} from '@maqar/shared';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, CalendarClock, Flame, MessageCircle, Phone, Send, StickyNote, Video, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { toast } from '@/components/toast';
import { useDir, useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { PropertyRow } from '@/features/listings/components/property-row';
import { HOT, Initials, NewBadge, useLeadName } from '../components/lead-parts';
import { useAddNote, useLead, useUpdateLead } from '../hooks/use-agent';

/** The stepper's stages; Lost sits apart, as "Mark as lost". */
const STEPS = LEAD_STAGES.filter((s) => s !== 'lost');

/** `/agent/lead/:id` (contract §10.2): the client, the stage, the home, the viewing, notes, and calling. */
export function LeadScreen({ id }: { id: number }) {
  const t = useT();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const lead = useLead(id);
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/agent/leads'));

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <IconButton label={t('رجوع', 'Back')} icon={<BackIcon size={20} color={colors.ink} />} onPress={back} />
      </View>
      {lead.isPending ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : lead.isError || !lead.data ? (
        <View style={styles.failed}>
          <Txt align="center">{t('مش لاقيين العميل ده.', 'We couldn’t find this lead.')}</Txt>
          <Button label={t('حاول تاني', 'Try again')} variant="secondary" onPress={() => void lead.refetch()} />
        </View>
      ) : (
        <Lead l={lead.data} />
      )}
    </View>
  );
}

function Lead({ l }: { l: LeadDetail }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const name = useLeadName()(l.name);
  const update = useUpdateLead(l.id);
  const addNote = useAddNote(l.id);
  const [note, setNote] = useState('');

  const change = (body: { stage?: LeadStage; hot?: boolean }, done: string) =>
    update.mutate(body, {
      onSuccess: () => toast.show({ title: done, tone: 'sage' }),
      onError: () => toast.show({ title: t('مقدرناش نحفظ التغيير، حاول تاني', 'We couldn’t save that, try again'), tone: 'danger' }),
    });
  const setStage = (s: LeadStage) => {
    if (s !== l.stage) change({ stage: s }, t(`الحالة: ${LEAD_STAGE_LABEL[s].ar}`, `Status: ${LEAD_STAGE_LABEL[s].en}`));
  };
  const send = () => {
    const text = note.trim();
    if (!text || addNote.isPending) return;
    addNote.mutate(text, {
      onSuccess: () => setNote(''),
      onError: () => toast.show({ title: t('مقدرناش نحفظ الملاحظة', 'We couldn’t save the note'), tone: 'danger' }),
    });
  };
  const digits = l.phone?.replace(/[^\d]/g, '') ?? '';
  const at = STEPS.indexOf(l.stage as (typeof STEPS)[number]);

  return (
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      <View>
        <Txt accessibilityRole="header" size={22} weight="semibold">
          {name}
        </Txt>
        <Txt size={13} color="ink2">
          {t(LEAD_SOURCE_LABEL[l.source])}
        </Txt>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Initials name={name} colour={LEAD_STAGE_COLOUR[l.stage]} size={54} />
        <View style={styles.flex}>
          <View style={styles.inline}>
            <Txt size={16} weight="semibold" numberOfLines={1} style={styles.shrink}>
              {name}
            </Txt>
            {l.isNew ? <NewBadge /> : null}
          </View>
          <Txt size={12.5} color="ink2" style={styles.ltr}>
            {l.phone ?? t('من غير رقم', 'No phone number')}
          </Txt>
          {l.budget ? (
            <View style={styles.inline}>
              <Wallet size={14} color={colors.ink2} />
              <Txt size={12} color="ink2">
                {fmtMoney(l.budget, lang)}
              </Txt>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('عميل مهم', 'Hot lead')}
          accessibilityState={{ checked: l.hot }}
          onPress={() => change({ hot: !l.hot }, l.hot ? t('شلنا علامة مهم', 'No longer marked hot') : t('اتعلّم مهم', 'Marked hot'))}
          hitSlop={6}
          style={[styles.hot, { backgroundColor: l.hot ? 'rgba(224, 87, 75, 0.12)' : colors.surface2 }]}
        >
          <Flame size={20} color={l.hot ? HOT : colors.ink3} fill={l.hot ? HOT : 'none'} />
        </Pressable>
      </View>

      {digits ? (
        <View style={styles.actions}>
          <Contact icon={Phone} label={t('اتصال', 'Call')} onPress={() => void Linking.openURL(`tel:${l.phone}`)} />
          <Contact icon={MessageCircle} label={t('واتساب', 'WhatsApp')} onPress={() => void Linking.openURL(`https://wa.me/${digits}`)} />
        </View>
      ) : null}

      <Txt accessibilityRole="header" size={15} weight="semibold" style={styles.heading}>
        {t('حالة العميل', 'Lead status')}
      </Txt>
      <View style={styles.steps}>
        <View style={[styles.rail, { backgroundColor: colors.surface3 }]} />
        {STEPS.map((s, i) => {
          const reached = l.stage !== 'lost' && i <= at;
          return (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityLabel={t(LEAD_STAGE_LABEL[s])}
              accessibilityState={{ checked: l.stage === s }}
              onPress={() => setStage(s)}
              style={styles.step}
            >
              <View style={[styles.num, reached ? { backgroundColor: colors.accent } : { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1 }]}>
                <Txt size={12} weight="semibold" style={{ color: reached ? colors.navy : colors.ink3 }}>
                  {fmtNum(i + 1, lang)}
                </Txt>
              </View>
              <Txt size={10.5} align="center" weight={l.stage === s ? 'semibold' : 'regular'} color={l.stage === s ? 'ink' : 'ink3'}>
                {t(LEAD_STAGE_LABEL[s])}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setStage(l.stage === 'lost' ? 'new' : 'lost')}
        hitSlop={8}
        style={styles.lost}
      >
        <Txt size={12} weight="medium" color={l.stage === 'lost' ? 'danger' : 'ink3'}>
          {l.stage === 'lost' ? t('العميل مغلق، رجّعه جديد', 'Marked as lost: reopen as new') : t('علّم كمغلق', 'Mark as lost')}
        </Txt>
      </Pressable>

      {l.property ? (
        <>
          <Txt accessibilityRole="header" size={15} weight="semibold" style={styles.heading}>
            {t('الوحدة المهتم بيها', 'Interested in')}
          </Txt>
          <PropertyRow card={l.property} />
        </>
      ) : null}

      {l.viewing ? (
        <>
          <Txt accessibilityRole="header" size={15} weight="semibold" style={styles.heading}>
            {t('المعاينة', 'Viewing')}
          </Txt>
          <View style={[styles.viewing, { backgroundColor: colors.ink }]}>
            <View style={[styles.viewingIcon, { backgroundColor: 'rgba(179, 137, 89, 0.2)' }]}>
              {l.viewing.mode === 'video' ? <Video size={20} color={colors.accent} /> : <CalendarClock size={20} color={colors.accent} />}
            </View>
            <View style={styles.flex}>
              <Txt size={14} weight="semibold" style={{ color: colors.bg }}>
                {fmtDate(l.viewing.date, lang, 'long')}
              </Txt>
              <Txt size={12.5} style={{ color: colors.bg, opacity: 0.7 }}>
                {fmtTime(l.viewing.time, lang)} | {l.viewing.mode === 'video' ? t('فيديو لايف', 'Live video') : t('في الموقع', 'On site')}
              </Txt>
            </View>
          </View>
        </>
      ) : null}

      <Txt accessibilityRole="header" size={15} weight="semibold" style={styles.heading}>
        {t('ملاحظات', 'Notes')}
      </Txt>
      <View style={styles.noteRow}>
        <TextInput
          accessibilityLabel={t('ملاحظة جديدة', 'New note')}
          value={note}
          onChangeText={setNote}
          placeholder={t('اكتب ملاحظة عن المكالمة…', 'Add a note about the call…')}
          placeholderTextColor={colors.ink3}
          maxLength={LEAD_NOTE_MAX}
          multiline
          style={[styles.noteInput, { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('احفظ الملاحظة', 'Save note')}
          accessibilityState={{ disabled: !note.trim() || addNote.isPending }}
          disabled={!note.trim() || addNote.isPending}
          onPress={send}
          style={[styles.send, { backgroundColor: colors.ink, opacity: !note.trim() ? 0.4 : 1 }]}
        >
          {addNote.isPending ? <ActivityIndicator color={colors.bg} /> : <Send size={18} color={colors.bg} style={lang === 'ar' ? styles.flip : undefined} />}
        </Pressable>
      </View>
      {l.notes.map((n) => (
        <View key={n.id} style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <StickyNote size={16} color={colors.accent} />
          <View style={styles.flex}>
            <Txt size={13}>{n.text}</Txt>
            <Txt size={11} color="ink3">
              {relTime(new Date(n.createdAt), lang)}
            </Txt>
          </View>
        </View>
      ))}
      <View style={[styles.note, { backgroundColor: colors.surface2 }]}>
        <CalendarClock size={16} color={colors.ink2} />
        <Txt size={12.5} color="ink2" style={styles.flex}>
          {t(
            `أول تواصل ${relTime(new Date(l.createdAt), 'ar')} من خلال: ${LEAD_SOURCE_LABEL[l.source].ar}`,
            `First touch ${relTime(new Date(l.createdAt), 'en')} via ${LEAD_SOURCE_LABEL[l.source].en}`,
          )}
        </Txt>
      </View>
    </ScrollView>
  );
}

function Contact({ icon: Icon, label, onPress }: { icon: typeof Phone; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.contact, { backgroundColor: colors.sageSoft, opacity: pressed ? 0.8 : 1 }]}
    >
      <Icon size={16} color={colors.sageInk} />
      <Txt size={14} weight="medium" color="sageInk">
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: 16, paddingBottom: 8 },
  loading: { marginTop: 48 },
  failed: { padding: 24, gap: 12 },
  content: { paddingHorizontal: 16, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 16 },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
  ltr: { writingDirection: 'ltr', textAlign: 'left', alignSelf: 'flex-start' },
  hot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  contact: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: radius.lg },
  heading: { marginTop: 12 },
  steps: { flexDirection: 'row', justifyContent: 'space-between' },
  rail: { position: 'absolute', top: 16, start: 28, end: 28, height: 2 },
  step: { width: 60, alignItems: 'center', gap: 6, minHeight: 44 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  lost: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  viewing: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 16 },
  viewingIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  noteInput: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 14 },
  send: { width: 46, height: 46, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  note: { flexDirection: 'row', gap: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: 'transparent', padding: 12 },
});
