import { type AgentViewing, fmtDate, fmtMoney, fmtTime, LEAD_SOURCE_LABEL, LEAD_STAGE_COLOUR, LEAD_STAGE_LABEL, type LeadCard, type LeadStage, relTime } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Flame, MapPin, Video } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** The flame of hot leads (contract §10.2). Red in both themes, as in the demo. */
export const HOT = '#e0574b';

/** A deleted account keeps its lead but loses its name. */
export function useLeadName() {
  const t = useT();
  return (name: string) => name || t('حساب محذوف', 'Deleted account');
}

/** A round avatar with the first letter, in the stage's (or the agent's) colour. */
export function Initials({ name, colour, size = 44 }: { name: string; colour: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colour }]}>
      <Txt size={size * 0.36} weight="semibold" style={styles.white}>
        {name.trim().slice(0, 1) || '?'}
      </Txt>
    </View>
  );
}

export function StagePill({ stage }: { stage: LeadStage }) {
  const t = useT();
  return (
    <View style={[styles.pill, { backgroundColor: LEAD_STAGE_COLOUR[stage] }]}>
      <Txt size={11} weight="medium" style={styles.white}>
        {t(LEAD_STAGE_LABEL[stage])}
      </Txt>
    </View>
  );
}

/** "New from app": a booking the agent has not opened yet. */
export function NewBadge() {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
      <Txt size={10.5} weight="semibold" color="accentInk">
        {t('جديد من التطبيق', 'New from app')}
      </Txt>
    </View>
  );
}

/**
 * A lead in the list: name and flame, the home, the budget and last activity, and the stage.
 * `firstCall` is the Today screen's shorter form: the home and the source, with a chevron.
 */
export function LeadRow({ lead, firstCall }: { lead: LeadCard; firstCall?: boolean }) {
  const t = useT();
  const lang = useLang();
  const dir = useDir();
  const router = useRouter();
  const { colors } = useTheme();
  const name = useLeadName()(lead.name);
  const home = lead.property ? t({ ar: lead.property.titleAr, en: lead.property.titleEn }) : t('من غير وحدة محددة', 'No home yet');
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const meta = firstCall
    ? `${home} | ${t(LEAD_SOURCE_LABEL[lead.source])}`
    : [lead.budget ? `${t('ميزانية', 'Budget')} ${fmtMoney(lead.budget, lang)}` : null, relTime(new Date(lead.lastActivityAt), lang)].filter(Boolean).join(' | ');
  const label = [name, lead.hot ? t('مهم', 'Hot') : null, lead.isNew ? t('جديد من التطبيق', 'New from app') : null, home, t(LEAD_STAGE_LABEL[lead.stage])].filter(Boolean).join('، ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(`/agent/lead/${lead.id}`)}
      style={({ pressed }) => [styles.row, { backgroundColor: colors.surface, borderColor: lead.isNew ? colors.accent : colors.line, opacity: pressed ? 0.85 : 1 }]}
    >
      <Initials name={name} colour={firstCall ? LEAD_STAGE_COLOUR.new : LEAD_STAGE_COLOUR[lead.stage]} size={firstCall ? 40 : 44} />
      <View style={styles.flex}>
        <View style={styles.inline}>
          <Txt size={14} weight="semibold" numberOfLines={1} style={styles.shrink}>
            {name}
          </Txt>
          {lead.hot ? <Flame size={15} color={HOT} /> : null}
          {lead.isNew ? <NewBadge /> : null}
        </View>
        {!firstCall ? (
          <Txt size={12} color="ink2" numberOfLines={1}>
            {home}
          </Txt>
        ) : null}
        <Txt size={firstCall ? 12 : 11.5} color={firstCall ? 'ink2' : 'ink3'} numberOfLines={1}>
          {meta}
        </Txt>
      </View>
      {firstCall ? <Chevron size={16} color={colors.ink3} /> : <StagePill stage={lead.stage} />}
    </Pressable>
  );
}

/** A viewing on the agent's day: the time, the client, the home. Booked in the app and not opened yet: outlined in gold. */
export function AgentViewingRow({ v, showDate }: { v: AgentViewing; showDate?: boolean }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const name = useLeadName()(v.clientName);
  const p = v.property;
  const cover = mediaUrl(p.cover);
  const day = showDate ? fmtDate(v.date, lang) : t('النهارده', 'Today');
  const where = v.mode === 'video' ? t('فيديو لايف', 'Live video') : `${t({ ar: p.compoundAr, en: p.compoundEn })} | ${t({ ar: p.area.nameAr, en: p.area.nameEn })}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[`${fmtTime(v.time, lang)} ${day}`, name, v.newFromApp ? t('جديد من التطبيق', 'New from app') : null, t({ ar: p.titleAr, en: p.titleEn })].filter(Boolean).join('، ')}
      disabled={!v.leadId}
      onPress={() => v.leadId && router.push(`/agent/lead/${v.leadId}`)}
      style={({ pressed }) => [
        styles.viewing,
        { backgroundColor: colors.surface, borderColor: v.newFromApp ? colors.accent : colors.line, borderWidth: v.newFromApp ? 2 : 1, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[styles.clock, { backgroundColor: colors.ink }]}>
        <Txt size={13} weight="semibold" style={{ color: colors.bg }}>
          {fmtTime(v.time, lang)}
        </Txt>
        <Txt size={10} style={{ color: colors.bg, opacity: 0.7 }}>
          {day}
        </Txt>
      </View>
      <View style={styles.flex}>
        <View style={styles.inline}>
          <Txt size={14} weight="semibold" numberOfLines={1} style={styles.shrink}>
            {name}
          </Txt>
          {v.newFromApp ? <NewBadge /> : null}
        </View>
        <Txt size={12} color="ink2" numberOfLines={1}>
          {t({ ar: p.titleAr, en: p.titleEn })}
        </Txt>
        <View style={styles.inline}>
          {v.mode === 'video' ? <Video size={13} color={colors.ink3} /> : <MapPin size={13} color={colors.ink3} />}
          <Txt size={11.5} color="ink3" numberOfLines={1} style={styles.shrink}>
            {where}
          </Txt>
        </View>
      </View>
      <View style={[styles.thumb, { backgroundColor: colors.surface2 }]}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, borderWidth: 1, padding: 12, minHeight: 64 },
  viewing: { flexDirection: 'row', gap: 12, borderRadius: radius.lg, padding: 12 },
  clock: { width: 58, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  thumb: { width: 56, height: 56, borderRadius: radius.md, overflow: 'hidden', alignSelf: 'center' },
  flex: { flex: 1, gap: 2, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shrink: { flexShrink: 1 },
});
