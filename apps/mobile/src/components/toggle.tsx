import { Platform, Switch, View } from 'react-native';
import { useTheme } from '@/core/theme';

/**
 * An on/off switch in the brand colours. On the web, react-native-web places the thumb as if
 * the layout were left-to-right, so in Arabic it lands outside the track: keep the switch
 * itself left-to-right there. Phones draw their own native switch and mirror it correctly.
 */
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (on: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={Platform.OS === 'web' ? { direction: 'ltr' } : undefined}>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.surface3 }}
        thumbColor={colors.cream}
        {...(Platform.OS === 'web' && { activeThumbColor: colors.cream })}
      />
    </View>
  );
}
