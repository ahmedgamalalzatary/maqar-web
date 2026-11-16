import { StyleSheet, View } from 'react-native';
import { haptic } from '@/core/motion/haptics';
import { CSS_EASE_OUT } from '@/core/motion/motion';
import { PressableScale } from './pressable-scale';
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
          <PressableScale
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            onPress={() => {
              if (!on) haptic.select();
              onChange(o.value);
            }}
            style={[styles.option, { backgroundColor: on ? colors.surface : 'transparent' }]}
          >
            <Txt size={13} weight={on ? 'semibold' : 'medium'} align="center" color={on ? 'ink' : 'ink2'}>
              {o.label}
            </Txt>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  option: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    transitionProperty: ['backgroundColor', 'transform', 'opacity'],
    transitionDuration: 180,
    transitionTimingFunction: CSS_EASE_OUT,
  },
});
