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
 * Release builds shrink the code with R8, which removes constructors nothing calls directly:
 * - Room creates its database classes by name; without them WorkManager crashes the app on launch.
 * - Expo creates native views by reflection through a (Context, AppContext) constructor. Expo keeps
 *   it for ExpoView subclasses only, so expo-gl's GLView (a TextureView) lost it and opening the
 *   360° tour crashed ("Didn't find a correct constructor").
 */
const KEEP_RULES = `
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keepclassmembers class * extends android.view.View { public <init>(android.content.Context, expo.modules.kotlin.AppContext); }
`;

/**
 * Phone pushes go through Expo's push service (contract §16.1 #3). Its tokens need the Expo
 * project's id (`extra.eas.projectId` in app.json), and Android ones need the Firebase project's
 * `google-services.json`, whose path is given here. Without it Android gets no push token.
 */
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: { ...config.android, ...(googleServicesFile && { googleServicesFile }) },
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
  extra: {
    ...config.extra,
    apiUrl,
    hasGoogleMapsKey: !!googleMapsKey,
  },
});
