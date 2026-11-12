import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, useTheme } from '@/core/theme';
import { osmEmbedUrl } from '../directions';

/**
 * react-native-maps has no web version, so the web preview embeds an OpenStreetMap map with the
 * listing's pin, as the demo does (2026-11-12). Phones use the native map (location-map.tsx).
 */
export function LocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
      {createElement('iframe', {
        title,
        src: osmEmbedUrl({ lat, lng }),
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        style: { width: '100%', height: '100%', border: 0 },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 176,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
