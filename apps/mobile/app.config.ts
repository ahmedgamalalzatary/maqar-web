import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Contract §5: one .env at the repo root for every app. Expo only reads .env from
// its own folder, so load the root file here, before Metro inlines EXPO_PUBLIC_* vars.
// (In CI there is no .env; the workflow sets the variables itself.)
loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

/**
 * Google Maps key for Android builds (contract §16.1 #4). Expo Go needs none; a release build
 * without one leaves the map out, because showing it would close the app. Restrict the key to the
 * app's package and signing SHA-1.
 */
const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;

/**
 * Release builds shrink the code with R8. Room creates its database classes by name, so R8 sees
 * their constructors as unused and removes them; WorkManager's then crashes the app on launch.
 */
const KEEP_RULES = `
-keep class * extends androidx.room.RoomDatabase { <init>(); }
`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  plugins: [
    ...(config.plugins ?? []),
    // Android release builds refuse plain http:// unless allowed. Only needed while
    // the API runs on a LAN address without TLS; production uses https.
    [
      'expo-build-properties',
      { android: { usesCleartextTraffic: apiUrl?.startsWith('http://') ?? false, extraProguardRules: KEEP_RULES } },
    ],
    ['react-native-maps', { androidGoogleMapsApiKey: googleMapsKey }],
  ],
  extra: { ...config.extra, apiUrl, hasGoogleMapsKey: !!googleMapsKey },
});
