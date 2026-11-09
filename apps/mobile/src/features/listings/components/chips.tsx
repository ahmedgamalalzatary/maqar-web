import type { LucideIcon } from 'lucide-react-native';
import { Check, X } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { Txt } from '@/components/text';
import { radius, useTheme } from '@/core/theme';

/** A choice that can be on or off: filter groups and quick filters. */
export function ToggleChip({
  label,
  text = label,
  selected,
  onPress,
  icon: Icon,
  tone = 'plain',
  role = 'checkbox',
}: {
  /** What a screen reader says; `text` is what shows, when shorter (e.g. "٥+"). */
  label: string;
  text?: string;
  selected: boolean;
  onPress: () => void;
  icon?: LucideIcon;
  /** `quick` is the gold row of one-tap filters above the list. */
  tone?: 'plain' | 'quick';
  /** `radio` for one-of-many choices (bedrooms, budget presets). */
  role?: 'checkbox' | 'radio';
}) {
  const { colors } = useTheme();
  const bg =
    tone === 'quick' ? (selected ? colors.accent : colors.accentSoft) : selected ? colors.ink : colors.surface;
  const fg = tone === 'quick' ? (selected ? colors.navy : colors.accentInk) : selected ? colors.bg : colors.ink;
  const ShowIcon = Icon ?? (selected && tone === 'plain' ? Check : undefined);
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        tone === 'quick' ? styles.quick : styles.plain,
        { backgroundColor: bg, borderColor: tone === 'quick' ? 'transparent' : colors.line, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {ShowIcon ? <ShowIcon size={14} color={fg} strokeWidth={2} /> : null}
      <Txt size={tone === 'quick' ? 12 : 13} weight="medium" style={{ color: fg }}>
        {text}
      </Txt>
    </Pressable>
  );
}

/** An active filter above the list. Tapping it removes the filter. */
export function RemovableChip({ text, removeLabel, onRemove }: { text: string; removeLabel: string; onRemove: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={removeLabel}
      onPress={onRemove}
      style={({ pressed }) => [styles.chip, styles.quick, { backgroundColor: colors.ink, opacity: pressed ? 0.8 : 1 }]}
    >
      <Txt size={12} weight="medium" style={{ color: colors.bg }}>
        {text}
      </Txt>
      <X size={14} color={colors.bg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth },
  plain: { minHeight: 38, minWidth: 48, justifyContent: 'center', paddingHorizontal: 14 },
  quick: { height: 32, paddingHorizontal: 12, borderWidth: 0 },
});
