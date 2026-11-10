import { type DayHours, fmtDate, fmtTime, weekdayName } from '@maqar/shared';
import { Minus, Plus } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** Saturday first, as the week runs in Egypt. */
const ORDER = [6, 0, 1, 2, 3, 4, 5];
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** The week as one row per weekday, every day present: `null` hours mean a day off. */
export type WeekDraft = Record<number, { from: number; to: number } | null>;

export function draftOf(week: DayHours[]): WeekDraft {
  const draft: WeekDraft = {};
  for (const day of ORDER) {
    const d = week.find((w) => w.weekday === day);
    draft[day] = d ? { from: d.from, to: d.to } : null;
  }
  return draft;
}

export const weekOf = (draft: WeekDraft): DayHours[] =>
  ORDER.flatMap((weekday) => (draft[weekday] ? [{ weekday, from: draft[weekday]!.from, to: draft[weekday]!.to }] : []));

/** An agent's week: each day on or off, with the first and the last hour a viewing can start. */
export function WeekEditor({ value, onChange }: { value: WeekDraft; onChange: (w: WeekDraft) => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const set = (day: number, v: { from: number; to: number } | null) => onChange({ ...value, [day]: v });
  return (
    <View style={styles.list}>
      {ORDER.map((day) => {
        const h = value[day];
        const name = weekdayName(day, lang);
        return (
          <View key={day} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={styles.head}>
              <Txt weight="medium" style={styles.flex}>
                {name}
              </Txt>
              <Toggle label={name} value={h !== null} onChange={(on) => set(day, on ? { from: 10, to: 20 } : null)} />
            </View>
            {h ? (
              <View style={styles.hours}>
                <Stepper
                  label={t(`أول معاينة يوم ${name}`, `First viewing on ${name}`)}
                  text={fmtTime(hh(h.from), lang)}
                  onLess={h.from > 0 ? () => set(day, { ...h, from: h.from - 1 }) : undefined}
                  onMore={h.from < h.to ? () => set(day, { ...h, from: h.from + 1 }) : undefined}
                />
                <Txt size={12} color="ink3">
                  {t('لحد', 'to')}
                </Txt>
                <Stepper
                  label={t(`آخر معاينة يوم ${name}`, `Last viewing on ${name}`)}
                  text={fmtTime(hh(h.to), lang)}
                  onLess={h.to > h.from ? () => set(day, { ...h, to: h.to - 1 }) : undefined}
                  onMore={h.to < 23 ? () => set(day, { ...h, to: h.to + 1 }) : undefined}
                />
              </View>
            ) : (
              <Txt size={12} color="ink3">
                {t('إجازة', 'Day off')}
              </Txt>
            )}
          </View>
        );
      })}
    </View>
  );
}

function Stepper({ label, text, onLess, onMore }: { label: string; text: string; onLess?: () => void; onMore?: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  const btn = (icon: typeof Plus, onPress: (() => void) | undefined, name: string) => {
    const Icon = icon;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${name}`}
        accessibilityState={{ disabled: !onPress }}
        disabled={!onPress}
        onPress={onPress}
        hitSlop={6}
        style={[styles.step, { backgroundColor: colors.surface2, opacity: onPress ? 1 : 0.4 }]}
      >
        <Icon size={14} color={colors.ink} />
      </Pressable>
    );
  };
  return (
    <View style={styles.stepper} accessible={false}>
      {btn(Minus, onLess, t('أبدر ساعة', 'an hour earlier'))}
      <Txt size={13} weight="medium" accessibilityLabel={`${label} ${text}`} style={styles.time}>
        {text}
      </Txt>
      {btn(Plus, onMore, t('أتأخر ساعة', 'an hour later'))}
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
/** The next `n` calendar days from today, on the phone's clock (Cairo for the team). */
export function nextDays(n: number, from = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

/** A strip of days to pick one from (days off). */
export function DayStrip({ label, days, value, onChange }: { label: string; days: string[]; value: string | null; onChange: (d: string) => void }) {
  const lang = useLang();
  const { colors } = useTheme();
  return (
    <View style={styles.strip}>
      <Txt size={13} weight="medium" color="ink2">
        {label}
      </Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {days.map((d) => {
          const on = d === value;
          return (
            <Pressable
              key={d}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${label}: ${fmtDate(d, lang, 'weekday')}`}
              onPress={() => onChange(d)}
              style={[styles.day, { backgroundColor: on ? colors.ink : colors.surface, borderColor: colors.line }]}
            >
              <Txt size={11} style={{ color: on ? colors.bg : colors.ink2 }}>
                {weekdayName(new Date(`${d}T12:00:00`).getDay(), lang)}
              </Txt>
              <Txt size={14} weight="semibold" style={{ color: on ? colors.bg : colors.ink }}>
                {fmtDate(d, lang)}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  row: { borderRadius: radius.md, borderWidth: 1, padding: 12, gap: 8 },
  hours: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  step: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  time: { minWidth: 56, textAlign: 'center' },
  strip: { gap: 8 },
  days: { gap: 8 },
  day: { minWidth: 76, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10 },
});
