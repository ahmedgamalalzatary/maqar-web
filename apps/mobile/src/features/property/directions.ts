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

/**
 * An OpenStreetMap embed framing the point with a marker, for the web preview only (as in the
 * demo): the phone apps use the native map. OSM's free tiles are for light use, so they are not
 * used in the store apps.
 */
export function osmEmbedUrl({ lat, lng }: { lat: number; lng: number }): string {
  const n = (x: number) => String(+x.toFixed(5));
  const bbox = [n(lng - 0.03), n(lat - 0.02), n(lng + 0.03), n(lat + 0.02)].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
}
