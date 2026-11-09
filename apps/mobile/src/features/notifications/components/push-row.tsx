import { Bell } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { usePushSwitch } from '../hooks/use-push-switch';

/** "Phone notifications" in Me's settings: a switch that turns on and off, and says why when it can't. */
export function PushRow() {
  const t = useT();
  const { colors } = useTheme();
  const push = usePushSwitch();
  const label = t('إشعارات الموبايل', 'Phone notifications');
  const sub =
    push.permission === 'unsupported'
      ? t('مش متاحة على الجهاز ده', 'Not available on this device')
      : push.permission === 'denied'
        ? t('مقفولة من إعدادات الموبايل', 'Blocked in your phone’s settings')
        : push.on
          ? t('مفعّلة', 'On')
          : t('مقفولة', 'Off');

  return (
    <View style={styles.row}>
      <Bell size={20} color={colors.accentInk} />
      <View style={styles.flex}>
        <Txt>{label}</Txt>
        <Txt size={12} color={push.permission === 'denied' ? 'danger' : 'ink3'}>
          {sub}
        </Txt>
        {push.permission === 'denied' ? (
          <Pressable accessibilityRole="link" onPress={() => void Linking.openSettings()} hitSlop={6}>
            <Txt size={12} weight="medium" color="accentInk">
              {t('افتح الإعدادات', 'Open settings')}
            </Txt>
          </Pressable>
        ) : null}
      </View>
      <Toggle
        label={label}
        value={push.on}
        onChange={(on) => void push.turn(on)}
        disabled={push.busy || push.permission === null || push.permission === 'unsupported'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
  flex: { flex: 1, gap: 2 },
});
