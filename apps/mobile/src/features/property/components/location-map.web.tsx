import { MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { radius, useTheme } from '@/core/theme';

/** react-native-maps has no web version: the web preview shows the coordinates instead. */
export function LocationMap({ lat, lng }: { lat: number; lng: number; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
      <MapPin size={28} color={colors.accent} />
      {/* Coordinates read left to right, even in Arabic. */}
      <Txt size={12} color="ink2" align="center" style={styles.ltr}>
        {`${lat.toFixed(4)}, ${lng.toFixed(4)}`}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 176,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ltr: { writingDirection: 'ltr' },
});
