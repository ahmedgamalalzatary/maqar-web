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
 * - expo-gl's C++ calls GLContext.flush() by name (JNI); once R8 renamed it, the tour aborted the
 *   app ("no non-static method flush()V"). expo-gl ships no keep rules, so keep its classes whole.
 */
const KEEP_RULES = `
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keepclassmembers class * extends android.view.View { public <init>(android.content.Context, expo.modules.kotlin.AppContext); }
-keep class expo.modules.gl.** { *; }
`;

/**
 * Phone pushes go through Expo's push service (contract §16.1 #3). Its tokens need the Expo
 * project's id (`extra.eas.projectId` in app.json), and Android ones need the Firebase project's
 * `google-services.json`, whose path is given here. Without it Android gets no push token.
 */
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

/**
 * The store build number (OPS-03, 2026-11-15): Android's versionCode and iOS's buildNumber. CI sets
 * it to the commit count on main, so each upload is higher than the last; a local build leaves it
 * to Expo (1). Play takes whole numbers from 1 to 2,100,000,000.
 */
function storeBuildNumber(): number | undefined {
  const raw = process.env.APP_BUILD_NUMBER;
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!/^\d+$/.test(raw) || n < 1 || n > 2_100_000_000) throw new Error(`APP_BUILD_NUMBER must be a whole number from 1 to 2100000000, not "${raw}"`);
  return n;
}

/**
 * Apple's required-reason APIs (2026-11-17). Libraries ship their own privacy manifests, but iOS
 * links them statically, so those manifests do not reach the app; Expo writes this list into the
 * app's own PrivacyInfo.xcprivacy instead. It is the union of what React Native, the expo-* modules,
 * AsyncStorage and react-native-maps declare in node_modules (re-check after adding a native library).
 * No tracking. The data the app collects is declared in App Store Connect, not here.
 */
const PRIVACY_MANIFEST = {
  NSPrivacyTracking: false,
  NSPrivacyAccessedAPITypes: [
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'] },
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
    { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
  ],
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const build = storeBuildNumber();
  return {
    ...(config as ExpoConfig),
    android: { ...config.android, ...(googleServicesFile && { googleServicesFile }), ...(build && { versionCode: build }) },
    ios: { ...config.ios, privacyManifests: PRIVACY_MANIFEST, ...(build && { buildNumber: String(build) }) },
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
  };
};
