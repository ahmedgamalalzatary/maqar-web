import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { radius, useTheme } from '@/core/theme';

/**
 * A small, still map with the listing's pin (react-native-maps: Apple Maps on iOS, Google
 * Maps on Android). Panning is off so the page scrolls; directions open the maps app.
 */
export function LocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const { colors, scheme } = useTheme();
  return (
    <View style={[styles.box, { borderColor: colors.line }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        userInterfaceStyle={scheme}
        accessibilityLabel={title}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={title} pinColor={colors.gold} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 176, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
