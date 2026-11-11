import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { radius, useTheme } from '@/core/theme';

/**
 * Google Maps with no key closes the app on Android, so a build without one leaves the map out.
 * Apple Maps needs no key, and Expo Go brings its own. Pure so tests can be explicit (jest cannot
 * fake Platform.OS reliably).
 */
export function canShowMap(os: string, executionEnvironment: string | undefined, hasGoogleMapsKey: boolean | undefined): boolean {
  return (
    os !== 'android' ||
    executionEnvironment === ExecutionEnvironment.StoreClient ||
    hasGoogleMapsKey === true
  );
}

/**
 * A small, still map with the listing's pin (react-native-maps: Apple Maps on iOS, Google
 * Maps on Android). Panning is off so the page scrolls; directions open the maps app, and still
 * work when there is no map to show.
 */
export function LocationMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const { colors, scheme } = useTheme();
  if (!canShowMap(Platform.OS, Constants.executionEnvironment, Constants.expoConfig?.extra?.hasGoogleMapsKey as boolean | undefined)) return null;
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
