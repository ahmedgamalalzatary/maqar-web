import { Pressable, StyleSheet, View } from 'react-native';
import { radius, useTheme } from '@/core/theme';
import { Txt } from './text';

/** One choice of a few, side by side. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={[styles.group, { backgroundColor: colors.surface2 }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.value)}
            style={[styles.option, on && { backgroundColor: colors.surface }]}
          >
            <Txt size={13} weight={on ? 'semibold' : 'medium'} align="center" color={on ? 'ink' : 'ink2'}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  option: { flex: 1, minHeight: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
