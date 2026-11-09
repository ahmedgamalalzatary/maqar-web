import { Platform } from 'react-native';

/**
 * A link that opens turn-by-turn directions to a point in the phone's maps app
 * (contract §16.1 #4): Apple Maps on iOS, Google Maps elsewhere. Free, no API key.
 */
export function directionsUrl({ lat, lng }: { lat: number; lng: number }, os: string = Platform.OS): string {
  return os === 'ios'
    ? `https://maps.apple.com/?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
